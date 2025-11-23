'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { jfetch } from '@/lib/api';
import { getThreshold, setThreshold, getSnoozeUntil, snooze, clearSnooze } from '@/lib/alertPrefs';

const BALANCE_KEY = 'billing:balance';

export function LowCreditBanner() {
	const [editing, setEditing] = useState(false);
	const [localThreshold, setLocalThreshold] = useState<number>(() => getThreshold());
	const snoozeUntil = getSnoozeUntil();

	const { data, error } = useSWR<{ balance: number }>(
		BALANCE_KEY,
		() => jfetch('/api/billing/balance'),
		{
			refreshInterval: 120000,
			revalidateOnFocus: true
		}
	);

	if (error && String(error).includes('404')) {
		return null;
	}

	const balance = data?.balance;
	if (typeof balance !== 'number') {
		return null;
	}

	const threshold = localThreshold;
	const shouldShow = balance < threshold && (!snoozeUntil || snoozeUntil.getTime() < Date.now());
	if (!shouldShow) {
		return null;
	}

	const handleSaveThreshold = () => {
		setThreshold(localThreshold);
		setEditing(false);
	};

	return (
		<div
			role="region"
			aria-live="polite"
			className="mb-4 rounded border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200"
		>
			<div className="flex flex-wrap items-center gap-3">
				<p>
					<span className="font-semibold">Low credits:</span> {balance} credits remaining (threshold {threshold}).
				</p>
				<a href="/billing/credits" className="rounded border border-amber-200/50 px-2 py-1 text-xs text-amber-100 hover:bg-amber-100/10">
					Buy credits
				</a>
				<button
					type="button"
					onClick={() => snooze(24)}
					className="rounded border border-amber-200/50 px-2 py-1 text-xs text-amber-100 hover:bg-amber-100/10"
					aria-label="Snooze low credit alert for 24 hours"
				>
					Snooze 24h
				</button>
				<button
					type="button"
					onClick={() => {
						clearSnooze();
						setEditing((prev) => !prev);
					}}
					className="rounded border border-amber-200/50 px-2 py-1 text-xs text-amber-100 hover:bg-amber-100/10"
				>
					Change threshold
				>
			</div>
			{editing ? (
				<form
					onSubmit={(event) => {
						event.preventDefault();
						handleSaveThreshold();
					}}
					className="mt-3 flex flex-wrap items-center gap-2 text-xs"
				>
					<label className="flex items-center gap-1">
						<span>Threshold</span>
						<input
							type="number"
							min={1}
							max={1000}
							value={localThreshold}
							onChange={(event) => setLocalThreshold(Number(event.target.value))}
							className="w-20 rounded border border-white/30 bg-black/30 px-2 py-1 text-white"
							aria-label="Low credit threshold"
						/>
					</label>
					<button
						type="submit"
						className="rounded border border-white/30 px-2 py-1 text-white hover:bg-white/10"
					>
						Save
					</button>
					<button
						type="button"
						onClick={() => setEditing(false)}
						className="rounded border border-white/30 px-2 py-1 text-white hover:bg-white/10"
					>
						Cancel
					</button>
				</form>
			) : null}
		</div>
	);
}

