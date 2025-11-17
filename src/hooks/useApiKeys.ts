import { useState, useEffect, useCallback } from 'react';

export type KeyRow = {
	id: string;
	name: string;
	key_prefix: string;
	revoked: boolean;
	last_used_at: string | null;
	created_at: string;
};

export type CreatedKey = {
	id: string;
	key: string;
	prefix: string;
};

async function fetchJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
	const response = await fetch(input, init);
	if (!response.ok) {
		const text = await response.text();
		throw new Error(text || `Request failed: ${response.status}`);
	}
	return (await response.json()) as T;
}

export function useApiKeys() {
	const [keys, setKeys] = useState<KeyRow[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const refresh = useCallback(async () => {
		try {
			setError(null);
			setLoading(true);
			const data = await fetchJson<KeyRow[]>('/api/keys', { credentials: 'include' });
			setKeys(data);
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

	const createKey = useCallback(
		async (name: string): Promise<CreatedKey> => {
			const created = await fetchJson<CreatedKey>('/api/keys', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ name })
			});
			await refresh();
			return created;
		},
		[refresh]
	);

	const revokeKey = useCallback(
		async (id: string): Promise<void> => {
			await fetchJson('/api/keys/revoke', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ id })
			});
			await refresh();
		},
		[refresh]
	);

	return { keys, loading, error, refresh, createKey, revokeKey };
}


