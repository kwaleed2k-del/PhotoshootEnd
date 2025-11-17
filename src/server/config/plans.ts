/**
 * SaaS plan configuration and helpers.
 *
 * Usage:
 * - Gate API routes: featureEnabled('professional', 'api_access')
 * - Show/hide watermark: featureEnabled(plan, 'watermarking')
 * - Monthly grant sizing: creditsForPlan(planCode)
 * - Plan lookup by code from DB/subscriptions: getPlanByCode(codeFromDb)
 *
 * Note: Stripe price/product IDs are mapped elsewhere (future stripeProducts.ts).
 * This file is the single source of truth for plan limits/features; no imports.
 */

/** Billing cycle options (reserved for future extension). */
export type BillingCycle = 'monthly';

/** Plan identifiers. */
export type PlanCode = 'free' | 'starter' | 'professional' | 'enterprise';

/** Feature flags keys for gating functionality. */
export type FeatureKey = 'api_access' | 'watermarking';

/** Plan configuration shape. */
export interface PlanConfig {
	/** Machine code for the plan. */
	code: PlanCode;
	/** Human-readable name. */
	name: string;
	/** Monthly price in USD; null for custom pricing. */
	monthlyPriceUsd: number | null;
	/** Monthly credit grant; null if unlimited. */
	monthlyCredits: number | null;
	/** True if the plan has unlimited credits. */
	unlimitedCredits?: boolean;
	/** Feature toggles for this plan. */
	features: Record<FeatureKey, boolean>;
}

/**
 * Ordered list of plans for UI and comparison matrices.
 */
export const PLAN_ORDER: PlanCode[] = ['free', 'starter', 'professional', 'enterprise'];

/**
 * All available plans and their configuration.
 * Use `as const` with `satisfies` so literals narrow while conforming to PlanConfig.
 */
export const PLANS = {
	free: {
		code: 'free',
		name: 'Free',
		monthlyPriceUsd: 0,
		monthlyCredits: 10,
		features: { api_access: false, watermarking: true }
	},
	starter: {
		code: 'starter',
		name: 'Starter',
		monthlyPriceUsd: 29,
		monthlyCredits: 100,
		features: { api_access: false, watermarking: false }
	},
	professional: {
		code: 'professional',
		name: 'Professional',
		monthlyPriceUsd: 99,
		monthlyCredits: 500,
		features: { api_access: true, watermarking: false }
	},
	enterprise: {
		code: 'enterprise',
		name: 'Enterprise',
		monthlyPriceUsd: null,
		monthlyCredits: null,
		unlimitedCredits: true,
		features: { api_access: true, watermarking: false }
	}
} as const satisfies Record<PlanCode, PlanConfig>;

/**
 * Lookup a plan by arbitrary code string.
 * Returns null if code is not a recognized PlanCode.
 */
export function getPlanByCode(code: string): PlanConfig | null {
	const c = code as PlanCode;
	return (PLANS as Record<string, PlanConfig>)[c] ?? null;
}

/**
 * Get monthly credits for a plan.
 * Returns null if the plan has unlimited credits.
 */
export function creditsForPlan(code: PlanCode): number | null {
	return PLANS[code].monthlyCredits;
}

/**
 * Whether the plan has unlimited credits.
 */
export function isUnlimited(code: PlanCode): boolean {
	return PLANS[code].unlimitedCredits === true;
}

/**
 * Check if a feature is enabled for the given plan.
 */
export function featureEnabled(code: PlanCode, feature: FeatureKey): boolean {
	return PLANS[code].features[feature] === true;
}


