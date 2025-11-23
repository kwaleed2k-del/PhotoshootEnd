import { stripe } from '@/lib/stripe';
import { processStripeEvent } from '@/server/services/stripeWebhook';

function getWebhookSecret(): string {
	const secret = process.env.STRIPE_WEBHOOK_SECRET;
	if (!secret) {
		throw new Error('Missing STRIPE_WEBHOOK_SECRET');
	}
	return secret;
}

function jsonResponse(body: unknown, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json' }
	});
}

export async function POST(request: Request) {
	const signature = request.headers.get('stripe-signature');
	if (!signature) {
		return jsonResponse({ error: 'missing_signature' }, 400);
	}

	const rawBody = await request.text();

	let event;
	try {
		event = stripe.webhooks.constructEvent(rawBody, signature, getWebhookSecret());
	} catch (error) {
		console.error('[stripe-webhook] Invalid signature', error);
		return jsonResponse({ error: 'invalid_signature' }, 400);
	}

	try {
		await processStripeEvent(event);
	} catch (error) {
		console.error('[stripe-webhook] Processing failed', {
			eventId: event.id,
			type: event.type,
			error
		});
		// Return 200 to avoid retries for internal errors; admins can resend events.
		return jsonResponse({ ok: false });
	}

	return jsonResponse({ ok: true });
}


