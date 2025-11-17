import 'dotenv/config';

/**
 * Express server for API endpoints.
 * Runs on process.env.API_PORT || 8787.
 * Server-only; requires SUPABASE_SERVICE_ROLE_KEY for admin operations.
 */
import express from 'express';
import cookieParser from 'cookie-parser';
import Stripe from 'stripe';
import { pathToFileURL } from 'url';
import { getSessionUser, UnauthenticatedError } from '../auth/expressAuth';
import { getBalance } from '../services/creditService';
import { getPlanSnapshot, getEffectivePlanCode, shouldWatermark } from '../services/subscriptionService';
import { runMonthlyGrantForAllUsers } from '../services/monthlyGrantService';
import { requireApiAccess, attachPlanCode, rateLimitByPlan } from '../middleware/planGate';
import { authenticateApiKey } from '../middleware/apiKeyAuth';
import { requireAdmin } from '../middleware/requireAdmin';
import { requireSessionApiAccess } from '../middleware/sessionApiAccess';
import {
	createCheckoutSession,
	createBillingPortalSession,
	verifyStripeSignature,
	stripe,
	ensureStripeCustomer
} from '../services/stripeService';
import { mapStripeSub, normalizeUserSubscriptions } from '../services/subscriptionNormalize';
import { createKeyForUser, listKeys, revokeKey } from '../services/apiKeyService';
import { attachWatermarkFlag } from '../middleware/watermarkFlag';
import { applyWatermarkIfRequired } from '../services/watermarkService';
import { costOf } from '../config/costs';
import { newRequestId, recordUsageEvent } from '../services/usageService';
import { SCOPES } from '../config/scopes';
import { admin } from '../supabaseAdmin';

export const app = express();
const PORT = Number.parseInt(process.env.API_PORT ?? '8787', 10);
const isDirectRun =
	typeof process.argv[1] === 'string' &&
	import.meta.url === pathToFileURL(process.argv[1]).href;

// Middleware
app.use(cookieParser());

// Stripe webhook must read the raw body
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
	try {
		const event = verifyStripeSignature(req);
		const payload = serializeStripeData(event.data);
		const userId = await resolveUserIdFromEvent(payload);

		const { error } = await admin.from('billing_events').insert({
			type: event.type,
			stripe_object_id: event.id,
			user_id: userId,
			payload
		});

		if (error) {
			if (error.message?.includes('billing_events_stripe_unique_idx')) {
				return res.sendStatus(200);
			}
			throw error;
		}

		await handleStripeEvent(event.type, payload, userId);
		res.sendStatus(200);
	} catch (e: unknown) {
		const err = e as { message?: string };
		console.error('Stripe webhook error', err);
		res.status(400).json({ error: String(err?.message ?? e ?? 'Webhook error') });
	}
});

app.use(express.json({ limit: '1mb' }));

// Health check
app.get('/api/health', (_req, res) => {
	res.json({ ok: true });
});

if (process.env.NODE_ENV !== 'production') {
	app.get('/api/debug/whoami', async (req, res) => {
		try {
			const user = await getSessionUser(req, res);
			return res.json({ ok: true, user });
		} catch {
			return res.status(401).json({ ok: false });
		}
	});
}

// GET /api/billing/balance
app.get('/api/billing/balance', async (req, res) => {
	try {
		const user = await getSessionUser(req, res);
		const balance = await getBalance(user.id);
		res.setHeader('Cache-Control', 'no-store');
		return res.status(200).json({ balance });
	} catch (e: unknown) {
		const err = e as { message?: string; code?: string };
		const msg = String(err?.message ?? e ?? 'Internal error');
		if (err instanceof UnauthenticatedError || err?.code === 'UNAUTHENTICATED' || msg.includes('UNAUTHENTICATED')) {
			return res.status(401).json({ error: 'unauthenticated' });
		}
		console.error('[balance] err:', msg);
		return res.status(500).json({ error: 'internal_error', hint: 'balance_route' });
	}
});

