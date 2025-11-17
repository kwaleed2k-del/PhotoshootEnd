import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
	recordUsageEvent,
	InsufficientCreditsError,
	InvalidAmountError
} from './usageService';

const rpcMock = vi.fn();

vi.mock('../supabaseAdmin', () => ({
	admin: {
		rpc: (...args: unknown[]) => rpcMock(...args)
	}
}));

describe('usageService', () => {
	beforeEach(() => {
		rpcMock.mockReset();
	});

	it('maps RPC response to UsageEventResult', async () => {
		rpcMock.mockResolvedValue({
			data: { event_id: 'evt_1', new_balance: 9, was_duplicate: false },
			error: null
		});

		const result = await recordUsageEvent({
			userId: 'user',
			eventType: 'text.generate',
			cost: 1
		});

		expect(result).toEqual({ eventId: 'evt_1', newBalance: 9, wasDuplicate: false });
	});

	it('translates insufficient credit errors', async () => {
		rpcMock.mockResolvedValue({
			data: null,
			error: { message: 'INSUFFICIENT_CREDITS' }
		});

		await expect(
			recordUsageEvent({
				userId: 'user',
				eventType: 'text.generate',
				cost: 1
			})
		).rejects.toBeInstanceOf(InsufficientCreditsError);
	});

	it('throws for invalid amounts', async () => {
		await expect(
			recordUsageEvent({
				userId: 'user',
				eventType: 'text.generate',
				cost: 0
			})
		).rejects.toBeInstanceOf(InvalidAmountError);
	});
});


