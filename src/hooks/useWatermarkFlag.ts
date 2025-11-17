import { useState, useEffect, useCallback } from 'react';

type Result = { required: boolean; planCode: string } | null;

export function useWatermarkFlag() {
	const [data, setData] = useState<Result>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const refresh = useCallback(async () => {
		try {
			setLoading(true);
			setError(null);
			const response = await fetch('/api/billing/watermark', { credentials: 'include' });
			if (!response.ok) {
				throw new Error(`HTTP ${response.status}`);
			}
			const json = await response.json();
			setData({
				required: Boolean(json?.required),
				planCode: String(json?.planCode ?? 'free')
			});
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			setError(message);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	return {
		required: Boolean(data?.required),
		planCode: data?.planCode ?? 'free',
		loading,
		error,
		refresh
	};
}


