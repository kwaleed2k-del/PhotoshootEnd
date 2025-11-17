/**
 * Monthly credit grant service.
 * Server-only; requires SUPABASE_SERVICE_ROLE_KEY. Do not import in client components.
 */
import { admin } from '../supabaseAdmin';
import { creditsForPlan, type PlanCode } from '../config/plans';
import { grant } from './creditService';
import { getEffectivePlanCode } from './subscriptionService';

export interface GrantResult {
	userId: string;
	planCode: PlanCode;
	amount: number;
	period: string;
	granted: boolean;
	reason?: string;
}

interface EnsureOptions {
	dryRun?: boolean;
}

/**
 * Default period string (UTC YYYY-MM).
 */
function defaultPeriod(period?: string): string {
	if (period && /^\d{4}-\d{2}$/.test(period)) {
		return period;
	}
	return new Date().toISOString().slice(0, 7);
}

async function hasGrantForPeriod(userId: string, period: string): Promise<boolean> {
	const { data, error } = await admin
		.from('credit_transactions')
		.select('id')
		.eq('user_id', userId)
		.eq('reason', 'monthly_grant')
		.filter('metadata->>period', 'eq', period)
		.limit(1);

	if (error) {
		throw new Error(`Failed to check existing monthly grant: ${error.message}`);
	}

	return !!data && data.length > 0;
}

async function ensureMonthlyGrantInternal(
	userId: string,
	periodInput?: string,
	opts?: EnsureOptions
): Promise<GrantResult> {
	const period = defaultPeriod(periodInput);
	const planCode = await getEffectivePlanCode(userId);
	const amount = creditsForPlan(planCode) ?? 0;

	if (amount <= 0) {
		return {
			userId,
			planCode,
			amount,
			period,
			granted: false,
			reason: 'unlimited_or_zero',
		};
	}

	if (await hasGrantForPeriod(userId, period)) {
		return {
			userId,
			planCode,
			amount,
			period,
			granted: false,
			reason: 'already_granted',
		};
	}

	if (opts?.dryRun) {
		return {
			userId,
			planCode,
			amount,
			period,
			granted: false,
			reason: 'dry_run',
		};
	}

	try {
		await grant(userId, amount, 'monthly_grant', { period, plan_code: planCode });
		return {
			userId,
			planCode,
			amount,
			period,
			granted: true,
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		// Unique index violation -> treat as already granted
		if (message.includes('credit_tx_monthly_unique_idx') || message.includes('duplicate key')) {
			return {
				userId,
				planCode,
				amount,
				period,
				granted: false,
				reason: 'already_granted',
			};
		}
		throw error;
	}
}

/**
 * Ensure the monthly grant exists for a single user (creates if missing).
 */
export async function ensureMonthlyGrantForUser(
	userId: string,
	period?: string
): Promise<GrantResult> {
	return ensureMonthlyGrantInternal(userId, period, { dryRun: false });
}

interface RunOptions {
	period?: string;
	limit?: number;
	dryRun?: boolean;
}

/**
 * Run the monthly grant process for all users (limited batch).
 */
export async function runMonthlyGrantForAllUsers(opts?: RunOptions): Promise<GrantResult[]> {
	const period = defaultPeriod(opts?.period);
	const limit = opts?.limit ?? 5000;

	const { data, error } = await admin
		.from('users')
		.select('id')
		.order('created_at', { ascending: false })
		.limit(limit);

	if (error) {
		throw new Error(`Failed to fetch users for grant job: ${error.message}`);
	}

	const results: GrantResult[] = [];
	for (const row of data ?? []) {
		const userId = row.id as string;
		const result = await ensureMonthlyGrantInternal(userId, period, {
			dryRun: opts?.dryRun,
		});
		results.push(result);
	}

	return results;
}


