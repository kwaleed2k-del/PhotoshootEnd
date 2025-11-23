'use client';

import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { isAdmin } from '@/lib/roles';
import { jfetch } from '@/lib/api';
import type { ApiCatalogEntry, ApiProbeResult } from '@/lib/types.console';
import { API_UI_MAP } from '@/config/apiCatalog';

type CatalogResponse = {
	items: ApiCatalogEntry[];
};

const PROBE_TIMEOUT_MS = 3000;

export default function ApiCatalogPage() {
	const { user } = useAuth();
	const { data, error, isLoading, mutate } = useSWR<CatalogResponse>('admin:api-catalog', () => jfetch('/api/_catalog'));
	const [probeResults, setProbeResults] = useState<Record<string, ApiProbeResult[]>>({});
	const [filter, setFilter] = useState<'all' | 'failures' | 'no-ui'>('all');

	useEffect(() => {
		if (!data?.items) return;
		void probeAll(data.items).then((results) => setProbeResults(results));
	}, [data?.items]);

	const filteredItems = useMemo(() => {
		if (!data?.items) return [];
		return data.items.filter((item) => {
			if (filter === 'failures') {
				const results = probeResults[item.path];
				return results?.some((r) => !r.ok) ?? true;
			}
			if (filter === 'no-ui') {
				return !API_UI_MAP[item.path];
			}
			return true;
		});
	}, [data?.items, filter, probeResults]);

	if (!isAdmin(user)) {
		return (
			<div className="mx-auto mt-16 max-w-xl rounded border border-white/10 bg-white/5 p-6 text-center text-white">
				<h1 className="text-2xl font-semibold">403 — Admins only</h1>
				<p className="mt-2 text-sm text-zinc-400">You don’t have access to the API catalog.</p>
				<Link href="/dashboard" className="mt-4 inline-block rounded border border-white/20 px-4 py-2 text-sm text-white">
					Back to dashboard
				</Link>
			</div>
		);
	}

	const handleProbe = async (entry: ApiCatalogEntry) => {
		const results = await probePaths([entry]);
		setProbeResults((prev) => ({ ...prev, ...results }));
	};

	const handleProbeAll = async () => {
		if (!data?.items) return;
		const results = await probePaths(data.items);
		setProbeResults(results);
	};

	const getStatusLabel = (path: string, method: 'GET' | 'HEAD') => {
		const result = probeResults[path]?.find((r) => r.method === method);
		if (!result) return '—';
		if (result.status === 'timeout') return 'timeout';
		if (result.status === 'network') return 'network';
		return result.status;
	};

	const getLatencyLabel = (path: string) => {
		const result = probeResults[path];
		if (!result || result.length === 0) return '—';
		const max = Math.max(...result.map((r) => r.ms));
		return `${max} ms`;
	};

	return (
		<div className="space-y-6 px-6 py-8 text-white">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div>
					<h1 className="text-3xl font-semibold">API catalog</h1>
					<p className="text-sm text-zinc-400">Auto-discovered endpoints with probe status and UI coverage.</p>
				</div>
				<div className="flex gap-2">
					<button
						onClick={() => void mutate()}
						className="rounded border border-white/20 px-3 py-1 text-sm hover:bg-white/10"
					>
						Refresh list
					</button>
					<button
						onClick={handleProbeAll}
						className="rounded border border-white/20 px-3 py-1 text-sm hover:bg-white/10"
					>
						Re-probe all
					</button>
				</div>
			</div>

			<div className="flex gap-2 text-sm">
				<button
					onClick={() => setFilter('all')}
					className={`rounded px-3 py-1 ${filter === 'all' ? 'bg-white text-black' : 'border border-white/20'}`}
				>
					All
				</button>
				<button
					onClick={() => setFilter('failures')}
					className={`rounded px-3 py-1 ${
						filter === 'failures' ? 'bg-white text-black' : 'border border-white/20'
					}`}
				>
					Failures
				</button>
				<button
					onClick={() => setFilter('no-ui')}
					className={`rounded px-3 py-1 ${filter === 'no-ui' ? 'bg-white text-black' : 'border border-white/20'}`}
				>
					No UI surface
				</button>
			</div>

			{isLoading ? (
				<div className="rounded border border-white/10 bg-white/5 p-6 text-sm text-zinc-400">Discovering APIs…</div>
			) : error ? (
				<div className="rounded border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">Failed to load catalog.</div>
			) : (
				<div className="overflow-x-auto rounded border border-white/10 bg-white/5">
					<table className="min-w-full text-sm">
						<thead className="bg-white/10 text-left text-xs uppercase text-zinc-400">
							<tr>
								<th className="px-3 py-2">Path</th>
								<th className="px-3 py-2">Methods</th>
								<th className="px-3 py-2">UI Surface</th>
								<th className="px-3 py-2">GET</th>
								<th className="px-3 py-2">HEAD</th>
								<th className="px-3 py-2">Latency</th>
								<th className="px-3 py-2 text-right">Actions</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-white/10 text-white">
							{filteredItems.map((item) => {
								const ui = API_UI_MAP[item.path];
								const results = probeResults[item.path];
								const hasFailure = results?.some((r) => !r.ok);
								return (
									<tr key={item.path} className={hasFailure ? 'bg-red-500/5' : undefined}>
										<td className="px-3 py-2 font-mono text-xs">{item.path}</td>
										<td className="px-3 py-2">
											{item.methods?.length ? item.methods.join(', ') : <span className="text-zinc-400">—</span>}
										</td>
										<td className="px-3 py-2">
											{ui ? (
												<Link href={ui.href} className="text-xs text-blue-300 hover:underline">
													{ui.label}
												</Link>
											) : (
												<span className="text-xs text-amber-300">No UI mapped</span>
											)}
										</td>
										<td className="px-3 py-2 text-xs">{getStatusLabel(item.path, 'GET')}</td>
										<td className="px-3 py-2 text-xs">{getStatusLabel(item.path, 'HEAD')}</td>
										<td className="px-3 py-2 text-xs">{getLatencyLabel(item.path)}</td>
										<td className="px-3 py-2 text-right">
											<button
												onClick={() => void handleProbe(item)}
												className="rounded border border-white/20 px-3 py-1 text-xs hover:bg-white/10"
											>
												Re-probe
											</button>
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			)}
		</div>
	);
}

async function probeAll(items: ApiCatalogEntry[]) {
	const results = await probePaths(items);
	return results;
}

async function probePaths(entries: ApiCatalogEntry[]) {
	const resultMap: Record<string, ApiProbeResult[]> = {};
	await Promise.all(
		entries.map(async (entry) => {
			const probes: ApiProbeResult[] = [];
			for (const method of ['GET', 'HEAD'] as const) {
				probes.push(await probeEndpoint(entry.path, method));
			}
			resultMap[entry.path] = probes;
		})
	);
	return resultMap;
}

async function probeEndpoint(path: string, method: 'GET' | 'HEAD'): Promise<ApiProbeResult> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
	const start = performance.now();
	try {
		const response = await fetch(path, {
			method,
			credentials: 'include',
			signal: controller.signal
		});
		const ms = Math.round(performance.now() - start);
		clearTimeout(timer);
		return {
			path,
			method,
			status: response.status,
			ms,
			ok: response.ok
		};
	} catch (error) {
		clearTimeout(timer);
		const ms = Math.round(performance.now() - start);
		if ((error as Error).name === 'AbortError') {
			return { path, method, status: 'timeout', ms, ok: false };
		}
		return { path, method, status: 'network', ms, ok: false };
	}
}


