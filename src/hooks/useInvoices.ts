import { useState, useCallback, useEffect } from 'react';

export interface InvoiceDTO {
	id: string;
	number: string | null;
	status: 'draft' | 'open' | 'paid' | 'uncollectible' | 'void';
	currency: string;
	total: number;
	amount_due: number;
	amount_paid: number;
	hosted_invoice_url: string | null;
	invoice_pdf: string | null;
	created: string;
	period_start: string | null;
	period_end: string | null;
}

interface InvoiceResponse {
	items: InvoiceDTO[];
	has_more: boolean;
	next_cursor: string | null;
}

export function useInvoices(initialLimit = 20) {
	const [items, setItems] = useState<InvoiceDTO[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [hasMore, setHasMore] = useState(false);
	const [cursor, setCursor] = useState<string | null>(null);
	const [limit] = useState(initialLimit);

	const load = useCallback(
		async (starting_after?: string | null, append = false) => {
			try {
				setLoading(true);
				setError(null);
				const params = new URLSearchParams();
				params.set('limit', String(limit));
				if (starting_after) params.set('starting_after', starting_after);
				const res = await fetch(`/api/billing/invoices?${params.toString()}`, {
					credentials: 'include'
				});
				if (!res.ok) {
					throw new Error(`HTTP ${res.status}`);
				}
				const data = (await res.json()) as InvoiceResponse;
				setItems((prev) => (append ? [...prev, ...data.items] : data.items));
				setHasMore(Boolean(data.has_more));
				setCursor(data.next_cursor ?? null);
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				setError(message);
			} finally {
				setLoading(false);
			}
		},
		[limit]
	);

	useEffect(() => {
		void load();
	}, [load]);

	const refresh = useCallback(() => load(undefined, false), [load]);
	const loadMore = useCallback(() => {
		if (!hasMore || !cursor) return;
		void load(cursor, true);
	}, [cursor, hasMore, load]);

	return {
		invoices: items,
		loading,
		error,
		hasMore,
		loadMore,
		refresh
	};
}