// API key management
app.get('/api/keys', async (req, res) => {
	try {
		const user = await getSessionUser(req, res);
		const keys = await listKeys(user.id);
		res.setHeader('Cache-Control', 'no-store');
		res.json(keys);
	} catch (e: unknown) {
		const err = e as { message?: string };
		if (String(err?.message).includes('UNAUTHENTICATED')) {
			return res.status(401).json({ error: 'unauthenticated' });
		}
		res.status(500).json({ error: String(err?.message ?? e ?? 'Internal server error') });
	}
});

app.post('/api/keys', async (req, res) => {
	try {
		const user = await getSessionUser(req, res);
		const { name } = req.body ?? {};
		const keyName = typeof name === 'string' && name.trim().length > 0 ? name.trim() : 'API Key';
		const created = await createKeyForUser(user.id, keyName);
		res.setHeader('Cache-Control', 'no-store');
		res.json(created);
	} catch (e: unknown) {
		const err = e as { message?: string };
		if (String(err?.message).includes('UNAUTHENTICATED')) {
			return res.status(401).json({ error: 'unauthenticated' });
		}
		res.status(500).json({ error: String(err?.message ?? e ?? 'Internal server error') });
	}
});

app.post('/api/keys/revoke', async (req, res) => {
	try {
		const user = await getSessionUser(req, res);
		const { id } = req.body ?? {};
		if (!id || typeof id !== 'string') {
			return res.status(400).json({ error: 'invalid_id' });
		}
		await revokeKey(user.id, id);
		res.setHeader('Cache-Control', 'no-store');
		res.json({ ok: true });
	} catch (e: unknown) {
		const err = e as { message?: string };
		if (String(err?.message).includes('UNAUTHENTICATED')) {
			return res.status(401).json({ error: 'unauthenticated' });
		}
		res.status(500).json({ error: String(err?.message ?? e ?? 'Internal server error') });
	}
});

// GET /api/billing/history
app.get('/api/billing/history', async (req, res) => {
	try {
		const user = await getSessionUser(req, res);
		const days = Math.min(365, Math.max(7, Number(req.query.days ?? 30)));
		const limit = Math.min(200, Math.max(10, Number(req.query.limit ?? 50)));
		const to = new Date();
		const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

		const [tx, ue] = await Promise.all([
			admin
				.from('credit_transactions')
				.select('id, delta, reason, metadata, created_at')
				.eq('user_id', user.id)
				.gte('created_at', from.toISOString())
				.lte('created_at', to.toISOString())
				.order('created_at', { ascending: false })
				.limit(limit),
			admin
				.from('usage_events')
				.select('id, event_type, cost, tokens, request_id, metadata, created_at')
				.eq('user_id', user.id)
				.gte('created_at', from.toISOString())
				.lte('created_at', to.toISOString())
				.order('created_at', { ascending: false })
				.limit(limit),
		]);

		if (tx.error) throw tx.error;
		if (ue.error) throw ue.error;

		res.json({
			from: from.toISOString(),
			to: to.toISOString(),
			credits: tx.data ?? [],
			usage: ue.data ?? [],
		});
	} catch (e: unknown) {
		const err = e as { message?: string };
		if (String(err?.message).includes('UNAUTHENTICATED')) {
			return res.status(401).json({ error: 'unauthenticated' });
		}
		res.status(500).json({ error: String(err?.message ?? e ?? 'Internal server error') });
	}
});

