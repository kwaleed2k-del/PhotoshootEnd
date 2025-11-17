import { describe, expect, it, beforeEach, vi } from 'vitest';
import type { PostgrestSingleResponse } from '@supabase/supabase-js';
import {
	getEffectiveSubscription,
	getEffectivePlanCode
} from './subscriptionService';

type SubscriptionRow = {
	id: string;
	user_id: string;
	plan_code: string;
	status: string;
	current_period_start: string | null;
	current_period_end: string | null;
	created_at: string;
};

const mockIn = vi.fn();
const mockEq = vi.fn();
const mockSelect = vi.fn();
const mockFrom = vi.fn();

vi.mock('../supabaseAdmin', () => ({
	admin: {
		from: (table: string) => {
			mockFrom(table);
			return {
				select: (...args: unknown[]) => {
					mockSelect(...args);
					return {
						eq: (...eqArgs: unknown[]) => {
							mockEq(...eqArgs);
							return {
								in: (...inArgs: unknown[]) => mockIn(...inArgs)
							};
						}
					};
				}
			};
		}
	}
}));

describe('subscriptionService', () => {
	beforeEach(() => {
		mockFrom.mockClear();
		mockSelect.mockClear();
		mockEq.mockClear();
		mockIn.mockReset();
	});

	it('chooses the subscription with the latest period end', async () => {
		const rows: SubscriptionRow[] = [
			{
				id: 'sub-old',
				user_id: 'user',
				plan_code: 'starter',
				status: 'active',
				current_period_start: '2024-01-01T00:00:00.000Z',
				current_period_end: '2024-02-01T00:00:00.000Z',
				created_at: '2024-01-01T00:00:00.000Z'
			},
			{
				id: 'sub-new',
				user_id: 'user',
				plan_code: 'professional',
				status: 'active',
				current_period_start: '2024-02-01T00:00:00.000Z',
				current_period_end: '2024-03-01T00:00:00.000Z',
				created_at: '2024-02-01T00:00:00.000Z'
			}
		];
		mockIn.mockResolvedValueOnce({ data: rows, error: null } as PostgrestSingleResponse<SubscriptionRow>);
		const result = await getEffectiveSubscription('user');
		expect(result?.id).toBe('sub-new');
	});

	it('returns null when no subscriptions exist', async () => {
		mockIn.mockResolvedValueOnce({ data: [], error: null });
		const result = await getEffectiveSubscription('user');
		expect(result).toBeNull();
	});

	it('falls back to free plan when no valid plan found', async () => {
		const rows: SubscriptionRow[] = [
			{
				id: 'sub-invalid',
				user_id: 'user',
				plan_code: 'unknown' as never,
				status: 'active',
				current_period_start: null,
				current_period_end: null,
				created_at: '2024-01-01T00:00:00.000Z'
			}
		];
		mockIn.mockResolvedValueOnce({ data: rows, error: null });
		const code = await getEffectivePlanCode('user');
		expect(code).toBe('free');
	});
});


