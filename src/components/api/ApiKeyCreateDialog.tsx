import React, { useState } from 'react';
import type { CreatedKey } from '../../hooks/useApiKeys';

interface Props {
	disabled?: boolean;
	onCreate: (name: string) => Promise<CreatedKey>;
}

export function ApiKeyCreateDialog({ disabled, onCreate }: Props) {
	const [open, setOpen] = useState(false);
	const [name, setName] = useState('Default key');
	const [creating, setCreating] = useState(false);
	const [created, setCreated] = useState<CreatedKey | null>(null);
	const [error, setError] = useState<string | null>(null);

	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault();
		if (disabled || creating) return;
		try {
			setError(null);
			setCreating(true);
			const result = await onCreate(name.trim() || 'API Key');
			setCreated(result);
			setOpen(false);
			setName('Default key');
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			setError(message);
		} finally {
			setCreating(false);
		}
	};

	const closeReveal = () => {
		setCreated(null);
	};

	const copyKey = async () => {
		if (!created) return;
		await navigator.clipboard.writeText(created.key);
	};

	return (
		<div className="space-y-3">
			<button
				type="button"
				disabled={disabled}
				onClick={() => setOpen(true)}
				className="inline-flex items-center justify-center rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-60"
			>
				Create API key
			</button>
			{error && <p className="text-sm text-red-400">{error}</p>}

			{open && (
				<div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-4">
					<div className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-900 p-6 space-y-4">
						<div>
							<h3 className="text-lg font-semibold text-white">New API key</h3>
							<p className="text-sm text-zinc-400">
								Name this key to keep track of where it’s used.
							</p>
						</div>
						<form className="space-y-4" onSubmit={handleSubmit}>
							<label className="block text-sm text-zinc-300">
								Key name
								<input
									value={name}
									onChange={(e) => setName(e.target.value)}
									className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none"
									disabled={creating}
								/>
							</label>
							<div className="flex justify-end gap-2">
								<button
									type="button"
									className="rounded-lg border border-white/10 px-4 py-2 text-sm text-white hover:bg-white/10"
									onClick={() => {
										setOpen(false);
										setName('Default key');
									}}
									disabled={creating}
								>
									Cancel
								</button>
								<button
									type="submit"
									disabled={creating}
									className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-60"
								>
									{creating ? 'Creating…' : 'Create'}
								</button>
							</div>
						</form>
					</div>
				</div>
			)}

			{created && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4">
					<div className="w-full max-w-lg rounded-2xl border border-white/10 bg-zinc-900 p-6 space-y-4">
						<div>
							<h3 className="text-lg font-semibold text-white">Copy your API key</h3>
							<p className="text-sm text-amber-300">
								This secret is shown only once. Store it securely.
							</p>
						</div>
						<pre className="rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white overflow-auto">
							{created.key}
						</pre>
						<div className="flex items-center gap-2">
							<button
								type="button"
								onClick={copyKey}
								className="rounded-lg border border-white/10 px-4 py-2 text-sm text-white hover:bg-white/10"
							>
								Copy to clipboard
							</button>
							<button
								type="button"
								onClick={closeReveal}
								className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500"
							>
								I’ve stored it
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}


