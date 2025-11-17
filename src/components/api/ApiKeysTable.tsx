import React from 'react';
import type { KeyRow } from '../../hooks/useApiKeys';

interface Props {
	keys: KeyRow[];
	onRevoke: (id: string) => Promise<void>;
	disabled?: boolean;
}

const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

function formatRelative(iso: string | null): string {
	if (!iso) return '—';
	const date = new Date(iso);
	const diffMs = date.getTime() - Date.now();
	const diffMinutes = Math.round(diffMs / (60 * 1000));
	const absMinutes = Math.abs(diffMinutes);
	if (absMinutes < 60) return rtf.format(diffMinutes, 'minute');
	const diffHours = Math.round(diffMinutes / 60);
	if (Math.abs(diffHours) < 24) return rtf.format(diffHours, 'hour');
	const diffDays = Math.round(diffHours / 24);
	return rtf.format(diffDays, 'day');
}

export function ApiKeysTable({ keys, onRevoke, disabled }: Props) {
	const handleRevoke = async (id: string, revoked: boolean) => {
		if (revoked) return;
		if (!window.confirm('Revoke this API key? This cannot be undone.')) return;
		await onRevoke(id);
	};

	return (
		<div className="rounded-2xl border border-white/10 bg-zinc-900/60 overflow-hidden">
			<div className="overflow-x-auto">
				<table className="min-w-full text-sm text-zinc-300">
					<thead className="bg-zinc-900 text-left text-xs uppercase tracking-wide text-zinc-500">
						<tr>
							<th className="px-4 py-3">Name</th>
							<th className="px-4 py-3">Prefix</th>
							<th className="px-4 py-3">Status</th>
							<th className="px-4 py-3">Last used</th>
							<th className="px-4 py-3">Created</th>
							<th className="px-4 py-3 text-right">Actions</th>
						</tr>
					</thead>
					<tbody>
						{keys.length === 0 ? (
							<tr>
								<td colSpan={6} className="px-4 py-6 text-center text-zinc-500">
									No API keys yet.
								</td>
							</tr>
						) : (
							keys.map((key) => (
								<tr key={key.id} className="border-t border-white/5">
									<td className="px-4 py-3">{key.name}</td>
									<td className="px-4 py-3 font-mono text-xs">pk_{key.key_prefix}</td>
									<td className="px-4 py-3">
										<span
											className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${
												key.revoked
													? 'bg-red-500/20 text-red-200'
													: 'bg-emerald-500/20 text-emerald-200'
											}`}
										>
											{key.revoked ? 'Revoked' : 'Active'}
										</span>
									</td>
									<td className="px-4 py-3">{formatRelative(key.last_used_at)}</td>
									<td className="px-4 py-3">{new Date(key.created_at).toLocaleString()}</td>
									<td className="px-4 py-3 text-right">
										<button
											type="button"
											className="text-sm text-red-300 hover:text-red-200 disabled:opacity-50"
											onClick={() => handleRevoke(key.id, key.revoked || Boolean(disabled))}
											disabled={key.revoked || disabled}
										>
											Revoke
										</button>
									</td>
								</tr>
							))
						)}
					</tbody>
				</table>
			</div>
			<div className="px-4 py-3 text-xs text-zinc-500 border-t border-white/5">
				Use in requests: <code className="font-mono">Authorization: Bearer pk_&lt;prefix&gt;…</code>
			</div>
		</div>
	);
}