// GET /api/billing/invoices
app.get('/api/billing/invoices', async (req, res) => {
	try {
		const user = await getSessionUser(req, res);
		const limitParam = Number.parseInt((req.query.limit as string) ?? '20', 10);
		const limit = Math.max(5, Math.min(50, Number.isNaN(limitParam) ? 20 : limitParam));
		const cursor =
			typeof req.query.starting_after === 'string' ? req.query.starting_after : undefined;

		let stripeCustomerId: string | null = null;
		const existing = await admin
			.from('subscriptions')
			.select('stripe_customer_id')
			.eq('user_id', user.id)
			.not('stripe_customer_id', 'is', null)
			.order('created_at', { ascending: false })
			.limit(1)
			.single();
		if (!existing.error && existing.data?.stripe_customer_id) {
			stripeCustomerId = existing.data.stripe_customer_id as string;
		}
		if (!stripeCustomerId) {
			stripeCustomerId = await ensureStripeCustomer(user.id, user.email);
		}

		const invoices = await stripe.invoices.list({
			customer: stripeCustomerId,
			limit,
			starting_after: cursor,
			expand: ['data.charge']
		});

		const dto = invoices.data.map((invoice) => ({
			id: invoice.id,
			number: invoice.number ?? null,
			status: invoice.status ?? 'open',
			currency: invoice.currency ?? 'usd',
			total: invoice.total ?? 0,
			amount_due: invoice.amount_due ?? 0,
			amount_paid: invoice.amount_paid ?? 0,
			hosted_invoice_url: invoice.hosted_invoice_url ?? null,
			invoice_pdf: invoice.invoice_pdf ?? null,
			created: invoice.created ? new Date(invoice.created * 1000).toISOString() : '',
			period_start: invoice.lines.data[0]?.period?.start
				? new Date(invoice.lines.data[0].period.start * 1000).toISOString()
				: null,
			period_end: invoice.lines.data[0]?.period?.end
				? new Date(invoice.lines.data[0].period.end * 1000).toISOString()
				: null
		}));

		res.setHeader('Cache-Control', 'no-store');
		res.json({
			items: dto,
			has_more: invoices.has_more,
			next_cursor: invoices.has_more ? invoices.data[invoices.data.length - 1]?.id ?? null : null
		});
	} catch (e) {
		const err = e as { message?: string };
		if (String(err?.message).includes('UNAUTHENTICATED')) {
			return res.status(401).json({ error: 'unauthenticated' });
		}
		res.status(500).json({ error: String(err?.message ?? e ?? 'Internal server error') });
	}
});

// GET /api/analytics/me
app.get('/api/analytics/me', async (req, res) => {
	try {
		const user = await getSessionUser(req, res);
		const rawDays = Number.parseInt((req.query.days as string) ?? '30', 10);
		const days = Math.max(7, Math.min(365, Number.isNaN(rawDays) ? 30 : rawDays));

		const to = new Date();
		const from = new Date(to);
		from.setUTCHours(0, 0, 0, 0);
		from.setUTCDate(from.getUTCDate() - (days - 1));

		const fromIso = from.toISOString();
		const toIso = to.toISOString();

		const [creditResp, usageResp] = await Promise.all([
			admin
				.from('credit_transactions')
				.select('delta, created_at')
				.eq('user_id', user.id)
				.gte('created_at', fromIso)
				.lte('created_at', toIso),
			admin
				.from('usage_events')
				.select('event_type, cost, tokens, created_at')
				.eq('user_id', user.id)
				.gte('created_at', fromIso)
				.lte('created_at', toIso)
		]);

		if (creditResp.error) throw creditResp.error;
		if (usageResp.error) throw usageResp.error;

		const dailyMap = new Map<
			string,
			{ creditsIn: number; creditsOut: number; usageCost: number; tokens: number }
		>();

		for (let i = 0; i < days; i++) {
			const day = new Date(from);
			day.setUTCDate(from.getUTCDate() + i);
			const key = dayKey(day);
			dailyMap.set(key, { creditsIn: 0, creditsOut: 0, usageCost: 0, tokens: 0 });
		}

		let totalCreditsIn = 0;
		let totalCreditsOut = 0;

		for (const row of creditResp.data ?? []) {
			const key = dayKey(new Date(row.created_at as string));
			const bucket = dailyMap.get(key);
			if (!bucket) continue;
			const delta = Number(row.delta) || 0;
			if (delta > 0) {
				bucket.creditsIn += delta;
				totalCreditsIn += delta;
			} else if (delta < 0) {
				const out = Math.abs(delta);
				bucket.creditsOut += out;
				totalCreditsOut += out;
			}
		}

		const byEventMap = new Map<
			string,
			{ eventType: string; count: number; cost: number; tokens: number }
		>();
		let totalUsageCost = 0;
		let totalTokens = 0;

		for (const row of usageResp.data ?? []) {
			const key = dayKey(new Date(row.created_at as string));
			const bucket = dailyMap.get(key);
			if (bucket) {
				const cost = Number(row.cost) || 0;
				const tokens = Number(row.tokens) || 0;
				bucket.usageCost += cost;
				bucket.tokens += tokens;
				totalUsageCost += cost;
				totalTokens += tokens;
			}

			const eventType = (row.event_type as string) ?? 'unknown';
			const entry = byEventMap.get(eventType) ?? {
				eventType,
				count: 0,
				cost: 0,
				tokens: 0
			};
			entry.count += 1;
			entry.cost += Number(row.cost) || 0;
			entry.tokens += Number(row.tokens) || 0;
			byEventMap.set(eventType, entry);
		}

		const daily = Array.from(dailyMap.entries()).map(([date, values]) => ({
			date,
			...values
		}));

		const byEvent = Array.from(byEventMap.values()).sort((a, b) => {
			if (b.cost !== a.cost) return b.cost - a.cost;
			return b.count - a.count;
		});

		res.setHeader('Cache-Control', 'no-store');
		res.json({
			from: fromIso,
			to: toIso,
			totals: {
				creditsIn: totalCreditsIn,
				creditsOut: totalCreditsOut,
				usageCost: totalUsageCost,
				tokens: totalTokens
			},
			daily,
			byEvent
		});
	} catch (e: unknown) {
		const err = e as { message?: string };
		if (String(err?.message).includes('UNAUTHENTICATED')) {
			return res.status(401).json({ error: 'unauthenticated' });
		}
		res.status(500).json({ error: String(err?.message ?? e ?? 'Internal server error') });
	}
});

