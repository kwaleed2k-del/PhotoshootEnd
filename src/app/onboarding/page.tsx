'use client';

import useSWR from 'swr';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { jfetch } from '@/lib/api';

type CreditPackage = {
	id: string;
	name: string;
	credits_amount: number;
	price_usd: number;
};

type CreditPackagesResponse = {
	packages: CreditPackage[];
};

type InvoiceListResponse = {
	items: { id: string; number: string | null }[];
	has_more: boolean;
	next_cursor: string | null;
};

type BalanceResponse = {
	balance: number;
};

const studioLinks = [
	{ href: '/studios/product', label: 'Product Studio', available: false },
	{ href: '/studios/apparel', label: 'Apparel Studio', available: false }
];

export default function OnboardingPage() {
	const { user } = useAuth();

	const {
		data: packageData,
		error: packageError,
		isLoading: packagesLoading,
		mutate: refreshPackages
	} = useSWR<CreditPackagesResponse>('credit-packages', () => jfetch('/api/credit-packages'));

	const {
		data: invoicesData,
		error: invoicesError,
		isLoading: invoicesLoading,
		mutate: refreshInvoices
	} = useSWR<InvoiceListResponse>('invoices:count', () => jfetch('/api/billing/invoices?limit=1'));

	const {
		data: balanceData,
		error: balanceError,
		isLoading: balanceLoading,
		mutate: refreshBalance
	} = useSWR<BalanceResponse>('billing:balance', () => jfetch('/api/billing/balance'));

	const packages = packageData?.packages ?? [];
	const invoiceCount = invoicesData?.items.length ?? 0;
	const balance = typeof balanceData?.balance === 'number' ? balanceData.balance : null;

	const handleRefresh = () => {
		void refreshPackages();
		void refreshInvoices();
		void refreshBalance();
	};

	const adminTipNeeded = !packagesLoading && packages.length === 0;

	const checklist = [
		{
			title: 'Account created',
			description: 'You are signed in and ready to go.',
			complete: Boolean(user),
			cta: null
		},
		{
			title: 'Choose a credit package',
			description: 'Activate at least one credit package so you can make purchases.',
			complete: packages.length > 0,
			cta: packages.length > 0
				? { label: 'Buy credits', href: '/billing/credits' }
				: { label: 'Open credits admin', href: '/admin/credit-packages' }
		},
		{
			title: 'Make your first checkout',
			description: 'Complete a Stripe checkout to unlock invoices and credits.',
			complete: invoiceCount > 0,
			cta: invoiceCount > 0 ? null : { label: 'Go to credits', href: '/billing/credits' }
		},
		{
			title: 'Explore the studios',
			description: 'Jump into the product or apparel studio to start creating.',
			complete: false,
			cta: { label: 'Open studios', href: '/studios/product', disabled: true }
		}
	];

	return (
		<div className="space-y-6 text-white">
			<div className="flex flex-col gap-4 rounded border border-white/10 bg-white/5 p-6">
				<div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
					<div>
						<h1 className="text-2xl font-semibold">Welcome to Lenci</h1>
						<p className="text-sm text-zinc-400">Use this checklist to finish your first-run setup.</p>
					</div>
					<button
						onClick={handleRefresh}
						className="self-start rounded border border-white/20 px-4 py-2 text-sm hover:bg-white/10"
					>
						Refresh data
					</button>
				</div>
				{adminTipNeeded ? (
					<div className="rounded border border-amber-400/40 bg-amber-500/10 p-3 text-sm text-amber-200">
						<strong>Admin tip:</strong> No active credit packages. Visit `/admin/credit-packages`, toggle
						<i> is_active</i>, and add a valid Stripe price to enable purchases.
					</div>
				) : null}
				<ul className="space-y-3">
					{checklist.map((item) => (
						<li key={item.title} className="flex items-start gap-3 rounded border border-white/10 p-3">
							<div
								className={`mt-1 flex h-6 w-6 items-center justify-center rounded-full border ${
									item.complete
										? 'border-green-400 bg-green-500/20 text-green-200'
										: 'border-white/30 bg-black/40 text-white'
								}`}
							>
								{item.complete ? '✓' : '○'}
							</div>
							<div className="flex-1">
								<p className="font-medium">{item.title}</p>
								<p className="text-sm text-zinc-400">{item.description}</p>
							</div>
							{item.cta ? (
								item.cta.disabled ? (
									<span className="rounded border border-white/10 px-3 py-1 text-xs text-zinc-500" title="Coming soon">
										Coming soon
									</span>
								) : (
									<Link
										href={item.cta.href}
										className="rounded border border-white/20 px-3 py-1 text-xs text-white hover:bg-white/10"
									>
										{item.cta.label}
									</Link>
								)
							) : null}
						</li>
					))}
				</ul>
			</div>

			<div className="grid gap-4 md:grid-cols-2">
				<section className="rounded border border-white/10 bg-white/5 p-4">
					<h2 className="text-lg font-semibold">Your account</h2>
					<p className="mt-1 text-sm text-zinc-400">Signed in as {user?.email ?? 'unknown'}.</p>
					<p className="mt-2 text-sm text-zinc-400">User ID: {user?.id ?? '—'}</p>
				</section>

				<section className="rounded border border-white/10 bg-white/5 p-4">
					<h2 className="text-lg font-semibold">Credits</h2>
					{balanceLoading ? (
						<p className="mt-2 animate-pulse text-zinc-400">Loading balance…</p>
					) : balanceError ? (
						<p className="mt-2 text-sm text-red-400">Unable to load balance.</p>
					) : (
						<p className="mt-2 text-3xl font-semibold">{balance !== null ? balance : '—'}</p>
					)}
					<Link href="/billing/credits" className="mt-4 inline-block rounded bg-white/10 px-3 py-2 text-sm">
						Buy credits
					</Link>
				</section>

				<section className="rounded border border-white/10 bg-white/5 p-4">
					<h2 className="text-lg font-semibold">Invoices</h2>
					{invoicesLoading ? (
						<p className="mt-2 animate-pulse text-zinc-400">Loading invoices…</p>
					) : invoicesError ? (
						<p className="mt-2 text-sm text-red-400">Unable to load invoices.</p>
					) : (
						<p className="mt-2 text-3xl font-semibold">{invoiceCount}</p>
					)}
					<Link href="/billing/invoices" className="mt-4 inline-block rounded bg-white/10 px-3 py-2 text-sm">
						View invoices
					</Link>
				</section>

				<section className="rounded border border-white/10 bg-white/5 p-4">
					<h2 className="text-lg font-semibold">Credit packages</h2>
					{packagesLoading ? (
						<p className="mt-2 animate-pulse text-zinc-400">Loading packages…</p>
					) : packageError ? (
						<p className="mt-2 text-sm text-red-400">Unable to load packages.</p>
					) : packages.length > 0 ? (
						<p className="mt-2 text-sm text-zinc-300">{packages.length} active package(s) available.</p>
					) : (
						<p className="mt-2 text-sm text-zinc-400">No active packages yet.</p>
					)}
					<Link href="/billing/credits" className="mt-4 inline-block rounded bg-white/10 px-3 py-2 text-sm">
						Open billing
					</Link>
				</section>
			</div>

			<div className="grid gap-4 sm:grid-cols-2">
				{studioLinks.map((studio) => (
					<button
						key={studio.href}
						disabled={!studio.available}
						title={studio.available ? undefined : 'Coming soon'}
						className={`rounded border border-white/10 px-4 py-6 text-left transition ${
							studio.available ? 'hover:bg-white/10' : 'opacity-50'
						}`}
					>
						<p className="text-lg font-semibold">{studio.label}</p>
						<p className="mt-1 text-sm text-zinc-400">
							{studio.available ? 'Jump in and start creating.' : 'Coming soon.'}
						</p>
					</button>
				))}
			</div>
		</div>
	);
}


