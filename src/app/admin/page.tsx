'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { useAuth } from '@/components/AuthProvider';
import { isAdmin } from '@/lib/roles';
import { formatMoney } from '@/lib/money';
import type { CreditPackage } from '@/lib/types.billing';
import type { AdminLowCreditLog } from '@/lib/types.admin';
import type { LowCreditLog } from '@/lib/types.alerts';
import {
	listCreditPackages,
	listLowCreditLogs,
	sendTestEmail,
	updateCreditPackage
} from '@/lib/adminApi';

const WRITE_ENABLED = process.env.NEXT_PUBLIC_ADMIN_WRITE_ENABLED !== 'false';

type PackageDraft = Pick<CreditPackage, 'stripe_price_id' | 'is_active'>;

export default function AdminDashboardPage() {
	const { user } = useAuth();

	const { data: packagesResult, error: packagesError, mutate: mutatePackages, isLoading: packagesLoading } = useSWR(
		'admin:credit-packages',
		listCreditPackages
	);
	const {
		data: logsResult,
		error: logsError,
		isLoading: logsLoading,
		mutate: mutateLogs
	} = useSWR('admin:low-credit-logs', () => listLowCreditLogs(50));

	const [drafts, setDrafts] = useState<Record<string, PackageDraft>>({});
	const [savingId, setSavingId] = useState<string | null>(null);
	const [packageMessage, setPackageMessage] = useState<string | null>(null);
	const [emailStatus, setEmailStatus] = useState<{ message: string; variant: 'success' | 'error' } | null>(null);
	const [emailLoading, setEmailLoading] = useState(false);

	const canEditPackages = Boolean(packagesResult?.available && WRITE_ENABLED);

	const packages = packagesResult?.data ?? [];
	const logs = logsResult?.data ?? [];
	const lowCreditLogs = logsResult?.data as LowCreditLog[] | undefined;

	const effectivePackages = useMemo(() => {
		if (!packages) return [];
		return packages.map((pkg) => ({
			...pkg,
			...drafts[pkg.id]
		}));
	}, [packages, drafts]);

	const handleDraftChange = (id: string, changes: Partial<PackageDraft>) => {
		setDrafts((prev) => ({
			...prev,
			[id]: {
				stripe_price_id: changes.stripe_price_id ?? prev[id]?.stripe_price_id ?? packages.find((p) => p.id === id)?.stripe_price_id ?? '',
				is_active: changes.is_active ?? prev[id]?.is_active ?? packages.find((p) => p.id === id)?.is_active ?? false
			}
		}));
	};

	const handleRevert = (id: string) => {
		setDrafts((prev) => {
			const copy = { ...prev };
			delete copy[id];
			return copy;
		});
		setPackageMessage(null);
	};

	const handleSave = async (pkg: CreditPackage) => {
		if (!canEditPackages) return;
		setSavingId(pkg.id);
		setPackageMessage(null);
		const patch = drafts[pkg.id] ?? {
			stripe_price_id: pkg.stripe_price_id,
			is_active: pkg.is_active
		};
		const next = {
			stripe_price_id: patch.stripe_price_id ?? pkg.stripe_price_id,
			is_active: typeof patch.is_active === 'boolean' ? patch.is_active : pkg.is_active
		};

		const optimisticPackages = packages.map((p) => (p.id === pkg.id ? { ...p, ...next } : p));
		mutatePackages({ available: packagesResult?.available ?? true, data: optimisticPackages }, false);
		try {
			const result = await updateCreditPackage(pkg.id, next);
			if (!result.available) {
				setPackageMessage('Write endpoints are not available. Showing read-only data.');
				handleRevert(pkg.id);
				return;
			}
			if (!result.ok) {
				throw new Error(result.message ?? 'Update failed');
			}
			setPackageMessage('Package updated.');
			setDrafts((prev) => {
				const copy = { ...prev };
				delete copy[pkg.id];
				return copy;
			});
			void mutatePackages();
		} catch (error) {
			setPackageMessage(error instanceof Error ? error.message : String(error));
			void mutatePackages();
		} finally {
			setSavingId(null);
		}
	};

	const handleSendTestEmail = async () => {
		setEmailLoading(true);
		setEmailStatus(null);
		const result = await sendTestEmail();
		if (!result.available) {
			setEmailStatus({ message: 'Endpoint unavailable', variant: 'error' });
			setEmailLoading(false);
			return;
		}
		if (!result.ok) {
			setEmailStatus({ message: result.message ?? 'Failed to send test email', variant: 'error' });
		} else {
			setEmailStatus({ message: result.message ?? 'Test email queued', variant: 'success' });
		}
		setEmailLoading(false);
	};

	if (!isAdmin(user)) {
		return (
			<div className="mx-auto mt-20 max-w-lg rounded border border-white/10 bg-white/5 p-6 text-center text-white">
				<h1 className="text-2xl font-semibold">403 — Admins only</h1>
				<p className="mt-2 text-sm text-zinc-400">You don’t have permission to view this dashboard.</p>
				<a href="/dashboard" className="mt-4 inline-block rounded border border-white/20 px-3 py-2 text-sm text-white">
					Back to dashboard
				</a>
			</div>
		);
	}

	return (
		<div className="space-y-6 px-6 py-8 text-white">
			<header className="space-y-2">
				<h1 className="text-3xl font-semibold">Admin Dashboard</h1>
				<p className="text-sm text-zinc-400">Manage credit packages, monitor low-credit alerts, and trigger test emails.</p>
			</header>

			<section className="space-y-4 rounded border border-white/10 bg-white/5 p-6">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<div>
						<h2 className="text-xl font-semibold">Credit packages</h2>
						<p className="text-sm text-zinc-400">Activate or edit Stripe prices so users can purchase credits.</p>
					</div>
					<button onClick={() => void mutatePackages()} className="rounded border border-white/20 px-3 py-1 text-sm hover:bg-white/10">
						Refresh
					</button>
				</div>
				{(!packagesResult?.available || !WRITE_ENABLED) && (
					<div className="rounded border border-amber-400/40 bg-amber-500/10 p-3 text-sm text-amber-200">
						Admin writes disabled. Enable PATCH/PUT endpoints and set NEXT_PUBLIC_ADMIN_WRITE_ENABLED=true to edit in-app.
					</div>
				)}
				{packageMessage ? (
					<div className="rounded border border-white/20 bg-white/10 p-3 text-sm text-white" aria-live="polite">
						{packageMessage}
					</div>
				) : null}
				{packagesLoading ? (
					<div className="rounded border border-white/10 bg-white/5 p-6 text-sm text-zinc-400">Loading packages…</div>
				) : packagesError ? (
					<div className="rounded border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">Failed to load packages.</div>
				) : packages.length === 0 ? (
					<div className="rounded border border-white/10 bg-white/5 p-6 text-sm text-zinc-400">
						<p>No packages found.</p>
						<p className="mt-2 text-xs text-zinc-500">Create one in Stripe, map the price ID, then mark is_active in /admin/credit-packages.</p>
					</div>
				) : (
					<div className="overflow-x-auto">
						<table className="min-w-full text-sm">
							<thead className="bg-white/10 text-left text-xs uppercase text-zinc-400">
								<tr>
									<th className="px-3 py-2">Name</th>
									<th className="px-3 py-2">Credits</th>
									<th className="px-3 py-2">Price</th>
									<th className="px-3 py-2">Stripe price ID</th>
									<th className="px-3 py-2">Active</th>
									<th className="px-3 py-2 text-right">Actions</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-white/10">
								{effectivePackages.map((pkg) => {
									const draft = drafts[pkg.id];
									const original = packages.find((p) => p.id === pkg.id);
									const stripeChanged =
										draft?.stripe_price_id !== undefined && draft.stripe_price_id !== original?.stripe_price_id;
									const activeChanged =
										draft?.is_active !== undefined && draft.is_active !== original?.is_active;
									const dirty = Boolean(stripeChanged || activeChanged);
									const disabled = !canEditPackages || savingId === pkg.id;

									return (
										<tr key={pkg.id}>
											<td className="px-3 py-2">{pkg.name}</td>
											<td className="px-3 py-2">{pkg.credits}</td>
											<td className="px-3 py-2">{formatMoney(pkg.price_minor, 'USD')}</td>
											<td className="px-3 py-2">
												<input
													value={pkg.stripe_price_id ?? ''}
													disabled={disabled}
													onChange={(event) =>
														handleDraftChange(pkg.id, { stripe_price_id: event.target.value })
													}
													className="w-full rounded border border-white/20 bg-black/30 px-2 py-1 text-white focus:outline-none focus:ring-1 focus:ring-white disabled:opacity-50"
												/>
											</td>
											<td className="px-3 py-2">
												<input
													type="checkbox"
													checked={pkg.is_active}
													disabled={disabled}
													onChange={(event) => handleDraftChange(pkg.id, { is_active: event.target.checked })}
													className="h-4 w-4 accent-violet-500 disabled:opacity-50"
													aria-label={`Toggle ${pkg.name}`}
												/>
											</td>
											<td className="px-3 py-2 text-right">
												<div className="flex justify-end gap-2">
													<button
														onClick={() => handleRevert(pkg.id)}
														disabled={disabled || !dirty}
														className="rounded border border-white/20 px-2 py-1 text-xs hover:bg-white/10 disabled:opacity-50"
													>
														Revert
													</button>
													<button
														onClick={() => void handleSave(pkg)}
														disabled={disabled || !dirty}
														className="rounded bg-white px-2 py-1 text-xs font-semibold text-black disabled:opacity-50"
													>
														{savingId === pkg.id ? 'Saving…' : 'Save'}
													</button>
												</div>
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				)}
			</section>

			<section className="space-y-4 rounded border border-white/10 bg-white/5 p-6">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<div>
						<h2 className="text-xl font-semibold">Daily low-credit job</h2>
						<p className="text-sm text-zinc-400">Monitor the alert job and trigger it manually if needed.</p>
					</div>
					<div className="flex gap-2">
						<button onClick={() => void mutateLogs()} className="rounded border border-white/20 px-3 py-1 text-sm hover:bg-white/10">
							Refresh
						</button>
						<button
							onClick={async () => {
								try {
									const response = await fetch('/api/admin/low-credit/run', { method: 'POST' });
									if (!response.ok) {
										throw new Error(await response.text());
									}
									setPackageMessage('Job triggered.');
									void mutateLogs();
								} catch (error) {
									setPackageMessage(error instanceof Error ? error.message : String(error));
								}
							}}
							className="rounded border border-white/20 px-3 py-1 text-sm hover:bg-white/10"
						>
							Run now
						</button>
					</div>
				</div>
				{logsError ? (
					<div className="rounded border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
						Logs endpoint not available; server job may still exist.
					</div>
				) : logsLoading ? (
					<div className="rounded border border-white/10 bg-white/5 p-6 text-sm text-zinc-400">Loading logs…</div>
				) : lowCreditLogs?.length ? (
					<div className="overflow-x-auto">
						<table className="min-w-full text-sm">
							<thead className="bg-white/10 text-left text-xs uppercase text-zinc-400">
								<tr>
									<th className="px-3 py-2">Time</th>
									<th className="px-3 py-2">User</th>
									<th className="px-3 py-2">Credits</th>
									<th className="px-3 py-2">Status</th>
									<th className="px-3 py-2">Message</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-white/10">
								{lowCreditLogs.map((log) => (
									<tr key={log.id}>
										<td className="px-3 py-2 text-zinc-300">{new Date(log.created_at).toLocaleString()}</td>
										<td className="px-3 py-2 text-zinc-400">{log.email ?? log.user_id}</td>
										<td className="px-3 py-2 text-zinc-300">
											{log.credits_before ?? '—'} → {log.credits_after ?? '—'}
										</td>
										<td className="px-3 py-2 text-xs capitalize">
											{log.status}
										</td>
										<td className="px-3 py-2 text-zinc-400">{log.message ?? '—'}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				) : (
					<p className="text-sm text-zinc-400">No low-credit logs yet.</p>
				)}
			</section>

			<section className="space-y-4 rounded border border-white/10 bg-white/5 p-6">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<div>
						<h2 className="text-xl font-semibold">Low-credit logs</h2>
						<p className="text-sm text-zinc-400">Recent notifications sent by the daily job.</p>
					</div>
					<button onClick={() => void mutateLogs()} className="rounded border border-white/20 px-3 py-1 text-sm hover:bg-white/10">
						Refresh
					</button>
				</div>
				{logsLoading ? (
					<div className="rounded border border-white/10 bg-white/5 p-6 text-sm text-zinc-400">Loading logs…</div>
				) : logsError ? (
					<div className="rounded border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">Failed to load logs.</div>
				) : !logsResult?.available ? (
					<div className="rounded border border-white/10 bg-white/5 p-6 text-sm text-zinc-400">
						Server job exists but no logs endpoint; run the job directly to inspect output.
					</div>
				) : logs.length === 0 ? (
					<div className="rounded border border-white/10 bg-white/5 p-6 text-sm text-zinc-400">
						No low-credit alerts have been sent yet.
					</div>
				) : (
					<div className="overflow-x-auto">
						<table className="min-w-full text-sm">
							<thead className="bg-white/10 text-left text-xs uppercase text-zinc-400">
								<tr>
									<th className="px-3 py-2">Time</th>
									<th className="px-3 py-2">User</th>
									<th className="px-3 py-2">Credits</th>
									<th className="px-3 py-2">Status</th>
									<th className="px-3 py-2">Message</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-white/10">
								{logs.map((log: AdminLowCreditLog) => (
									<tr key={log.id}>
										<td className="px-3 py-2 text-zinc-300">{new Date(log.created_at).toLocaleString()}</td>
										<td className="px-3 py-2 text-zinc-400">{log.email ?? log.user_id}</td>
										<td className="px-3 py-2 text-zinc-300">
											{log.credits_before ?? '—'} → {log.credits_after ?? '—'}
										</td>
										<td className="px-3 py-2 text-sm capitalize">
											<span
												className={`rounded-full px-2 py-1 text-xs ${
													log.status === 'sent'
														? 'bg-green-100 text-green-700'
														: log.status === 'skipped'
															? 'bg-amber-100 text-amber-700'
															: 'bg-red-100 text-red-600'
												}`}
											>
												{log.status}
											</span>
										</td>
										<td className="px-3 py-2 text-zinc-400">{log.message ?? '—'}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</section>

			<section className="space-y-3 rounded border border-white/10 bg-white/5 p-6">
				<h2 className="text-xl font-semibold">Test email</h2>
				<p className="text-sm text-zinc-400">Send yourself the default transactional email to make sure delivery works.</p>
				<button
					onClick={() => void handleSendTestEmail()}
					disabled={emailLoading}
					className="rounded bg-white px-3 py-2 text-sm font-semibold text-black disabled:opacity-50"
				>
					{emailLoading ? 'Sending…' : 'Send test email'}
				</button>
				{emailStatus ? (
					<p
						className={`text-sm ${
							emailStatus.variant === 'success' ? 'text-green-300' : 'text-red-300'
						}`}
						aria-live="polite"
					>
						{emailStatus.message}
					</p>
				) : null}
			</section>
		</div>
	);
}


