'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { jfetch } from '@/lib/api';
import { formatMoney } from '@/lib/money';
import type { Balance, CreditPackage } from '@/lib/types.billing';

type PackagesResponse = {
	packages: {
		id: string;
		name: string;
		credits_amount: number;
		price_usd: number;
		stripe_price_id?: string | null;
		is_active?: boolean | null;
	}[];
};

type StatusMessageProps = {
	variant: 'success' | 'cancelled';
};

function StatusMessage({ variant }: StatusMessageProps) {
	const copy =
		variant === 'success'
			? 'Payment successful. Your credits will appear shortly.'
			: 'Checkout canceled. You can try again at any time.';
	const colorClasses =
		variant === 'success'
			? 'border-green-500/40 bg-green-500/10 text-green-200'
			: 'border-yellow-500/40 bg-yellow-500/10 text-yellow-200';
	return <div className={`rounded border ${colorClasses} p-3 text-sm`}>{copy}</div>;
}

const packageFetcher = async () => {
	const response = await jfetch<PackagesResponse>('/api/credit-packages');
	return response.packages.map<CreditPackage>((pkg) => ({
		id: pkg.id,
		name: pkg.name,
		credits: pkg.credits_amount,
		price_minor: Math.round((pkg.price_usd ?? 0) * 100),
		stripe_price_id: pkg.stripe_price_id ?? '',
		is_active: pkg.is_active ?? true
	}));
};

const balanceFetcher = async () => {
	try {
		const data = await jfetch<{ balance: number }>('/api/billing/balance');
		const balance: Balance = { credits: data.balance };
		return balance;
	} catch {
		return null;
	}
};

export default function BillingCreditsPage() {
	const searchParams = useSearchParams();
	const statusParam = searchParams?.get('status');

	const {
		data: packages,
		error: packagesError,
		isLoading: packagesLoading,
		mutate: refreshPackages
	} = useSWR<CreditPackage[]>('billing:credit-packages', packageFetcher);

	const {
		data: balance,
		isLoading: balanceLoading,
		mutate: refreshBalance
	} = useSWR<Balance | null>('billing:balance', balanceFetcher);

	const [pendingId, setPendingId] = useState<string | null>(null);
	const [errors, setErrors] = useState<Record<string, string | null>>({});

	const handlePurchase = async (pkg: CreditPackage) => {
		setPendingId(pkg.id);
		setErrors((prev) => ({ ...prev, [pkg.id]: null }));
		try {
			const response = await fetch('/api/checkout/credits', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				redirect: 'manual',
				body: JSON.stringify({ packageId: pkg.id, priceId: pkg.stripe_price_id })
			});

			if (response.status >= 300 && response.status < 400) {
				const location = response.headers.get('Location');
				if (location) {
					window.location.assign(location);
					return;
				}
			}

			if (response.ok) {
				const contentType = response.headers.get('Content-Type') ?? '';
				if (contentType.includes('application/json')) {
					const json = (await response.json()) as { url?: string };
					if (json.url) {
						window.location.assign(json.url);
						return;
					}
				}
				if (response.redirected && response.url) {
					window.location.assign(response.url);
					return;
				}
				throw new Error('Checkout response missing redirect URL.');
			}

			const payload = (await response.json().catch(() => ({}))) as { error?: string };
			throw new Error(payload.error ?? 'Checkout failed');
		} catch (error) {
			setErrors((prev) => ({
				...prev,
				[pkg.id]: error instanceof Error ? error.message : String(error)
			}));
		} finally {
			setPendingId(null);
		}
	};

	const retryPackages = () => {
		void refreshPackages();
		void refreshBalance();
	};

	const hasPackages = Boolean(packages && packages.length > 0);
	const adminTip = !packagesLoading && !packagesError && !hasPackages;

	return (
		<div className="mx-auto flex max-w-5xl gap-6 px-6 py-8 text-white">
			<div className="flex-1 space-y-4">
				<div>
					<h1 className="text-2xl font-semibold">Buy credits</h1>
					<p className="text-sm text-zinc-400">
						Choose a package and complete checkout in Stripe test mode. Credits are granted once payment
						succeeds.
					</p>
				</div>
				{statusParam === 'success' && <StatusMessage variant="success" />}
				{statusParam === 'cancelled' && <StatusMessage variant="cancelled" />}
				{packagesLoading ? (
					<div className="grid gap-4 md:grid-cols-2">
						{Array.from({ length: 2 }).map((_, idx) => (
							<div key={idx} className="animate-pulse rounded border border-white/10 bg-white/5 p-4">
								<div className="h-5 w-1/3 rounded bg-white/20" />
								<div className="mt-2 h-4 w-24 rounded bg-white/10" />
								<div className="mt-6 h-8 w-1/2 rounded bg-white/20" />
							</div>
						))}
					</div>
				) : packagesError ? (
					<div className="rounded border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
						Failed to load packages.{' '}
						<button onClick={retryPackages} className="underline">
							Try again
						</button>
					</div>
				) : !hasPackages ? (
					<div className="rounded border border-white/10 bg-white/5 p-6 text-center text-sm text-zinc-400">
						<p>No credit packages are currently available.</p>
						{adminTip ? (
							<p className="mt-3 text-amber-200">
								Admin tip: enable at least one package with a valid Stripe price in /admin/credit-packages.
							</p>
						) : null}
					</div>
				) : (
					<div className="grid gap-4 md:grid-cols-2">
						{packages?.map((pkg) => {
							const pricePerCredit =
								pkg.credits > 0 ? pkg.price_minor / pkg.credits / 100 : undefined;
							return (
								<div key={pkg.id} className="flex flex-col rounded border border-white/10 bg-white/5 p-4">
									<div>
										<h2 className="text-lg font-semibold">{pkg.name}</h2>
										<p className="text-sm text-zinc-400">{pkg.credits} credits</p>
									</div>
									<div className="mt-4">
										<p className="text-2xl font-semibold">{formatMoney(pkg.price_minor, 'USD')}</p>
										{pricePerCredit !== undefined ? (
											<p className="text-xs text-zinc-400">
												≈ {formatMoney(Math.round(pricePerCredit * 100), 'USD')} per credit
											</p>
										) : null}
									</div>
									<button
										onClick={() => void handlePurchase(pkg)}
										disabled={pendingId === pkg.id}
										className="mt-4 rounded bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:opacity-60"
									>
										{pendingId === pkg.id ? 'Redirecting…' : 'Buy now'}
									</button>
									{errors[pkg.id] ? (
										<p className="mt-2 text-xs text-red-400">{errors[pkg.id]}</p>
									) : null}
								</div>
							);
						})}
					</div>
				)}
			</div>
			<aside className="w-full max-w-sm space-y-4">
				<div className="rounded border border-white/10 bg-white/5 p-4">
					<h3 className="text-lg font-semibold">Your balance</h3>
					{balanceLoading ? (
						<p className="mt-2 animate-pulse text-zinc-400">Loading…</p>
					) : balance ? (
						<p className="mt-2 text-3xl font-semibold">{balance.credits}</p>
					) : (
						<p className="mt-2 text-3xl font-semibold">—</p>
					)}
					<Link href="/billing/invoices" className="mt-4 inline-block text-sm text-blue-200 hover:underline">
						View invoice history
					</Link>
				</div>
				<div className="rounded border border-white/10 bg-white/5 p-4 text-sm text-zinc-400">
					<p>
						Need Stripe test data? Use <code>4242 4242 4242 4242</code> with any future expiration and CVC
						123. Check the dashboard for real invoices after checkout.
					</p>
				</div>
			</aside>
		</div>
	);
}

