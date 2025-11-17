/**
 * Credit service - server-only wrapper around SQL functions.
 * Requires SUPABASE_SERVICE_ROLE_KEY. Do not import in client components.
 */
import { admin } from '../supabaseAdmin';

export class InsufficientCreditsError extends Error {
	code = 'INSUFFICIENT_CREDITS' as const;
	constructor(message = 'Insufficient credits') {
		super(message);
		this.name = 'InsufficientCreditsError';
	}
}

export class InvalidAmountError extends Error {
	code = 'INVALID_AMOUNT' as const;
	constructor(message = 'Invalid amount') {
		super(message);
		this.name = 'InvalidAmountError';
	}
}

function assertNonEmptyString(value: string, field: string): void {
	if (typeof value !== 'string' || value.trim().length === 0) {
		throw new Error(`Invalid ${field}`);
	}
}

function assertPositiveNumber(value: number, field: string): void {
	if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
		throw new InvalidAmountError(`${field} must be a positive number`);
	}
}

type RpcErrorShape = { message?: string; code?: string };

function translateAndThrow(e: unknown): never {
	const err = e as RpcErrorShape;
	const msg = (err && typeof err.message === 'string') ? err.message : String(e);
	const code = err?.code;
	if (msg.includes('INSUFFICIENT_CREDITS') || code === 'P0001') {
		throw new InsufficientCreditsError();
	}
	if (msg.includes('INVALID_AMOUNT')) {
		throw new InvalidAmountError();
	}
	throw new Error(`CreditService RPC failed: ${msg}`);
}

/**
 * Get current credit balance for a user.
 * Server-only; never call from the browser.
 */
export async function getBalance(userId: string): Promise<number> {
	assertNonEmptyString(userId, 'userId');
	const { data, error } = await admin.rpc('get_credit_balance', { p_user_id: userId });
	if (error) translateAndThrow(error);
	const numeric = typeof data === 'number' ? data : 0;
	return Number.isFinite(numeric) ? numeric : 0;
}

/**
 * Grant credits to a user. Returns new balance.
 * Server-only; never call from the browser.
 */
export async function grant(
	userId: string,
	amount: number,
	reason: string,
	metadata?: Record<string, unknown>
): Promise<number> {
	assertNonEmptyString(userId, 'userId');
	assertPositiveNumber(amount, 'amount');
	assertNonEmptyString(reason, 'reason');
	const { data, error } = await admin.rpc('grant_credits', {
		p_user_id: userId,
		p_amount: amount,
		p_reason: reason,
		p_metadata: metadata ?? {}
	});
	if (error) translateAndThrow(error);
	const numeric = typeof data === 'number' ? data : 0;
	return Number.isFinite(numeric) ? numeric : 0;
}

/**
 * Consume credits from a user. Returns new balance.
 * Throws InsufficientCreditsError when not enough balance.
 * Server-only; never call from the browser.
 */
export async function consume(
	userId: string,
	amount: number,
	reason: string,
	metadata?: Record<string, unknown>
): Promise<number> {
	assertNonEmptyString(userId, 'userId');
	assertPositiveNumber(amount, 'amount');
	assertNonEmptyString(reason, 'reason');
	const { data, error } = await admin.rpc('consume_credits', {
		p_user_id: userId,
		p_amount: amount,
		p_reason: reason,
		p_metadata: metadata ?? {}
	});
	if (error) translateAndThrow(error);
	const numeric = typeof data === 'number' ? data : 0;
	return Number.isFinite(numeric) ? numeric : 0;
}


