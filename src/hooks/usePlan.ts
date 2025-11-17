import { useState, useEffect, useCallback } from 'react';
import type { PlanCode } from '../server/config/plans';

interface UsePlanResult {
	code: PlanCode;
	features: {
		api_access: boolean;
		watermarking: boolean;
		admin?: boolean;
	};
	loading: boolean;
	error: string | null;
	refresh: () => Promise<void>;
}

const defaultFeatures = { api_access: false, watermarking: true };

export function usePlan(): UsePlanResult {
	const [code, setCode] = useState<PlanCode>('free');
	const [features, setFeatures] = useState<typeof defaultFeatures & { admin?: boolean }>(defaultFeatures);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const fetchPlan = useCallback(async () => {
		try {
			setLoading(true);
			setError(null);
			const response = await fetch('/api/billing/plan', {
				credentials: 'include'
			});
			if (!response.ok) {
				throw new Error(`HTTP ${response.status}`);
			}
			const data = (await response.json()) as {
				code: PlanCode;
				features: typeof defaultFeatures & { admin?: boolean };
			};
			setCode(data.code);
			setFeatures(data.features);
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			setError(message);
			setCode('free');
			setFeatures(defaultFeatures);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void fetchPlan();
	}, [fetchPlan]);

	return {
		code,
		features,
		loading,
		error,
		refresh: fetchPlan
	};
}


