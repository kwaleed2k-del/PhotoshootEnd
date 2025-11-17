/**
 * Stripe service utilities (server-only).
 */
import Stripe from 'stripe';
import { admin } from '../supabaseAdmin';
import type { PlanCode } from '../config/plans';
import { PRICE_TO_PLAN, planForPrice } from '../config/stripeProducts';

const STRIPE_SECRET_KEY = requireEnv('STRIPE_SECRET_KEY');
const STRIPE_WEBHOOK_SECRET = requireEnv('STRIPE_WEBHOOK_SECRET');

function requireEnv(name: string): string {
	const value = process.env[name];
	if (!value) {
		throw new Error(`Missing required environment variable ${name}`);
	}
	return value;
}

export const stripe = new Stripe(STRIPE_SECRET_KEY, {
	apiVersion: '2023-10-16'
});

export async function ensureStripeCustomer(userId: string, email?: string | null): Promise<string> {
	const existing = await admin
		.from('subscriptions')
		.select('id, stripe_customer_id')
		.eq('user_id', userId)
		.not('stripe_customer_id', 'is', null)
		.order('created_at', { ascending: false })
		.limit(1)
		.single();

	if (existing.data?.stripe_customer_id) {
		return existing.data.stripe_customer_id as string;
	}

	const customer = await stripe.customers.create({
		email: email ?? undefined,
		metadata: { user_id: userId }
	});

	// Update latest subscription row with customer, or insert placeholder
	if (existing.data?.id) {
		await admin
			.from('subscriptions')
			.update({ stripe_customer_id: customer.id })
			.eq('id', existing.data.id);
	} else {
		await admin.from('subscriptions').insert({
			user_id: userId,
			plan_code: 'free',
			status: 'incomplete',
			stripe_customer_id: customer.id
		});
	}

	return customer.id;
}

function priceForPlan(planCode: PlanCode): string {
	for (const [priceId, mappedPlan] of Object.entries(PRICE_TO_PLAN)) {
		if (mappedPlan === planCode) return priceId;
	}
	throw new Error(`No Stripe price configured for plan ${planCode}`);
}

export async function createCheckoutSession(params: {
	userId: string;
	planCode: 'starter' | 'professional';
	successUrl: string;
	cancelUrl: string;
	email?: string | null;
}): Promise<{ url: string }> {
	const priceId = priceForPlan(params.planCode);
	const customerId = await ensureStripeCustomer(params.userId, params.email);

	const session = await stripe.checkout.sessions.create({
	mode: 'subscription',
	customer: customerId,
	line_items: [{ price: priceId, quantity: 1 }],
	success_url: params.successUrl,
	cancel_url: params.cancelUrl,
	client_reference_id: params.userId,
	metadata: { user_id: params.userId }
});

	if (!session.url) {
		throw new Error('Stripe session missing URL');
	}

	return { url: session.url };
}

export async function createBillingPortalSession(customerId: string, returnUrl: string): Promise<{ url: string }> {
	const session = await stripe.billingPortal.sessions.create({
	customer: customerId,
	return_url: returnUrl
});

	return { url: session.url };
}

export function verifyStripeSignature(req: import('express').Request) {
	const signature = req.headers['stripe-signature'];
	if (!signature || Array.isArray(signature)) {
		throw new Error('Missing Stripe signature header');
	}
	const event = stripe.webhooks.constructEvent(req.body, signature, STRIPE_WEBHOOK_SECRET);
	return {
		type: event.type,
		id: event.id,
		data: event.data.object
	};
}

export { planForPrice };