// GET /api/billing/plan
app.get('/api/billing/plan', async (req, res) => {
	try {
		const user = await getSessionUser(req, res);
		const snapshot = await getPlanSnapshot(user.id);
		const { data, error } = await admin
			.from('users')
			.select('is_admin')
			.eq('id', user.id)
			.single();
		if (error) throw error;
		res.json({
			...snapshot,
			features: {
				...snapshot.features,
				admin: data?.is_admin ?? false
			}
		});
	} catch (e: unknown) {
		const err = e as { message?: string };
		if (String(err?.message).includes('UNAUTHENTICATED')) {
			return res.status(401).json({ error: 'unauthenticated' });
		}
		res.status(500).json({ error: String(err?.message ?? e ?? 'Internal server error') });
	}
});

// GET /api/billing/watermark
app.get('/api/billing/watermark', async (req, res) => {
	try {
		const user = await getSessionUser(req, res);
		const [planCode, required] = await Promise.all([
			getEffectivePlanCode(user.id),
			shouldWatermark(user.id)
		]);
		res.json({
			required,
			planCode,
			features: { watermarking: required }
		});
	} catch (e: unknown) {
		const err = e as { message?: string };
		if (String(err?.message).includes('UNAUTHENTICATED')) {
			return res.status(401).json({ error: 'unauthenticated' });
		}
		res.status(500).json({ error: String(err?.message ?? e ?? 'Internal server error') });
	}
});

if (process.env.NODE_ENV === 'production') {
	app.all('/api/billing/record-usage', (_req, res) =>
		res.status(404).json({ error: 'disabled_in_production' })
	);
} else {
	app.post(
		'/api/billing/record-usage',
		requireApiAccess,
		attachPlanCode,
		rateLimitByPlan(SCOPES.default),
		async (req, res) => {
			try {
				const user = await getSessionUser(req, res);
				const { eventType, cost, tokens, requestId, metadata } = req.body ?? {};

				if (!eventType || !Number.isFinite(cost) || cost <= 0) {
					return res.status(400).json({ error: 'invalid_input' });
				}

				const out = await recordUsageEvent({
					userId: user.id,
					eventType,
					cost,
					tokens,
					requestId,
					metadata
				});

				res.json(out);
			} catch (e: unknown) {
				const err = e as { message?: string; code?: string };
				const msg = String(err?.message ?? e ?? 'Internal server error');
				if (msg.includes('UNAUTHENTICATED')) {
					return res.status(401).json({ error: 'unauthenticated' });
				}
				if (msg.includes('INSUFFICIENT_CREDITS') || err?.code === 'INSUFFICIENT_CREDITS') {
					return res.status(402).json({ error: 'insufficient_credits' });
				}
				if (msg.includes('INVALID_AMOUNT') || msg.includes('INVALID_INPUT') || err?.code === 'INVALID_AMOUNT') {
					return res.status(400).json({ error: 'invalid_input' });
				}
				res.status(500).json({ error: msg });
			}
		}
	);
}

