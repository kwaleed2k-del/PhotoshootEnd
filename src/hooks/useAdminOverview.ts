import { useState, useEffect, useCallback } from 'react';

export interface AdminOverview {
	from: string;
	to: string;
	totals: {
		creditsIn: number;
		creditsOut: number;
		usageCost: number;
		tokens: number;
	};
	byPlan: Array<{ plan: string; users: number }>;
	topByCreditsOut: Array<{ userId: string; displayName: string | null; username: string | null; creditsOut: number }>;
	topByUsageCost: Array<{ userId: string; displayName: string | null; username: string | null; usageCost: number }>;
}

async function fetchOverview(days: number, limit: number): Promise<AdminOverview> {
	const response = await fetch(`/api/admin/analytics/overview?days=${days}&limit=${limit}`, {
		credentials: 'include'
	});
	if (!response.ok) {
		const text = await response.text();
		throw new Error(text || `Request failed: ${response.status}`);
	}
	return (await response.json()) as AdminOverview;
}

export function useAdminOverview(days = 30, limit = 20) {
	const [data, setData] = useState<AdminOverview | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const load = useCallback(async () => {
		try {
			setError(null);
			setLoading(true);
			const result = await fetchOverview(days, limit);
			setData(result);
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			setError(message);
			setData(null);
		} finally {
			setLoading(false);
		}
	}, [days, limit]);

	useEffect(() => {
		void load();
	}, [load]);

	return { data, loading, error, refresh: load };
}


