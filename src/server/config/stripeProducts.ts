import type { PlanCode } from '../config/plans';

type PriceId = string;

function requireEnv(name: string): string {
	const value = process.env[name];
	if (!value) {
		throw new Error(`Missing required environment variable ${name}`);
	}
	return value;
}

export const PRICE_TO_PLAN: Record<PriceId, PlanCode> = {
	[requireEnv('STRIPE_PRICE_STARTER')]: 'starter',
	[requireEnv('STRIPE_PRICE_PROFESSIONAL')]: 'professional'
};

export function planForPrice(priceId?: string | null): PlanCode | null {
	if (!priceId) return null;
	return PRICE_TO_PLAN[priceId] ?? null;
}


