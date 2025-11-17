/**
 * GET /api/billing/history
 * Returns credit transactions and usage events for the signed-in user.
 * Query params: days (default 30, clamp 7-365), limit (default 50, clamp 10-200).
 * Server-only endpoint; requires authentication.
 */
import { NextResponse } from 'next/server';
import { getSessionUser } from '@/src/server/auth';
import { admin } from '@/src/server/supabaseAdmin';

function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}

export async function GET(request: Request) {
	try {
		const user = await getSessionUser();
		const { searchParams } = new URL(request.url);
		const days = clamp(Number.parseInt(searchParams.get('days') ?? '30', 10), 7, 365);
		const limit = clamp(Number.parseInt(searchParams.get('limit') ?? '50', 10), 10, 200);

		const to = new Date();
		const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);

		// Query credit_transactions
		const { data: credits, error: creditsError } = await admin
			.from('credit_transactions')
			.select('id, delta, reason, metadata, created_at')
			.eq('user_id', user.id)
			.gte('created_at', from.toISOString())
			.lte('created_at', to.toISOString())
			.order('created_at', { ascending: false })
			.limit(limit);

		if (creditsError) {
			throw new Error(`Failed to fetch credit transactions: ${creditsError.message}`);
		}

		// Query usage_events
		const { data: usage, error: usageError } = await admin
			.from('usage_events')
			.select('id, event_type, cost, tokens, request_id, metadata, created_at')
			.eq('user_id', user.id)
			.gte('created_at', from.toISOString())
			.lte('created_at', to.toISOString())
			.order('created_at', { ascending: false })
			.limit(limit);

		if (usageError) {
			throw new Error(`Failed to fetch usage events: ${usageError.message}`);
		}

		return NextResponse.json({
			from: from.toISOString(),
			to: to.toISOString(),
			credits: credits ?? [],
			usage: usage ?? [],
		});
	} catch (e: unknown) {
		const err = e as { message?: string };
		if (String(err?.message).includes('UNAUTHENTICATED')) {
			return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
		}
		return NextResponse.json(
			{ error: String(err?.message ?? e ?? 'Internal server error') },
			{ status: 500 }
		);
	}
}