// API key protected external route
app.get('/api/external/ping', authenticateApiKey(SCOPES.default), async (req, res) => {
	const user = (req as any).user;
	if (!user) {
		return res.status(500).json({ error: 'missing_user_context' });
	}
	const planCode = (req as any).planCode ?? (await getEffectivePlanCode(user.id));
	res.setHeader('Cache-Control', 'no-store');
	res.setHeader('Access-Control-Allow-Origin', '*');
	res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, x-api-key');
	res.json({
		ok: true,
		userId: user.id,
		plan: planCode,
		now: new Date().toISOString()
	});
});

app.post(
	'/api/external/generate/image',
	authenticateApiKey(SCOPES.generate),
	rateLimitByPlan(SCOPES.generate),
	attachWatermarkFlag,
	async (req, res) => {
		try {
			const user = (req as any).user as { id: string };
			const watermarkRequired: boolean = (req as any).watermarkRequired === true;
			const { prompt, width = 512, height = 512, requestId } = req.body ?? {};
			if (!prompt || typeof prompt !== 'string') {
				return res.status(400).json({ error: 'invalid_prompt' });
			}

			const pngBuffer = Buffer.from(
				'89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C4890000000A49444154789C636000000200010005FE02FEA7F6050000000049454E44AE426082',
				'hex'
			);

			const wmBuffer = await applyWatermarkIfRequired(pngBuffer, watermarkRequired, {
				text: 'Lenci • Free',
				opacity: 0.22
			});

			const idKey = requestId && typeof requestId === 'string' ? requestId : newRequestId();
			const result = await recordUsageEvent({
				userId: user.id,
				eventType: 'image.generate',
				cost: costOf('image.generate'),
				tokens: Math.max(1, Math.floor(((Number(width) || 512) * (Number(height) || 512)) / 65536)),
				requestId: idKey,
				metadata: { promptLen: prompt.length, width, height }
			});

			res.setHeader('Content-Type', 'image/png');
			res.setHeader('Cache-Control', 'no-store');
			res.setHeader('X-Usage-New-Balance', String(result.newBalance));
			res.setHeader('X-Usage-Was-Duplicate', String(result.wasDuplicate));
			res.setHeader('X-Watermarked', String(watermarkRequired));
			res.setHeader('Access-Control-Allow-Origin', '*');
			res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, x-api-key');
			return res.status(200).send(wmBuffer);
		} catch (e) {
			const err = e as { message?: string };
			const msg = String(err?.message ?? e ?? 'Internal server error');
			if (msg.includes('INSUFFICIENT_CREDITS')) {
				return res.status(402).json({ error: 'insufficient_credits' });
			}
				if (msg.includes('invalid_api_key')) {
				return res.status(401).json({ error: 'invalid_api_key' });
			}
			return res.status(500).json({ error: msg });
		}
	}
);

