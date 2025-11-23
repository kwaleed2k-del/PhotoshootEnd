'use client';

import type { ReactNode } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { isAdmin } from '@/lib/roles';
import { LowCreditBanner } from '@/components/billing/LowCreditBanner';

export function AppShell({ children }: { children: ReactNode }) {
	const { user, supabase, loading } = useAuth();

	const handleLogout = async () => {
		await supabase.auth.signOut();
		window.location.href = '/login';
	};

	const initials = user?.email?.charAt(0)?.toUpperCase() ?? 'U';

	return (
		<div className="min-h-screen bg-black text-white">
			{user ? (
				<nav className="flex items-center justify-between border-b border-white/10 px-6 py-4 text-sm">
					<a href="/" className="font-semibold tracking-tight">
						Lenci Studio
					</a>
					<div className="flex flex-wrap items-center gap-4 text-zinc-300">
						<a href="/dashboard" className="hover:text-white">
							Dashboard
						</a>
						<a href="/onboarding" className="hover:text-white">
							Onboarding
						</a>
						<a href="/settings" className="hover:text-white">
							Settings
						</a>
						<a href="/studios/product" className="hover:text-white">
							Studios · Product
						</a>
						<a href="/studios/apparel" className="hover:text-white">
							Studios · Apparel
						</a>
						{isAdmin(user) ? (
							<a href="/admin" className="hover:text-white">
								Admin
							</a>
						) : null}
						{isAdmin(user) ? (
							<a href="/admin/emails" className="hover:text-white">
								Emails
							</a>
						) : null}
						{isAdmin(user) ? (
							<a href="/admin/api-catalog" className="text-sm text-zinc-300 hover:text-white">
								Dev · API Catalog
							</a>
						) : null}
					</div>
					<div className="flex items-center gap-3">
						<div className="hidden text-zinc-300 sm:block">{user.email}</div>
						<div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-xs font-semibold">
							{initials}
						</div>
						<button
							onClick={handleLogout}
							className="rounded border border-white/20 px-3 py-1 text-xs text-white transition hover:bg-white/10"
						>
							Logout
						</button>
					</div>
				</nav>
			) : null}
			<main className="mx-auto w-full max-w-4xl px-6 py-8">
				{user ? <LowCreditBanner /> : null}
				{children}
			</main>
		</div>
	);
}


