import type { PlanCode } from '../config/plans';

export interface ScopeLimit {
	windowMs: number;
	limit: number;
}

export type PlanScopeLimits = { default: ScopeLimit } & Record<string, ScopeLimit>;

export const RATE_LIMITS: Record<PlanCode, PlanScopeLimits> = {
	free: {
		default: { windowMs: 60_000, limit: 30 }
	},
	starter: {
		default: { windowMs: 60_000, limit: 120 }
	},
	professional: {
		default: { windowMs: 60_000, limit: 600 }
	},
	enterprise: {
		default: { windowMs: 60_000, limit: 5_000 }
	}
};

export function getPlanScopeLimit(plan: PlanCode, scope: string): ScopeLimit {
	const planLimits = RATE_LIMITS[plan];
	return planLimits[scope] ?? planLimits.default;
}


