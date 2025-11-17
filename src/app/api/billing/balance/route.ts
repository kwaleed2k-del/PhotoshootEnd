/**
 * GET /api/billing/balance
 * Returns current credit balance for the signed-in user.
 * Server-only endpoint; requires authentication.
 */
import { NextResponse } from 'next/server';
import { getSessionUser } from '@/src/server/auth';
import { getBalance } from '@/src/server/services/creditService';

export async function GET() {
	try {
		const user = await getSessionUser();
		const balance = await getBalance(user.id);
		return NextResponse.json({ balance });
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

