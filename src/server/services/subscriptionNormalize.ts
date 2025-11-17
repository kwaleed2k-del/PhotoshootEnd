import type Stripe from 'stripe';
import { admin } from '../supabaseAdmin';
import { planForPrice } from './stripeService';

export function mapStripeSub(stripeSub: Stripe.Subscription): {
	plan_code: string | null;
	status: string;
	period_start: string | null;
	period_end: string | null;
} {
	const item = stripeSub.items?.data?.[0];
	const priceId = item?.price?.id ?? null;
	const plan = planForPrice(priceId);
	const status = stripeSub.status ?? 'incomplete';

	let period_start: string | null = null;
	let period_end: string | null = null;

	if (stripeSub.current_period_start && stripeSub.current_period_end) {
		period_start = new Date(stripeSub.current_period_start * 1000).toISOString();
		period_end = new Date(stripeSub.current_period_end * 1000).toISOString();
	}

	return {
		plan_code: plan,
		status,
		period_start,
		period_end
	};
}

export async function normalizeUserSubscriptions(args: {
	userId: string;
	stripeCustomerId?: string | null;
	stripeSubscriptionId?: string | null;
	plan_code: string | null;
	status: string;
	period_start: string | null;
	period_end: string | null;
}) {
	const { userId, stripeCustomerId, stripeSubscriptionId, plan_code, status, period_start, period_end } =
		args;

	const { error: demoteErr } = await admin
		.from('subscriptions')
		.update({ status: 'canceled' })
		.eq('user_id', userId)
		.neq('stripe_subscription_id', stripeSubscriptionId ?? '__none__')
		.in('status', ['active', 'trialing', 'past_due']);
	if (demoteErr) throw demoteErr;

	const payload = {
		user_id: userId,
		stripe_customer_id: stripeCustomerId ?? null,
		stripe_subscription_id: stripeSubscriptionId ?? null,
		plan_code: plan_code ?? 'free',
		status,
		current_period_start: period_start,
		current_period_end: period_end
	};

	if (stripeSubscriptionId) {
		const { error: upsertErr } = await admin.from('subscriptions').upsert(payload, {
			onConflict: 'stripe_subscription_id'
		});
		if (upsertErr) throw upsertErr;
	} else {
		const { error: insertErr } = await admin.from('subscriptions').insert(payload);
		if (insertErr) throw insertErr;
	}
}


