import React, { useState } from 'react';
import { AlertTriangle, FileDown, RefreshCw } from 'lucide-react';
import { useAdminOverview } from '../hooks/useAdminOverview';

const ranges = [7, 30, 90];

export default function AdminOverviewPage() {
	const [days, setDays] = useState(30);
	const [limit, setLimit] = useState(20);
	const { data, loading, error, refresh } = useAdminOverview(days, limit);

	const exportCsv = () => {
		window.open(`/api/admin/analytics/usage.csv?days=${days}`, '_blank');
	};

	return (
		<div className="min-h-screen bg-zinc-950 text-white">
			<div className="max-w-6xl mx-auto px-6 py-12 space-y-6">
				<header className="flex flex-wrap items-center justify-between gap-4">
					<div>
						<h1 className="text-3xl font-semibold">Admin analytics</h1>
						<p className="text-sm text-zinc-400">Organization-wide usage trends.</p>
					</div>
					<div className="flex items-center gap-2">
						{ranges.map((range) => (
							<button
								key={range}
								onClick={() => setDays(range)}
								className={`rounded-lg px-3 py-1.5 text-sm ${
									range === days ? 'bg-violet-600 text-white' : 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800'
								}`}
							>
								{range}d
							</button>
						))}
						<button
							onClick={() => refresh()}
							className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-white hover:bg-white/10"
						>
							<RefreshCw size={14} />
						</button>
						<button
							onClick={exportCsv}
							className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-1.5 text-sm text-white hover:bg-white/10"
						>
							<FileDown size={14} />
							<span>Export CSV</span>
						</button>
					</div>
				</header>

				{error && (
					<div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200 flex items-center gap-2">
						<AlertTriangle size={16} />
						<span>{error}</span>
					</div>
				)}

				{loading ? (
					<div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-6 text-sm text-zinc-400">
						Loading organization analytics…
					</div>
				) : data ? (
					<>
						<section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
							<Kpi label="Credits in" value={data.totals.creditsIn} />
							<Kpi label="Credits out" value={data.totals.creditsOut} />
							<Kpi label="Usage cost" value={data.totals.usageCost} prefix="-" />
							<Kpi label="Tokens" value={data.totals.tokens} />
						</section>

						<section className="rounded-2xl border border-white/10 bg-zinc-900/60 overflow-hidden">
							<div className="px-4 py-3 border-b border-white/10 text-sm font-semibold text-white">
								Users by plan
							</div>
							<table className="min-w-full text-sm text-zinc-300">
								<thead className="bg-zinc-900 text-xs uppercase text-zinc-500">
									<tr>
										<th className="px-4 py-3 text-left">Plan</th>
										<th className="px-4 py-3 text-right">Users</th>
									</tr>
								</thead>
								<tbody>
									{data.byPlan.length === 0 ? (
										<tr>
											<td colSpan={2} className="px-4 py-6 text-center text-zinc-500">
												No plan data.
											</td>
										</tr>
									) : (
										data.byPlan.map((row) => (
											<tr key={row.plan} className="border-t border-white/5">
												<td className="px-4 py-3 text-white capitalize">{row.plan}</td>
												<td className="px-4 py-3 text-right">{row.users}</td>
											</tr>
										))
									)}
								</tbody>
							</table>
						</section>

						<section className="grid gap-4 md:grid-cols-2">
							<TopUsersTable
								title="Top by credits out"
								rows={data.topByCreditsOut}
								valueField="creditsOut"
								valueLabel="Credits out"
							/>
							<TopUsersTable
								title="Top by usage cost"
								rows={data.topByUsageCost}
								valueField="usageCost"
								valueLabel="Usage cost"
							/>
						</section>
					</>
				) : (
					<p className="text-sm text-zinc-400">No analytics available.</p>
				)}
			</div>
		</div>
	);
}

function Kpi({ label, value, prefix }: { label: string; value: number; prefix?: string }) {
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

function TopUsersTable({
	title,
	rows,
	valueField,
	valueLabel
}: {
	title: string;
	rows: Array<{ userId: string; displayName: string | null; username: string | null } & Record<string, number>>;
	valueField: 'creditsOut' | 'usageCost';
	valueLabel: string;
}) {
	return (
		<div className="rounded-2xl border border-white/10 bg-zinc-900/60 overflow-hidden">
			<div className="px-4 py-3 border-b border-white/10 text-sm font-semibold text-white">{title}</div>
			<table className="min-w-full text-sm text-zinc-300">
				<thead className="bg-zinc-900 text-xs uppercase text-zinc-500">
					<tr>
						<th className="px-4 py-3 text-left">User</th>
						<th className="px-4 py-3 text-right">{valueLabel}</th>
					</tr>
				</thead>
				<tbody>
					{rows.length === 0 ? (
						<tr>
							<td colSpan={2} className="px-4 py-6 text-center text-zinc-500">
								No data.
							</td>
						</tr>
					) : (
						rows.map((row) => (
							<tr key={row.userId} className="border-t border-white/5">
								<td className="px-4 py-3">
									<div className="flex flex-col">
										<span className="text-white text-sm">{row.displayName ?? 'User'}</span>
										<span className="text-xs text-zinc-500">{row.username ?? row.userId}</span>
									</div>
								</td>
								<td className="px-4 py-3 text-right">{row[valueField]}</td>
							</tr>
						))
					)}
				</tbody>
			</table>
		</div>
	);
}