app.post(
	'/api/external/generate/text',
	authenticateApiKey(SCOPES.generate),
	rateLimitByPlan(SCOPES.generate),
	attachWatermarkFlag,
	async (req, res) => {
		try {
			const user = (req as any).user as { id: string };
			const watermarkRequired: boolean = (req as any).watermarkRequired === true;
			const { prompt, requestId } = req.body ?? {};
			if (!prompt || typeof prompt !== 'string') {
				return res.status(400).json({ error: 'invalid_prompt' });
			}

			const raw = `Echo: ${prompt}`;
			const output = watermarkRequired ? `${raw}\n\n— Generated on Free plan (watermarked)` : raw;

			const idKey = requestId && typeof requestId === 'string' ? requestId : newRequestId();
			const result = await recordUsageEvent({
				userId: user.id,
				eventType: 'text.generate',
				cost: costOf('text.generate'),
				tokens: Math.max(1, Math.floor(prompt.length / 4)),
				requestId: idKey,
				metadata: { promptLen: prompt.length }
			});

			res.setHeader('Content-Type', 'application/json');
			res.setHeader('Cache-Control', 'no-store');
			res.setHeader('X-Usage-New-Balance', String(result.newBalance));
			res.setHeader('X-Usage-Was-Duplicate', String(result.wasDuplicate));
			res.setHeader('X-Watermarked', String(watermarkRequired));
			res.setHeader('Access-Control-Allow-Origin', '*');
			res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, x-api-key');
			return res.status(200).json({ output, watermarked: watermarkRequired });
		} catch (e) {
			const err = e as { message?: string };
			const msg = String(err?.message ?? e ?? 'Internal server error');
			if (msg.includes('INSUFFICIENT_CREDITS')) {
				return res.status(402).json({ error: 'insufficient_credits' });
			}
			if (msg.includes('invalid_api_key')) {
				return res.status(401).json({ error: 'invalid_api_key' });
			}
			return res.status(500).json({ error: msg });
		}
	}
);

// Admin analytics overview
app.get('/api/admin/analytics/overview', requireAdmin, async (req, res) => {
	try {
		const daysParam = Number.parseInt((req.query.days as string) ?? '30', 10);
		const limitParam = Number.parseInt((req.query.limit as string) ?? '20', 10);
		const days = Math.max(7, Math.min(365, Number.isNaN(daysParam) ? 30 : daysParam));
		const limit = Math.max(10, Math.min(100, Number.isNaN(limitParam) ? 20 : limitParam));

		const now = new Date();
		const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
		const fromIso = from.toISOString();
		const toIso = now.toISOString();

		const [creditAgg, usageAgg, byPlanAgg, topCreditsAgg, topUsageAgg] = await Promise.all([
			admin.rpc('analytics_credits_totals', { p_from: fromIso, p_to: toIso }),
			admin.rpc('analytics_usage_totals', { p_from: fromIso, p_to: toIso }),
			admin.rpc('analytics_plan_counts'),
			admin.rpc('analytics_top_credits', { p_from: fromIso, p_to: toIso, p_limit: limit }),
			admin.rpc('analytics_top_usage', { p_from: fromIso, p_to: toIso, p_limit: limit })
		]);

		const totals = {
			creditsIn: creditAgg.data?.credits_in ?? 0,
			creditsOut: creditAgg.data?.credits_out ?? 0,
			usageCost: usageAgg.data?.usage_cost ?? 0,
			tokens: usageAgg.data?.tokens ?? 0
		};

		res.setHeader('Cache-Control', 'no-store');
		res.json({
			from: fromIso,
			to: toIso,
			totals,
			byPlan: byPlanAgg.data ?? [],
			topByCreditsOut: topCreditsAgg.data ?? [],
			topByUsageCost: topUsageAgg.data ?? []
		});
	} catch (e) {
		const err = e as { message?: string };
		res.status(500).json({ error: String(err?.message ?? e ?? 'Internal server error') });
	}
});

app.get('/api/admin/analytics/usage.csv', requireAdmin, async (req, res) => {
	try {
		const daysParam = Number.parseInt((req.query.days as string) ?? '30', 10);
		const days = Math.max(7, Math.min(365, Number.isNaN(daysParam) ? 30 : daysParam));
		const now = new Date();
		const fromIso = new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();

		const { data, error } = await admin.rpc('analytics_usage_csv', { p_from: fromIso });
		if (error) throw error;

		const rows = (data ?? []) as Array<{
			user_id: string;
			display_name: string | null;
			username: string | null;
			credits_in: number;
			credits_out: number;
			usage_cost: number;
			tokens: number;
		}>;

		const header = 'user_id,display_name,username,credits_in,credits_out,usage_cost,tokens';
		const csvLines = rows.map((row) =>
			[
				row.user_id,
				row.display_name ?? '',
				row.username ?? '',
				row.credits_in ?? 0,
				row.credits_out ?? 0,
				row.usage_cost ?? 0,
				row.tokens ?? 0
			]
				.map((value) => `"${String(value).replace(/"/g, '""')}"`)
				.join(',')
		);

		res.setHeader('Cache-Control', 'no-store');
		res.setHeader('Content-Type', 'text/csv');
		res.send([header, ...csvLines].join('\n'));
	} catch (e) {
		const err = e as { message?: string };
		res.status(500).json({ error: String(err?.message ?? e ?? 'Internal server error') });
	}
});

