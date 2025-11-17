/**
 * POST /api/billing/record-usage
 * Records a usage event and consumes credits atomically.
 * Body: { eventType: string; cost: number; tokens?: number; requestId?: string; metadata?: object }
 * Server-only endpoint; requires authentication.
 * Optional dev utility - keep simple, no UI dependency yet.
 */
import { NextResponse } from 'next/server';
import { getSessionUser } from '@/src/server/auth';
import { recordUsageEvent, type UsageEventInput } from '@/src/server/services/usageService';

function isRecord(value: unknown): value is Record<string, unknown> {
	return !!value && typeof value === 'object' && !Array.isArray(value);
}

export async function POST(request: Request) {
	try {
		const user = await getSessionUser();
		const body = await request.json();

		if (!isRecord(body)) {
			return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
		}

		const eventType = String(body.eventType ?? '');
		const cost = Number(body.cost ?? NaN);
		const tokens = body.tokens != null ? Number(body.tokens) : null;
		const requestId = body.requestId != null ? String(body.requestId) : null;
		const metadata = isRecord(body.metadata) ? body.metadata : {};

		if (!eventType || eventType.trim().length === 0) {
			return NextResponse.json({ error: 'eventType is required' }, { status: 400 });
		}
		if (!Number.isFinite(cost) || cost <= 0) {
			return NextResponse.json({ error: 'cost must be a positive number' }, { status: 400 });
		}

		const input: UsageEventInput = {
			userId: user.id,
			eventType,
			cost,
			tokens,
			requestId,
			metadata,
		};

		const result = await recordUsageEvent(input);
		return NextResponse.json(result);
	} catch (e: unknown) {
		const err = e as { message?: string; code?: string };
		if (String(err?.message).includes('UNAUTHENTICATED')) {
			return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
		}
		if (err?.code === 'INSUFFICIENT_CREDITS' || err?.code === 'INVALID_AMOUNT') {
			return NextResponse.json(
				{ error: String(err?.message ?? 'Invalid request') },
				{ status: 400 }
			);
		}
		return NextResponse.json(
			{ error: String(err?.message ?? e ?? 'Internal server error') },
			{ status: 500 }
		);
	}
}

