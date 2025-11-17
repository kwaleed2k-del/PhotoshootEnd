import { useState, useEffect, useCallback } from 'react';

export interface HistoryRange {
	days?: number;
	limit?: number;
}

export interface CreditTransaction {
	id: string;
	delta: number;
	reason: string;
	metadata: Record<string, unknown>;
	created_at: string;
}

export interface UsageEvent {
	id: string;
	event_type: string;
	cost: number;
	tokens: number | null;
	request_id: string | null;
	metadata: Record<string, unknown>;
	created_at: string;
}

interface UseBillingHistoryResult {
	from: string;
	to: string;
	credits: CreditTransaction[];
	usage: UsageEvent[];
	loading: boolean;
	error: string | null;
	refresh: () => Promise<void>;
}

/**
 * Hook to fetch billing history (credits and usage) from /api/billing/history.
 * Includes credentials (cookies) for authentication.
 */
export function useBillingHistory(range?: HistoryRange): UseBillingHistoryResult {
	const [from, setFrom] = useState<string>('');
	const [to, setTo] = useState<string>('');
	const [credits, setCredits] = useState<CreditTransaction[]>([]);
	const [usage, setUsage] = useState<UsageEvent[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const fetchHistory = useCallback(async () => {
		try {
			setError(null);
			const days = range?.days ?? 30;
			const limit = range?.limit ?? 50;

			const params = new URLSearchParams({
				days: String(days),
				limit: String(limit),
			});

			const response = await fetch(`/api/billing/history?${params.toString()}`, {
				credentials: 'include',
			});

			if (!response.ok) {
				if (response.status === 401) {
					throw new Error('Unauthenticated');
				}
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}

			const data = (await response.json()) as {
				from?: string;
				to?: string;
				credits?: CreditTransaction[];
				usage?: UsageEvent[];
			};

			setFrom(data.from ?? '');
			setTo(data.to ?? '');
			setCredits(data.credits ?? []);
			setUsage(data.usage ?? []);
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed to fetch history';
			setError(message);
			setFrom('');
			setTo('');
			setCredits([]);
			setUsage([]);
		} finally {
			setLoading(false);
		}
	}, [range?.days, range?.limit]);

	useEffect(() => {
		fetchHistory();
	}, [fetchHistory]);

	return {
		from,
		to,
		credits,
		usage,
		loading,
		error,
		refresh: fetchHistory,
	};
}