// POST /api/stripe/checkout
app.post('/api/stripe/checkout', async (req, res) => {
	try {
		const user = await getSessionUser(req, res);
		const { planCode, successUrl, cancelUrl } = req.body ?? {};
		if (!['starter', 'professional'].includes(planCode)) {
			return res.status(400).json({ error: 'invalid_plan' });
		}
		if (!successUrl || !cancelUrl) {
			return res.status(400).json({ error: 'missing_urls' });
		}
		const session = await createCheckoutSession({
			userId: user.id,
			planCode,
			successUrl,
			cancelUrl,
			email: user.email
		});
		res.json(session);
	} catch (e: unknown) {
		const err = e as { message?: string };
		if (String(err?.message).includes('UNAUTHENTICATED')) {
			return res.status(401).json({ error: 'unauthenticated' });
		}
		res.status(500).json({ error: String(err?.message ?? e ?? 'Internal server error') });
	}
});

// POST /api/stripe/portal
app.post('/api/stripe/portal', async (req, res) => {
	try {
		const user = await getSessionUser(req, res);
		const { returnUrl } = req.body ?? {};
		if (!returnUrl) {
			return res.status(400).json({ error: 'missing_return_url' });
		}
		const customerId = await ensureStripeCustomer(user.id, user.email);
		const session = await createBillingPortalSession(customerId, returnUrl);
		res.json(session);
	} catch (e: unknown) {
		const err = e as { message?: string };
		if (String(err?.message).includes('UNAUTHENTICATED')) {
			return res.status(401).json({ error: 'unauthenticated' });
		}
		res.status(500).json({ error: String(err?.message ?? e ?? 'Internal server error') });
	}
});

// POST /api/admin/run-monthly-grant (guarded by x-cron-secret)
app.post('/api/admin/run-monthly-grant', async (req, res) => {
	try {
		const secret = process.env.CRON_SECRET;
		const header = req.headers['x-cron-secret'];
		if (!secret || header !== secret) {
			return res.status(401).json({ error: 'unauthorized' });
		}

		const period =
			typeof req.query.period === 'string' && req.query.period.length > 0
				? req.query.period
				: currentYYYYMM();
		const limit =
			typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined;
		const dryRun =
			req.query.dry === '1' || req.query.dry === 'true' || req.query.dry === 'yes';

		const results = await runMonthlyGrantForAllUsers({
			period,
			limit: Number.isFinite(limit) ? limit : undefined,
			dryRun,
		});

		const summary = results.reduce(
			(acc, r) => {
				acc.total += 1;
				if (r.granted) acc.granted += 1;
				else acc.skipped += 1;
				return acc;
			},
			{ total: 0, granted: 0, skipped: 0 }
		);

		await admin.from('billing_events').insert({
			type: 'monthly_grant_run',
			user_id: null,
			payload: { summary }
		});

		res.json({ ok: true, summary });
	} catch (e: unknown) {
		const err = e as { message?: string };
		res.status(500).json({ error: String(err?.message ?? e ?? 'Internal server error') });
	}
});

// Start server
if (isDirectRun) {
	app.listen(PORT, () => {
		console.log(`[API] Server running on http://localhost:${PORT}`);
	});
}

async function handleStripeEvent(type: string, data: any, inferredUserId: string | null) {
	switch (type) {
		case 'checkout.session.completed':
			await handleCheckoutSessionEvent(data as Stripe.Checkout.Session, inferredUserId);
			break;
		case 'customer.subscription.created':
		case 'customer.subscription.updated':
		case 'customer.subscription.deleted':
			await handleSubscriptionEvent(data as Stripe.Subscription, inferredUserId);
			break;
		default:
			break;
	}
}

