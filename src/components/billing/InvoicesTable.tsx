import React from 'react';
import type { InvoiceDTO } from '../../hooks/useInvoices';
import { openPortal } from '../../client/billingClient';

interface Props {
	invoices: InvoiceDTO[];
	loading: boolean;
	hasMore?: boolean;
	onLoadMore?: () => void;
	error?: string | null;
}

const currencyFormatter = new Intl.NumberFormat(undefined, {
	style: 'currency',
	currency: 'USD'
});

export function InvoicesTable({ invoices, loading, hasMore, onLoadMore, error }: Props) {
	const formatAmount = (amount: number, currency: string) => {
		try {
			return new Intl.NumberFormat(undefined, {
				style: 'currency',
				currency: currency.toUpperCase()
			}).format((amount ?? 0) / 100);
		} catch {
			return currencyFormatter.format((amount ?? 0) / 100);
		}
	};

	return (
		<div className="rounded-2xl border border-white/10 bg-zinc-900/60 overflow-hidden">
			<div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
				<div>
					<h3 className="text-sm font-semibold text-white">Invoice history</h3>
					<p className="text-xs text-zinc-400">Past billing events from Stripe.</p>
				</div>
				<button
					type="button"
					onClick={() => openPortal()}
					className="text-xs text-violet-300 hover:text-violet-200 underline"
				>
					Open Stripe Portal
				</button>
			</div>
			{error && <div className="px-4 py-3 text-sm text-red-300">{error}</div>}
			<div className="overflow-x-auto">
				<table className="min-w-full text-sm text-zinc-300">
					<thead className="bg-zinc-900 text-xs uppercase text-zinc-500">
						<tr>
							<th className="px-4 py-2 text-left">Invoice</th>
							<th className="px-4 py-2 text-right">Total</th>
							<th className="px-4 py-2 text-right">Created</th>
							<th className="px-4 py-2 text-right">Period</th>
							<th className="px-4 py-2 text-right">Links</th>
						</tr>
					</thead>
					<tbody>
						{loading ? (
							<tr>
								<td colSpan={5} className="px-4 py-6 text-center text-zinc-400">
									Loading invoices…
								</td>
							</tr>
						) : invoices.length === 0 ? (
							<tr>
								<td colSpan={5} className="px-4 py-6 text-center text-zinc-500">
									No invoices yet. Once you subscribe, invoices will appear here.
								</td>
							</tr>
						) : (
							invoices.map((invoice) => (
								<tr key={invoice.id} className="border-t border-white/5">
									<td className="px-4 py-3">
										<div className="flex flex-col">
											<span className="text-white">{invoice.number ?? invoice.id}</span>
											<span className="text-xs text-zinc-500 capitalize">{invoice.status}</span>
										</div>
									</td>
									<td className="px-4 py-3 text-right">
										{formatAmount(invoice.total, invoice.currency)}
									</td>
									<td className="px-4 py-3 text-right">
										{new Date(invoice.created).toLocaleString()}
									</td>
									<td className="px-4 py-3 text-right text-xs text-zinc-400">
										{invoice.period_start && invoice.period_end
											? `${new Date(invoice.period_start).toLocaleDateString()} → ${new Date(
													invoice.period_end
												).toLocaleDateString()}`
											: '—'}
									</td>
									<td className="px-4 py-3 text-right text-xs">
										<div className="flex flex-col items-end gap-1">
											{invoice.hosted_invoice_url && (
												<a
													href={invoice.hosted_invoice_url}
													target="_blank"
													rel="noreferrer"
													className="text-violet-300 hover:text-violet-200 underline"
												>
													View online
												</a>
											)}
											{invoice.invoice_pdf && (
												<a
													href={invoice.invoice_pdf}
													target="_blank"
													rel="noreferrer"
													className="text-violet-300 hover:text-violet-200 underline"
												>
													PDF
												</a>
											)}
										</div>
									</td>
								</tr>
							))
						)}
					</tbody>
				</table>
			</div>
			{hasMore && !loading && (
				<div className="px-4 py-3 border-t border-white/10 text-right">
					<button
						type="button"
						onClick={onLoadMore}
						className="rounded-lg border border-white/10 px-4 py-2 text-sm text-white hover:bg-white/10"
					>
						Load more
					</button>
				</div>
			)}
		</div>
	);
}


