/**
 * Subscription service - determines effective plan from public.subscriptions.
 * Server-only; requires SUPABASE_SERVICE_ROLE_KEY. Do not import in client components.
 */
import { admin } from '../supabaseAdmin';
import { PLANS, type PlanCode, type FeatureKey, featureEnabled, type PlanConfig } from '../config/plans';

export type SubStatus =
	| 'active'
	| 'trialing'
	| 'past_due'
	| 'canceled'
	| 'incomplete'
	| 'incomplete_expired'
	| 'unpaid'
	| 'paused';

export interface SubscriptionRow {
	id: string;
	user_id: string;
	plan_code: PlanCode;
	status: SubStatus;
	current_period_start: string | null;
	current_period_end: string | null;
	created_at: string;
}

/**
 * Get the effective subscription for a user.
 * Considers only rows with status IN ('active','trialing','past_due').
 * Prefers the row with the latest current_period_end (NULLs last).
 * If ties or NULLs, falls back to newest created_at.
 * Returns null if none found.
 */
export async function getEffectiveSubscription(userId: string): Promise<SubscriptionRow | null> {
	const { data, error } = await admin
		.from('subscriptions')
		.select('id, user_id, plan_code, status, current_period_start, current_period_end, created_at')
		.eq('user_id', userId)
		.in('status', ['active', 'trialing', 'past_due']);

	if (error) {
		throw new Error(`Failed to fetch subscription: ${error.message}`);
	}

	if (!data || data.length === 0) {
		return null;
	}

	// Sort in memory to ensure correct ordering:
	// 1. By current_period_end DESC (NULLs last)
	// 2. By created_at DESC as fallback
	const sorted = [...data].sort((a, b) => {
		// Handle NULLs: NULL values go last
		if (a.current_period_end === null && b.current_period_end === null) {
			// Both NULL, sort by created_at DESC
			return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
		}
		if (a.current_period_end === null) return 1; // a is NULL, goes after b
		if (b.current_period_end === null) return -1; // b is NULL, goes after a

		// Both non-NULL, compare by current_period_end DESC
		const endDiff = new Date(b.current_period_end).getTime() - new Date(a.current_period_end).getTime();
		if (endDiff !== 0) return endDiff;

		// Tie on current_period_end, fall back to created_at DESC
		return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
	});

	const row = sorted[0];
	// Validate plan_code is a valid PlanCode
	if (!(row.plan_code in PLANS)) {
		return null;
	}

	return {
		id: row.id,
		user_id: row.user_id,
		plan_code: row.plan_code as PlanCode,
		status: row.status as SubStatus,
		current_period_start: row.current_period_start,
		current_period_end: row.current_period_end,
		created_at: row.created_at,
	};
}

/**
 * Get the effective plan code for a user.
 * Returns 'free' if no subscription or invalid plan_code.
 */
export async function getEffectivePlanCode(userId: string): Promise<PlanCode> {
	const sub = await getEffectiveSubscription(userId);
	if (!sub) {
		return 'free';
	}

	// Defensive: if plan_code not in PLANS map, treat as 'free'
	if (!(sub.plan_code in PLANS)) {
		return 'free';
	}

	return sub.plan_code;
}

/**
 * Check if a feature is enabled for a user based on their effective plan.
 */
export async function featureEnabledForUser(userId: string, feature: FeatureKey): Promise<boolean> {
	const planCode = await getEffectivePlanCode(userId);
	return featureEnabled(planCode, feature);
}

/**
 * Convenience wrapper: should watermark be applied for this user?
 * Returns true if watermarking feature is enabled.
 */
export async function shouldWatermark(userId: string): Promise<boolean> {
	return featureEnabledForUser(userId, 'watermarking');
}

/**
 * Get a complete plan snapshot for a user (code, plan config, and features).
 * Useful for API routes that need to return full plan information.
 */
export async function getPlanSnapshot(userId: string): Promise<{
	code: PlanCode;
	plan: PlanConfig;
	features: Record<FeatureKey, boolean>;
}> {
	const code = await getEffectivePlanCode(userId);
	const plan = PLANS[code];
	const features: Record<FeatureKey, boolean> = {
		api_access: featureEnabled(code, 'api_access'),
		watermarking: featureEnabled(code, 'watermarking'),
	};

	return { code, plan, features };
}

