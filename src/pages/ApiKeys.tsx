import React, { useState } from 'react';
import { usePlan } from '../hooks/usePlan';
import { useApiKeys } from '../hooks/useApiKeys';
import { ApiKeyCreateDialog } from '../components/api/ApiKeyCreateDialog';
import { ApiKeysTable } from '../components/api/ApiKeysTable';
import { ApiKeyUsageNote } from '../components/api/ApiKeyUsageNote';

export default function ApiKeysPage() {
	const { code, features } = usePlan();
	const { keys, loading, error, createKey, revokeKey } = useApiKeys();
	const [busy, setBusy] = useState(false);

	const handleRevoke = async (id: string) => {
		setBusy(true);
		try {
			await revokeKey(id);
		} catch {
			// errors handled in hook state
		} finally {
			setBusy(false);
		}
	};

	const disabled = !features.api_access;

	return (
		<div className="min-h-screen bg-zinc-950 text-white">
			<div className="max-w-5xl mx-auto px-6 py-12 space-y-6">
				<header className="space-y-2">
					<h1 className="text-3xl font-semibold">API Keys</h1>
					<p className="text-sm text-zinc-400">
						Generate and manage programmatic access. Keys inherit your current plan ({code}).
					</p>
				</header>

				{disabled && (
					<div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-200">
						API access is not available on the Free plan. Upgrade to Starter or Professional to
						enable API keys.
						<a href="/pricing" className="ml-2 underline text-amber-100">
							View pricing
						</a>
					</div>
				)}

				{error && (
					<div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
						{error}
					</div>
				)}

				<section className="space-y-4">
					<ApiKeyCreateDialog disabled={disabled} onCreate={createKey} />
					{loading ? (
						<div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-6 text-sm text-zinc-400">
							Loading keys…
						</div>
					) : (
						<ApiKeysTable keys={keys} onRevoke={handleRevoke} disabled={busy || disabled} />
					)}
				</section>

				<ApiKeyUsageNote />
			</div>
		</div>
	);
}