async function handleCheckoutSessionEvent(sessionData: Stripe.Checkout.Session, fallbackUserId: string | null) {
	try {
		const session = await stripe.checkout.sessions.retrieve(sessionData.id, {
			expand: ['line_items', 'subscription']
		});
		const userId =
			session.client_reference_id ??
			session.metadata?.user_id ??
			fallbackUserId ??
			(await findUserIdByCustomer(session.customer as string | undefined));
		if (!userId) return;
		const subscriptionId =
			typeof session.subscription === 'string'
				? session.subscription
				: session.subscription?.id;
		if (!subscriptionId) return;
		const subscription = await stripe.subscriptions.retrieve(subscriptionId);
		const mapped = mapStripeSub(subscription);
		await normalizeUserSubscriptions({
			userId,
			stripeCustomerId:
				typeof subscription.customer === 'string'
					? subscription.customer
					: subscription.customer?.id ?? null,
			stripeSubscriptionId: subscription.id,
			plan_code: mapped.plan_code,
			status: mapped.status,
			period_start: mapped.period_start,
			period_end: mapped.period_end
		});
	} catch (error) {
		console.error('Failed to handle checkout session', error);
	}
}

async function handleSubscriptionEvent(subscriptionData: Stripe.Subscription, fallbackUserId: string | null) {
	try {
		const subscription = await stripe.subscriptions.retrieve(subscriptionData.id);
		const mapped = mapStripeSub(subscription);
		await normalizeUserSubscriptions({
			userId:
				subscription.metadata?.user_id ??
				fallbackUserId ??
				(await findUserIdByCustomer(subscription.customer as string | undefined)) ??
				'',
			stripeCustomerId:
				typeof subscription.customer === 'string'
					? subscription.customer
					: subscription.customer?.id ?? null,
			stripeSubscriptionId: subscription.id,
			plan_code: mapped.plan_code,
			status: mapped.status,
			period_start: mapped.period_start,
			period_end: mapped.period_end
		});
	} catch (error) {
		console.error('Failed to handle subscription event', error);
	}
}

async function resolveUserIdFromEvent(data: any): Promise<string | null> {
	const metadataUser =
		data?.metadata?.user_id ?? data?.metadata?.userId ?? data?.metadata?.uid ?? null;
	if (metadataUser) return metadataUser;
	if (data?.client_reference_id) return data.client_reference_id;
	const customerId: string | undefined =
		typeof data?.customer === 'string' ? data.customer : undefined;
	if (customerId) {
		return findUserIdByCustomer(customerId);
	}
	return null;
}

async function findUserIdByCustomer(customerId?: string): Promise<string | null> {
	if (!customerId) return null;
	const { data } = await admin
		.from('subscriptions')
		.select('user_id')
		.eq('stripe_customer_id', customerId)
		.order('created_at', { ascending: false })
		.limit(1);
	if (data && data.length > 0) {
		return data[0].user_id as string;
	}
	return null;
}

function mapStripeStatus(status: string | null | undefined) {
	const mapping: Record<string, string> = {
		active: 'active',
		trialing: 'trialing',
		past_due: 'past_due',
		canceled: 'canceled',
		incomplete: 'incomplete',
		incomplete_expired: 'incomplete_expired',
		unpaid: 'unpaid',
		paused: 'paused'
	};
	return (status && mapping[status]) || 'incomplete';
}

function toIso(value?: number | null) {
	if (!value) return null;
	return new Date(value * 1000).toISOString();
}

function serializeStripeData(data: any) {
	return JSON.parse(JSON.stringify(data));
}

function dayKey(date: Date): string {
	const copy = new Date(date);
	copy.setUTCHours(0, 0, 0, 0);
	return copy.toISOString();
}

function currentYYYYMM(): string {
	const now = new Date();
	const year = now.getUTCFullYear();
	const month = String(now.getUTCMonth() + 1).padStart(2, '0');
	return `${year}-${month}`;
}



