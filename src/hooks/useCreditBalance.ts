import { useState, useEffect, useCallback } from 'react';

export function useCreditBalance(refreshMs?: number) {
	const [balance, setBalance] = useState<number | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const fetchBalance = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const response = await fetch('/api/billing/balance', { credentials: 'include' });
			if (response.status === 401) {
				setError('Please sign in');
				setBalance(null);
				return;
			}
			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}
			const data = (await response.json()) as { balance?: number };
			setBalance(typeof data.balance === 'number' ? data.balance : 0);
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed to fetch balance';
			setError(message);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void fetchBalance();
	}, [fetchBalance]);

	useEffect(() => {
		if (!refreshMs) return;
		const id = window.setInterval(() => {
			void fetchBalance();
		}, refreshMs);
		return () => window.clearInterval(id);
	}, [fetchBalance, refreshMs]);

	return { balance, loading, error, refresh: fetchBalance };
}


