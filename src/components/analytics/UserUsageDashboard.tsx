import React, { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useUsageAnalytics } from '../../hooks/useUsageAnalytics';
import { UsageSparkline } from './UsageSparkline';

const ranges = [7, 30, 90];

export function UserUsageDashboard() {
	const [days, setDays] = useState(30);
	const { data, loading, error, refresh } = useUsageAnalytics(days);

	const netCredits =
		data?.daily.map((d) => ({ date: d.date, value: d.creditsIn - d.creditsOut })) ?? [];
	const usageCosts = data?.daily.map((d) => ({ date: d.date, value: d.usageCost })) ?? [];

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between gap-3 flex-wrap">
				<div>
					<h2 className="text-2xl font-semibold text-white">Usage analytics</h2>
					<p className="text-sm text-zinc-400">Credits & usage over the last {days} days.</p>
				</div>
				<div className="flex items-center gap-2">
					{ranges.map((range) => (
						<button
							key={range}
							type="button"
							onClick={() => setDays(range)}
							className={`rounded-lg px-3 py-1.5 text-sm ${
								range === days
									? 'bg-violet-600 text-white'
									: 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800'
							}`}
						>
							{range}d
						</button>
					))}
					<button
						type="button"
						onClick={() => refresh()}
						className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-white hover:bg-white/10"
					>
						<RefreshCw size={14} />
					</button>
				</div>
			</div>

			{loading ? (
				<div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-6 text-sm text-zinc-400">
					Loading analytics…
				</div>
			) : error ? (
				<div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
					{error}
				</div>
			) : data ? (
				<>
					<section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
						<KpiCard label="Credits in" value={data.totals.creditsIn} />
						<KpiCard label="Credits out" value={data.totals.creditsOut} />
						<KpiCard label="Usage cost" value={data.totals.usageCost} prefix="-" />
						<KpiCard label="Tokens" value={data.totals.tokens} />
					</section>

					<section className="grid gap-4 md:grid-cols-2">
						<UsageSparkline data={netCredits} label="Net credits" />
						<UsageSparkline data={usageCosts} label="Usage cost" />
					</section>

					<section className="rounded-2xl border border-white/10 bg-zinc-900/60 overflow-hidden">
						<div className="px-4 py-3 border-b border-white/10 text-sm font-semibold text-white">
							Usage by event
						</div>
						<div className="overflow-x-auto">
							<table className="min-w-full text-sm text-zinc-300">
								<thead className="bg-zinc-900 text-xs uppercase text-zinc-500">
									<tr>
										<th className="px-4 py-3 text-left">Event</th>
										<th className="px-4 py-3 text-right">Count</th>
										<th className="px-4 py-3 text-right">Cost</th>
										<th className="px-4 py-3 text-right">Tokens</th>
									</tr>
								</thead>
								<tbody>
									{data.byEvent.length === 0 ? (
										<tr>
											<td colSpan={4} className="px-4 py-6 text-center text-zinc-500">
												No usage in this period.
											</td>
										</tr>
									) : (
										data.byEvent.map((row) => (
											<tr key={row.eventType} className="border-t border-white/5">
												<td className="px-4 py-3 text-white">{row.eventType}</td>
												<td className="px-4 py-3 text-right">{row.count}</td>
												<td className="px-4 py-3 text-right">{row.cost}</td>
												<td className="px-4 py-3 text-right">{row.tokens}</td>
											</tr>
										))
									)}
								</tbody>
							</table>
						</div>
					</section>
				</>
			) : (
				<p className="text-sm text-zinc-400">No analytics available.</p>
			)}
		</div>
	);
}

function KpiCard({ label, value, prefix }: { label: string; value: number; prefix?: string }) {
	return (
		<div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4">
			<p className="text-xs text-zinc-400">{label}</p>
			<p className="text-2xl font-semibold text-white">
				{prefix}
				{value}
			</p>
		</div>
	);
}


