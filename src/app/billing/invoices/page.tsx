'use client';

import Link from 'next/link';
import useSWRInfinite from 'swr/infinite';
import { jfetch } from '@/lib/api';
import { formatMoney } from '@/lib/money';
import type { Invoice, InvoicesPage } from '@/lib/types.billing';

type ApiInvoicesResponse = {
	items: {
		id: string;
		number: string | null;
		status: 'paid' | 'open' | 'void' | 'draft' | 'uncollectible' | null;
		currency: string | null;
		total: number | null;
		created: number;
		invoice_pdf: string | null;
		hosted_invoice_url: string | null;
	}[];
	next_cursor?: string | null;
};

const fetchInvoices = async (cursor?: string | null): Promise<InvoicesPage> => {
	const search = cursor ? `?limit=10&cursor=${cursor}` : '?limit=10';
	const data = await jfetch<ApiInvoicesResponse>(`/api/billing/invoices${search}`);
	return {
		data: data.items.map<Invoice>((invoice) => ({
			id: invoice.id,
			number: invoice.number ?? invoice.id,
			created_at: invoice.created ? new Date(invoice.created * 1000).toISOString() : undefined,
			amount_due_minor: invoice.total ?? undefined,
			currency: invoice.currency ?? undefined,
			status: (invoice.status ?? 'open') as Invoice['status'],
			hosted_invoice_url: invoice.hosted_invoice_url ?? undefined,
			invoice_pdf: invoice.invoice_pdf ?? undefined
		})),
		next_cursor: data.next_cursor ?? null
	};
};

const STATUS_COLORS: Record<Invoice['status'], string> = {
	paid: 'bg-green-100 text-green-800',
	open: 'bg-amber-100 text-amber-800',
	draft: 'bg-slate-200 text-slate-800',
	void: 'bg-gray-200 text-gray-600',
	uncollectible: 'bg-red-100 text-red-700'
};

function StatusBadge({ status }: { status: Invoice['status'] }) {
	return (
		<span className={`rounded-full px-2 py-1 text-xs font-medium ${STATUS_COLORS[status]}`}>
			{status}
		</span>
	);
}

export default function BillingInvoicesPage() {
	const {
		data,
		error,
		isLoading,
		isValidating,
		size,
		setSize,
		mutate
	} = useSWRInfinite<InvoicesPage>(
		(pageIndex, previousPageData) => {
			if (pageIndex > 0 && !previousPageData?.next_cursor) {
				return null;
			}
			const cursorKey = pageIndex === 0 ? 'start' : previousPageData?.next_cursor ?? 'start';
			return `billing:invoices:page:cursor=${cursorKey}`;
		},
		async (key) => {
			const cursor = key.split('=').pop();
			return fetchInvoices(cursor === 'start' ? null : cursor);
		}
	);

	const invoices = data ? data.flatMap((page) => page.data) : [];
	const nextCursor = data?.[data.length - 1]?.next_cursor ?? null;
	const isEmpty = !isLoading && invoices.length === 0;

	const handleLoadMore = () => {
		if (nextCursor) {
			void setSize(size + 1);
		}
	};

	return (
		<div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-8 text-white">
			<div className="flex flex-col gap-1">
				<h1 className="text-2xl font-semibold">Invoices</h1>
				<p className="text-sm text-zinc-400">Download receipts for every Stripe checkout.</p>
			</div>

			{error ? (
				<div className="rounded border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
					Failed to load invoices.{' '}
					<button onClick={() => mutate()} className="underline">
						Try again
					</button>
				</div>
			) : null}

			{isLoading ? (
				<div className="rounded border border-white/10 bg-white/5 p-6 text-sm text-zinc-400">Loading…</div>
			) : isEmpty ? (
				<div className="rounded border border-white/10 bg-white/5 p-6 text-sm text-zinc-400">
					<p>No invoices yet.</p>
					<p className="mt-2 text-xs text-zinc-500">
						After your first checkout, invoices will appear here. A Stripe customer record is created
						automatically during checkout.
					</p>
				</div>
			) : (
				<div className="overflow-hidden rounded border border-white/10 bg-white/5">
					<table className="min-w-full text-sm text-white">
						<thead className="bg-white/10 text-left text-xs uppercase tracking-wide text-zinc-400">
							<tr>
								<th className="px-4 py-3">Date</th>
								<th className="px-4 py-3">Invoice #</th>
								<th className="px-4 py-3">Status</th>
								<th className="px-4 py-3">Amount</th>
								<th className="px-4 py-3 text-right">Actions</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-white/5">
							{invoices.map((invoice) => (
								<tr key={invoice.id}>
									<td className="px-4 py-3 text-zinc-200">
										{invoice.created_at
											? new Date(invoice.created_at).toLocaleString()
											: '—'}
									</td>
									<td className="px-4 py-3 text-zinc-300">{invoice.number ?? invoice.id}</td>
									<td className="px-4 py-3">
										<StatusBadge status={invoice.status} />
									</td>
									<td className="px-4 py-3">
										{formatMoney(invoice.amount_due_minor ?? 0, invoice.currency ?? 'USD')}
									</td>
									<td className="px-4 py-3 text-right">
										<div className="flex justify-end gap-2">
											{invoice.hosted_invoice_url ? (
												<Link
													href={invoice.hosted_invoice_url}
													target="_blank"
													rel="noreferrer"
													className="text-xs text-blue-300 hover:text-blue-200"
												>
													View
												</Link>
											) : null}
											{invoice.invoice_pdf ? (
												<Link
													href={invoice.invoice_pdf}
													target="_blank"
													rel="noreferrer"
													className="text-xs text-zinc-300 hover:text-zinc-100"
												>
													PDF
												</Link>
											) : null}
										</div>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}

			<div className="flex justify-end">
				{nextCursor ? (
					<button
						onClick={handleLoadMore}
						disabled={isValidating}
						className="rounded border border-white/20 px-3 py-2 text-sm text-white transition hover:bg-white/10 disabled:opacity-50"
					>
						{isValidating ? 'Loading…' : 'Load more'}
					</button>
				) : (
					<span className="text-sm text-zinc-500">End of results</span>
				)}
			</div>
		</div>
	);
}

