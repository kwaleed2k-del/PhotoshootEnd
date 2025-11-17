import React, { useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import { usePlan } from '../hooks/usePlan';
import { useCreditBalance } from '../hooks/useCreditBalance';
import { LowCreditBanner } from '../components/billing/LowCreditBanner';
import { CreditBalance } from '../components/billing/CreditBalance';
import { CreditHistoryModal } from '../components/billing/CreditHistoryModal';
import { openPortal } from '../client/billingClient';
import { InvoicesTable } from '../components/billing/InvoicesTable';
import { useInvoices } from '../hooks/useInvoices';
import { UI_PLANS } from '../components/billing/PricingCards';

export default function BillingSettings() {
	const { code, features, loading, error } = usePlan();
	const { balance } = useCreditBalance();
	const [historyOpen, setHistoryOpen] = useState(false);
	const [userId, setUserId] = useState<string | null>(null);
	const [portalLoading, setPortalLoading] = useState(false);
	const [actionError, setActionError] = useState<string | null>(null);
	const { invoices, loading: invoicesLoading, error: invoicesError, hasMore, loadMore } = useInvoices();

	useEffect(() => {
		void (async () => {
			const { data } = await supabase.auth.getUser();
			setUserId(data.user?.id ?? null);
		})();
	}, []);

	const handlePortal = async () => {
		try {
			setActionError(null);
			setPortalLoading(true);
			await openPortal();
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			setActionError(message);
			setPortalLoading(false);
		}
	};

	const planMeta = UI_PLANS[code] ?? UI_PLANS.free;

	return (
		<div className="min-h-screen bg-zinc-950 text-white">
			<div className="max-w-6xl mx-auto px-6 py-12 space-y-8">
				<section className="rounded-3xl border border-white/10 bg-gradient-to-r from-violet-600/20 via-blue-500/10 to-transparent px-6 py-8">
					<p className="text-xs uppercase tracking-[0.25em] text-violet-200">Billing & Credits</p>
					<div className="mt-3 flex flex-wrap items-center justify-between gap-4">
						<div>
							<h1 className="text-3xl font-semibold">Plan overview</h1>
							<p className="text-sm text-zinc-200/80">
								You’re on the {planMeta.name} plan. Stay on top of credits, invoices, and upgrades.
							</p>
						</div>
						<button
							type="button"
							onClick={handlePortal}
							disabled={portalLoading}
							className="inline-flex items-center justify-center rounded-xl bg-white/90 px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-white disabled:opacity-60"
						>
							{portalLoading ? 'Opening…' : 'Open Stripe Portal'}
						</button>
					</div>
					<div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-sm text-zinc-200/90">
						<div>
							<p className="text-xs text-zinc-300 uppercase tracking-widest">Plan</p>
							<p className="text-lg font-semibold capitalize">{code}</p>
						</div>
						<div>
							<p className="text-xs text-zinc-300 uppercase tracking-widest">Monthly credits</p>
							<p className="text-lg font-semibold">
								{planMeta.credits === null ? 'Unlimited' : planMeta.credits}
							</p>
						</div>
						<div>
							<p className="text-xs text-zinc-300 uppercase tracking-widest">Watermarking</p>
							<p className="text-lg font-semibold">{features.watermarking ? 'On' : 'Off'}</p>
						</div>
						<div>
							<p className="text-xs text-zinc-300 uppercase tracking-widest">Current credits</p>
							<p className="text-lg font-semibold">{balance ?? '—'}</p>
						</div>
					</div>
				</section>

				<LowCreditBanner />

				{(error || actionError) && (
					<div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
						{actionError ?? error}
					</div>
				)}

				<section className="grid gap-4 md:grid-cols-2">
					<div className="rounded-2xl border border-white/10 bg-zinc-900/70 p-6 space-y-4">
						<h3 className="text-sm text-zinc-400">Plan features</h3>
						{loading ? (
							<p className="text-sm text-zinc-500">Loading features…</p>
						) : (
							<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
								<FeatureCard label="API access" enabled={features.api_access} />
								<FeatureCard label="Watermarking" enabled={!features.watermarking} inverse />
							</div>
						)}
						<div className="flex flex-wrap gap-3">
							<button
								type="button"
								onClick={() => setHistoryOpen(true)}
								disabled={!userId}
								className="inline-flex items-center justify-center rounded-lg border border-white/10 px-4 py-2 text-sm text-white hover:bg-white/10 disabled:opacity-50"
							>
								View detailed credit history
							</button>
							<a
								href="/pricing"
								className="inline-flex items-center justify-center rounded-lg border border-white/10 px-4 py-2 text-sm text-white/70 hover:text-white hover:bg-white/10"
							>
								View plans
							</a>
						</div>
					</div>
					<div className="rounded-2xl border border-white/10 bg-zinc-900/70 p-6 space-y-4">
						<h3 className="text-sm text-zinc-400">Credit overview</h3>
						<CreditBalance />
					</div>
				</section>

				<section>
					<InvoicesTable
						invoices={invoices}
						loading={invoicesLoading}
						hasMore={hasMore}
						onLoadMore={loadMore}
						error={invoicesError}
					/>
				</section>

				<section className="rounded-2xl border border-white/10 bg-zinc-900/60 p-6 space-y-4">
					<h3 className="text-lg font-semibold">Monthly credits by plan</h3>
					<div className="grid gap-4 md:grid-cols-2">
						{Object.entries(UI_PLANS).map(([planCode, plan]) => (
							<div
								key={planCode}
								className="rounded-xl border border-white/5 bg-zinc-900/80 p-4 text-sm text-zinc-300"
							>
								<div className="flex items-center justify-between mb-2">
									<span className="font-semibold capitalize">{planCode}</span>
									{plan.price === null ? (
										<span className="text-zinc-400">Custom</span>
									) : (
										<span className="text-zinc-400">${plan.price}/mo</span>
									)}
								</div>
								<p className="text-xs text-zinc-500 mb-2">
									{plan.credits === null ? 'Unlimited credits' : `${plan.credits} credits per month`}
								</p>
								<ul className="text-xs text-zinc-400 space-y-1">
									<li>API access: {plan.api ? 'Yes' : 'No'}</li>
									<li>Watermarking: {plan.watermark ? 'Yes' : 'No'}</li>
								</ul>
							</div>
						))}
					</div>
				</section>
			</div>
			{historyOpen && userId && (
				<CreditHistoryModal userId={userId} isOpen={historyOpen} onClose={() => setHistoryOpen(false)} />
			)}
		</div>
	);
}

function FeatureCard({
	label,
	enabled,
	inverse
}: {
	label: string;
	enabled: boolean;
	inverse?: boolean;
}) {
	const showCheck = inverse ? !enabled : enabled;
	return (
		<div className="flex items-center gap-3 rounded-xl border border-white/10 bg-zinc-900/70 px-4 py-3">
			<span className={`inline-flex items-center justify-center w-6 h-6 rounded-full ${showCheck ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'}`}>
				{showCheck ? <Check size={14} /> : <X size={14} />}
			</span>
			<div>
				<p className="text-sm font-medium text-white">{label}</p>
				<p className="text-xs text-zinc-400">
					{showCheck ? 'Included in your plan' : 'Not included'}
				</p>
			</div>
		</div>
	);
}


