'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { useAuth } from '@/components/AuthProvider';
import { isAdmin } from '@/lib/roles';
import { jfetch } from '@/lib/api';
import { formatMoney } from '@/lib/money';
import { getMe } from '@/lib/userApi';

const balanceFetcher = async () => {
	try {
		const res = await jfetch<{ balance: number }>('/api/billing/balance');
		return res.balance;
	} catch {
		return null;
	}
};

const packagesFetcher = async () => {
	try {
		const res = await jfetch<{ packages: { is_active?: boolean }[] }>('/api/credit-packages');
		return res.packages ?? [];
	} catch {
		return null;
	}
};

const invoicesPeekFetcher = async () => {
	try {
		const res = await jfetch<{ items: unknown[] }>('/api/billing/invoices?limit=1');
		return res.items?.length ?? 0;
	} catch {
		return null;
	}
};

const lowCreditFetcher = async () => {
	try {
		const res = await jfetch<{ logs: { created_at: string }[] }>('/api/admin/low-credit/logs?limit=1');
		return res.logs?.[0]?.created_at ?? null;
	} catch {
		return null;
	}
};

export default function DashboardPage() {
	const { user } = useAuth();

	const { data: balance, isLoading: balanceLoading, error: balanceError } = useSWR('console:balance', balanceFetcher);
	const {
		data: packages,
		isLoading: packagesLoading,
		error: packagesError
	} = useSWR('console:packages', packagesFetcher);
	const { data: invoicePeek, isLoading: invoicesLoading, error: invoicesError } = useSWR(
		'console:invoices:peek',
		invoicesPeekFetcher
	);
	const { data: lowCreditTs } = useSWR('console:lowcredit:last', lowCreditFetcher);
	const { data: meData } = useSWR('user:me', getMe);

	const activePackages =
		packages?.filter((pkg) => pkg.is_active ?? true).length ?? (packages === null ? null : 0);

	const quickLinks = [
		{ href: '/onboarding', label: 'Onboarding' },
		{ href: '/settings', label: 'Settings' },
		{ href: '/billing/credits', label: 'Credits' },
		{ href: '/billing/invoices', label: 'Invoices' },
		...(isAdmin(user) ? [{ href: '/admin', label: 'Admin' }] : [])
	];

	return (
		<div className="space-y-6 px-6 py-8 text-white">
			<header className="space-y-1">
				<h1 className="text-3xl font-semibold">System console</h1>
				<p className="text-sm text-zinc-400">Monitor key billing metrics and jump into core workflows.</p>
			</header>

			<div className="grid gap-4 lg:grid-cols-3">
				<Card title="Credits" loading={balanceLoading} error={balanceError}>
					<p className="text-3xl font-semibold">{balance ?? '—'}</p>
					<Link href="/billing/credits" className="mt-3 inline-block text-sm text-blue-300 hover:underline">
						Buy credits
					</Link>
				</Card>
				<Card title="Invoices" loading={invoicesLoading} error={invoicesError}>
					<p className="text-3xl font-semibold">{invoicePeek ?? '—'}</p>
					<Link href="/billing/invoices" className="mt-3 inline-block text-sm text-blue-300 hover:underline">
						View invoices
					</Link>
				</Card>
				<Card title="Packages" loading={packagesLoading} error={packagesError}>
					<p className="text-3xl font-semibold">
						{activePackages === null ? '—' : `${activePackages} active`}
					</p>
					{isAdmin(user) && activePackages === 0 ? (
						<p className="mt-2 text-xs text-amber-300">Admin tip: enable a package in /admin.</p>
					) : null}
					<Link href="/admin" className="mt-3 inline-block text-sm text-blue-300 hover:underline">
						Manage packages
					</Link>
				</Card>
			</div>

			<div className="grid gap-4 lg:grid-cols-2">
				<section className="rounded border border-white/10 bg-white/5 p-4">
					<h2 className="text-lg font-semibold">Account</h2>
					<ul className="mt-3 text-sm text-zinc-300">
						<li>User ID: {meData?.id ?? user?.id ?? '—'}</li>
						<li>Email: {meData?.email ?? user?.email ?? '—'}</li>
						<li>Stripe customer ID: {meData?.stripe_customer_id ?? '—'}</li>
					</ul>
				</section>
				{isAdmin(user) && (
					<section className="rounded border border-white/10 bg-white/5 p-4">
						<h2 className="text-lg font-semibold">Operations</h2>
						<p className="mt-2 text-sm text-zinc-400">
							Last low-credit job:{' '}
							{lowCreditTs ? new Date(lowCreditTs).toLocaleString() : 'No logs yet'}
						</p>
						<Link href="/admin" className="mt-3 inline-block text-sm text-blue-300 hover:underline">
							Open admin
						</Link>
					</section>
				)}
			</div>

			<section className="rounded border border-white/10 bg-white/5 p-4">
				<h2 className="text-lg font-semibold">Quick actions</h2>
				<div className="mt-3 flex flex-wrap gap-3">
					{quickLinks.map((link) => (
						<Link
							key={link.href}
							href={link.href}
							className="rounded border border-white/20 px-3 py-2 text-sm text-white hover:bg-white/10"
						>
							{link.label}
						</Link>
					))}
				</div>
			</section>
		</div>
	);
}

function Card({
	title,
	children,
	loading,
	error
}: {
	title: string;
	children: React.ReactNode;
	loading?: boolean;
	error?: unknown;
}) {
	return (
		<section className="rounded border border-white/10 bg-white/5 p-4">
			<h2 className="text-lg font-semibold">{title}</h2>
			{loading ? (
				<p className="mt-2 animate-pulse text-sm text-zinc-400">Loading…</p>
			) : error ? (
				<p className="mt-2 text-sm text-red-400">Unavailable</p>
			) : (
				<div className="mt-2">{children}</div>
			)}
		</section>
	);
}
