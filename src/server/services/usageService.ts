/**
 * Usage service - server-only wrapper around record_usage_event RPC.
 * Requires SUPABASE_SERVICE_ROLE_KEY. Never call from the browser.
 */
import { admin } from '../supabaseAdmin';

export interface UsageEventInput {
	userId: string;
	eventType: string;
	cost: number;
	tokens?: number | null;
	requestId?: string | null;
	metadata?: Record<string, unknown>;
}

export interface UsageEventResult {
	eventId: string;
	newBalance: number;
	wasDuplicate: boolean;
}

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
	if (msg.includes('INVALID_AMOUNT') || msg.includes('INVALID_INPUT')) {
		throw new InvalidAmountError();
	}
	throw new Error(`UsageService RPC failed: ${msg}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return !!value && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Generate a random request ID (UUID v4). Suitable for idempotency keys.
 */
export function newRequestId(): string {
	if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
		return crypto.randomUUID();
	}
	// Fallback simple UUID v4 generator if crypto.randomUUID is unavailable
	const rnd = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).slice(1);
	return `${rnd()}${rnd()}-${rnd()}-${rnd()}-${rnd()}-${rnd()}${rnd()}${rnd()}`;
}

/**
 * Atomically records a usage event and consumes credits via the RPC.
 * Returns eventId, newBalance, and a duplicate flag when requestId was reused.
 */
export async function recordUsageEvent(input: UsageEventInput): Promise<UsageEventResult> {
	assertNonEmptyString(input.userId, 'userId');
	assertNonEmptyString(input.eventType, 'eventType');
	assertPositiveNumber(input.cost, 'cost');

	const { data, error } = await admin.rpc('record_usage_event', {
		p_user_id: input.userId,
		p_event_type: input.eventType,
		p_cost: input.cost,
		p_tokens: input.tokens ?? null,
		p_request_id: input.requestId ?? null,
		p_metadata: input.metadata ?? {}
	});
	if (error) translateAndThrow(error);

	// data should be a JSON object: { event_id, new_balance, was_duplicate }
	if (!isRecord(data)) {
		throw new Error('UsageService: unexpected RPC response shape');
	}
	const eventId = String(data.event_id ?? '');
	const newBalance = Number(data.new_balance ?? NaN);
	const wasDuplicate = Boolean(data.was_duplicate ?? false);

	if (!eventId || !Number.isFinite(newBalance)) {
		throw new Error('UsageService: malformed RPC result');
	}
	return { eventId, newBalance, wasDuplicate };
}


