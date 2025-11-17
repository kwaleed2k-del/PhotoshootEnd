import { describe, expect, it } from 'vitest';
import {
	getPlanByCode,
	creditsForPlan,
	featureEnabled,
	isUnlimited,
	PLANS,
	type PlanCode
} from './plans';

describe('plans config', () => {
	const planCodes: PlanCode[] = ['free', 'starter', 'professional', 'enterprise'];

	it('returns defined plan configs', () => {
		for (const code of planCodes) {
			const plan = getPlanByCode(code);
			expect(plan).toBeDefined();
			expect(plan?.code).toBe(code);
		}
	});

	it('has expected monthly credits', () => {
		expect(creditsForPlan('free')).toBe(PLANS.free.monthlyCredits);
		expect(creditsForPlan('starter')).toBe(PLANS.starter.monthlyCredits);
		expect(creditsForPlan('professional')).toBe(PLANS.professional.monthlyCredits);
		expect(creditsForPlan('enterprise')).toBeNull();
	});

	it('reports feature flags correctly', () => {
		expect(featureEnabled('free', 'watermarking')).toBe(true);
		expect(featureEnabled('professional', 'api_access')).toBe(true);
		expect(featureEnabled('starter', 'api_access')).toBe(false);
	});

	it('detects unlimited plans', () => {
		expect(isUnlimited('enterprise')).toBe(true);
		expect(isUnlimited('free')).toBe(false);
	});
});


