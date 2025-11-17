import { useState, useEffect, useCallback } from 'react';

export interface UsageAnalytics {
	from: string;
	to: string;
	totals: {
		creditsIn: number;
		creditsOut: number;
		usageCost: number;
		tokens: number;
	};
	daily: Array<{
		date: string;
		creditsIn: number;
		creditsOut: number;
		usageCost: number;
		tokens: number;
	}>;
	byEvent: Array<{
		eventType: string;
		count: number;
		cost: number;
		tokens: number;
	}>;
}

async function fetchAnalytics(days: number): Promise<UsageAnalytics> {
	const response = await fetch(`/api/analytics/me?days=${days}`, {
		credentials: 'include'
	});
	if (!response.ok) {
		const text = await response.text();
		throw new Error(text || `Request failed: ${response.status}`);
	}
	return (await response.json()) as UsageAnalytics;
}

export function useUsageAnalytics(days = 30) {
	const [data, setData] = useState<UsageAnalytics | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const load = useCallback(async () => {
		try {
			setError(null);
			setLoading(true);
			const result = await fetchAnalytics(days);
			setData(result);
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			setError(message);
			setData(null);
		} finally {
			setLoading(false);
		}
	}, [days]);

	useEffect(() => {
		void load();
	}, [load]);

	return { data, loading, error, refresh: load };
}


