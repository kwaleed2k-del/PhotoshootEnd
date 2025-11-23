'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { useAuth } from '@/components/AuthProvider';
import { getMe, patchMe } from '@/lib/userApi';
import { clearSnooze, getSnoozeUntil, getThreshold, setThreshold, snooze } from '@/lib/alertPrefs';
import type { Me } from '@/lib/types.user';

const receiptsPrefKey = 'pref:email_receipts';

function useReceiptsPref() {
	const [enabled, setEnabled] = useState<boolean>(() => {
		if (typeof window === 'undefined') return true;
		const stored = window.localStorage.getItem(receiptsPrefKey);
		return stored === null ? true : stored === 'true';
	});

	const toggle = (next: boolean) => {
		setEnabled(next);
		if (typeof window !== 'undefined') {
			window.localStorage.setItem(receiptsPrefKey, String(next));
		}
	};

	return { enabled, toggle };
}

export default function SettingsPage() {
	const { supabase } = useAuth();
	const {
		data: me,
		error,
		isLoading,
		mutate
	} = useSWR<Me>('user:me', getMe);

	const [pending, setPending] = useState(false);
	const [banner, setBanner] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
	const [readOnly, setReadOnly] = useState(false);

	const [profileDraft, setProfileDraft] = useState<{ display_name: string }>({ display_name: '' });
	const [billingDraft, setBillingDraft] = useState<{ billing_email: string; email: string; expanded: boolean }>({
		billing_email: '',
		email: '',
		expanded: false
	});

	const { enabled: receiptsEnabled, toggle: toggleReceipts } = useReceiptsPref();
	const [threshold, setThresholdState] = useState(() => getThreshold());
	const [snoozeLabel, setSnoozeLabel] = useState(() => {
		const until = getSnoozeUntil();
		return until ? until.toLocaleString() : 'Not snoozed';
	});
	const handleThresholdChange = (value: number) => {
		setThreshold(value);
		setThresholdState(value);
		setBanner({ message: 'Threshold saved', type: 'success' });
	};

	const handleSnooze24 = () => {
		snooze(24);
		const until = getSnoozeUntil();
		setSnoozeLabel(until ? until.toLocaleString() : 'Snoozed');
		setBanner({ message: 'Alerts snoozed for 24h', type: 'success' });
	};

	const handleClearSnooze = () => {
		clearSnooze();
		setSnoozeLabel('Not snoozed');
		setBanner({ message: 'Snooze cleared', type: 'success' });
	};

	if (isLoading) {
		return <div className="px-6 py-10 text-zinc-400">Loading settings…</div>;
	}

	if (error || !me) {
		return (
			<div className="px-6 py-10 text-red-300">
				Failed to load settings. Please refresh or contact support.
			</div>
		);
	}

	const displayName = profileDraft.display_name || (profileDraft.display_name === '' ? '' : me.display_name ?? '');
	const billingEmail =
		billingDraft.billing_email || (billingDraft.billing_email === '' ? '' : me.billing_email ?? '');
	const loginEmail = billingDraft.email || (billingDraft.email === '' ? '' : me.email);

	const profileDirty = displayName !== (me.display_name ?? '');
	const billingDirty =
		billingEmail !== (me.billing_email ?? '') || (billingDraft.expanded && loginEmail !== me.email);

	const handleProfileSave = async () => {
		setPending(true);
		setBanner(null);
		try {
			const { me: next } = await patchMe({ display_name: displayName });
			setProfileDraft({ display_name: next.display_name ?? '' });
			setReadOnly(false);
			setBanner({ message: 'Profile updated', type: 'success' });
			void mutate();
		} catch (error) {
			if (error instanceof Error && error.message.includes('not available')) {
				setReadOnly(true);
			}
			setBanner({ message: error instanceof Error ? error.message : String(error), type: 'error' });
		} finally {
			setPending(false);
		}
	};

	const handleBillingSave = async () => {
		setPending(true);
		setBanner(null);
		try {
			const payload: { billing_email?: string; email?: string } = {};
			if (billingEmail !== (me.billing_email ?? '')) payload.billing_email = billingEmail || null;
			if (billingDraft.expanded && loginEmail !== me.email) payload.email = loginEmail;
			const { me: next, message } = await patchMe(payload);
			setBillingDraft({
				billing_email: next.billing_email ?? '',
				email: next.email,
				expanded: billingDraft.expanded
			});
			setBanner({ message: message ?? 'Billing details updated', type: 'success' });
			setReadOnly(false);
			void mutate();
		} catch (error) {
			if (error instanceof Error && error.message.includes('not available')) {
				setReadOnly(true);
			}
			setBanner({ message: error instanceof Error ? error.message : String(error), type: 'error' });
		} finally {
			setPending(false);
		}
	};

	const handleLogout = async () => {
		await supabase.auth.signOut();
		window.location.href = '/login';
	};

	return (
		<div className="space-y-6 px-6 py-8 text-white">
			<header className="space-y-2">
				<h1 className="text-3xl font-semibold">Settings</h1>
				<p className="text-sm text-zinc-400">Update your profile, billing email, and notification preferences.</p>
			</header>
			{readOnly ? (
				<div className="rounded border border-amber-400/40 bg-amber-500/10 p-3 text-sm text-amber-200">
					Read-only mode: backend write endpoint not configured. Metadata changes will sync via Supabase where possible.
				</div>
			) : null}
			{banner ? (
				<div
					className={`rounded border p-3 text-sm ${
						banner.type === 'success'
							? 'border-green-500/40 bg-green-500/10 text-green-200'
							: 'border-red-500/40 bg-red-500/10 text-red-200'
					}`}
					aria-live="polite"
				>
					{banner.message}
				</div>
			) : null}

			<div className="grid gap-4 lg:grid-cols-2">
				<section className="space-y-4 rounded border border-white/10 bg-white/5 p-6">
					<h2 className="text-xl font-semibold">Credits alerts</h2>
					<label className="block text-sm text-zinc-300">
						Low-credit threshold
						<input
							type="number"
							min={1}
							max={1000}
							value={threshold}
							onChange={(event) => handleThresholdChange(Number(event.target.value))}
							className="mt-1 w-full rounded border border-white/20 bg-black/30 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-white"
						/>
					</label>
					<p className="text-xs text-zinc-500">Current snooze status: {snoozeLabel}</p>
					<div className="flex gap-2 text-sm">
						<button onClick={handleSnooze24} className="rounded border border-white/20 px-3 py-2 text-white hover:bg-white/10">
							Snooze 24h
						</button>
						<button onClick={handleClearSnooze} className="rounded border border-white/20 px-3 py-2 text-white hover:bg-white/10">
							Clear snooze
						</button>
					</div>
				</section>
				<section className="space-y-4 rounded border border-white/10 bg-white/5 p-6">
					<h2 className="text-xl font-semibold">Profile</h2>
					<div className="flex items-center gap-3">
						<div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-lg font-semibold">
							{(me.display_name ?? me.email).charAt(0).toUpperCase()}
						</div>
						<div className="text-sm text-zinc-400">{me.email}</div>
					</div>
					<label className="block text-sm text-zinc-300">
						Display name
						<input
							type="text"
							value={displayName}
							onChange={(event) => setProfileDraft({ display_name: event.target.value })}
							className="mt-1 w-full rounded border border-white/20 bg-black/30 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-white"
						/>
					</label>
					<div className="flex gap-2">
						<button
							disabled={!profileDirty || pending}
							onClick={handleProfileSave}
							className="rounded bg-white px-3 py-2 text-sm font-semibold text-black disabled:opacity-40"
						>
							Save
						</button>
						<button
							disabled={!profileDirty || pending}
							onClick={() => setProfileDraft({ display_name: me.display_name ?? '' })}
							className="rounded border border-white/20 px-3 py-2 text-sm text-white disabled:opacity-40"
						>
							Revert
						</button>
					</div>
				</section>

				<section className="space-y-4 rounded border border-white/10 bg-white/5 p-6">
					<h2 className="text-xl font-semibold">Billing & notifications</h2>
					<label className="block text-sm text-zinc-300">
						Billing email
						<input
							type="email"
							placeholder={me.email}
							value={billingEmail}
							onChange={(event) => setBillingDraft((prev) => ({ ...prev, billing_email: event.target.value }))}
							className="mt-1 w-full rounded border border-white/20 bg-black/30 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-white"
						/>
					</label>
					<div className="flex items-center gap-3 text-sm text-zinc-300">
						<input
							type="checkbox"
							checked={receiptsEnabled}
							onChange={(event) => toggleReceipts(event.target.checked)}
							className="h-4 w-4 accent-violet-500"
							id="email-receipts"
						/>
						<label htmlFor="email-receipts">Email me receipts for each purchase</label>
					</div>
					<div>
						<button
							onClick={() => setBillingDraft((prev) => ({ ...prev, expanded: !prev.expanded, email: me.email }))}
							className="text-xs text-blue-300 hover:underline"
						>
							{billingDraft.expanded ? 'Hide login email change' : 'Change login email'}
						</button>
						{billingDraft.expanded ? (
							<label className="mt-2 block text-sm text-zinc-300">
								Login email
								<input
									type="email"
									value={loginEmail}
									onChange={(event) => setBillingDraft((prev) => ({ ...prev, email: event.target.value }))}
									className="mt-1 w-full rounded border border-white/20 bg-black/30 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-white"
								/>
							</label>
						) : null}
						<p className="mt-2 text-xs text-zinc-500">
							If you change your login email, Supabase will send a confirmation link.
						</p>
					</div>
					<div className="flex gap-2">
						<button
							disabled={!billingDirty || pending}
							onClick={handleBillingSave}
							className="rounded bg-white px-3 py-2 text-sm font-semibold text-black disabled:opacity-40"
						>
							Save
						</button>
						<button
							disabled={!billingDirty || pending}
							onClick={() =>
								setBillingDraft({ billing_email: me.billing_email ?? '', email: me.email, expanded: billingDraft.expanded })
							}
							className="rounded border border-white/20 px-3 py-2 text-sm text-white disabled:opacity-40"
						>
							Revert
						</button>
					</div>
				</section>
			</div>

			<div className="grid gap-4 lg:grid-cols-2">
				<section className="space-y-3 rounded border border-white/10 bg-white/5 p-6">
					<h2 className="text-xl font-semibold">Security</h2>
					<p className="text-sm text-zinc-400">Manage authentication and sign out of all sessions.</p>
					<div className="flex gap-3">
						<a
							href="/login?mode=reset"
							className="rounded border border-white/20 px-3 py-2 text-sm text-white hover:bg-white/10"
						>
							Change password
						</a>
						<button
							onClick={handleLogout}
							className="rounded bg-white px-3 py-2 text-sm font-semibold text-black"
						>
							Sign out
						</button>
					</div>
				</section>

				<section className="space-y-2 rounded border border-white/10 bg-white/5 p-6 text-sm text-zinc-300">
					<h2 className="text-xl font-semibold text-white">Account info</h2>
					<div className="flex justify-between border-b border-white/10 py-2">
						<span>User ID</span>
						<span className="text-white">{me.id}</span>
					</div>
					<div className="flex justify-between border-b border-white/10 py-2">
						<span>Primary email</span>
						<span className="text-white">{me.email}</span>
					</div>
					<div className="flex justify-between border-b border-white/10 py-2">
						<span>Billing email</span>
						<span className="text-white">{me.billing_email ?? '—'}</span>
					</div>
					<div className="flex justify-between py-2">
						<span>Stripe customer ID</span>
						<span className="text-white">{me.stripe_customer_id ?? '—'}</span>
					</div>
				</section>
			</div>
		</div>
	);
}


