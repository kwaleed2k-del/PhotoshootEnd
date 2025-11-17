import React, { useState } from 'react';
import { usePlan } from '../hooks/usePlan';
import { PricingCards } from '../components/billing/PricingCards';
import { startCheckout, openPortal } from '../client/billingClient';

export default function Pricing() {
	const { code, loading, error } = usePlan();
	const [redirecting, setRedirecting] = useState<'starter' | 'professional' | null>(null);
	const [portalLoading, setPortalLoading] = useState(false);
	const [actionError, setActionError] = useState<string | null>(null);

	const handleUpgrade = async (plan: 'starter' | 'professional') => {
		try {
			setActionError(null);
			setRedirecting(plan);
			await startCheckout(plan);
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			setActionError(message);
			setRedirecting(null);
		}
	};

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

	return (
		<div className="min-h-screen bg-zinc-950 text-white">
			<div className="max-w-5xl mx-auto px-6 py-12 space-y-6">
				<div>
					<h1 className="text-3xl font-semibold">Pricing</h1>
					<p className="text-zinc-400 mt-2">
						Flexible plans for creators at every stage. Upgrade instantly, no long-term commitment.
					</p>
				</div>

				{loading ? (
					<div className="rounded-xl border border-white/10 bg-zinc-900/60 p-6 animate-pulse text-zinc-400">
						Loading your plan…
					</div>
				) : (
					<>
						{(error || actionError) && (
							<div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
								{actionError ?? error}
							</div>
						)}
						<PricingCards
							currentCode={code}
							onUpgrade={handleUpgrade}
							onPortal={portalLoading ? undefined : handlePortal}
							loadingPlan={redirecting}
						/>
						{portalLoading && (
							<p className="text-sm text-zinc-400 text-right">Opening Stripe portal…</p>
						)}
					</>
				)}
			</div>
		</div>
	);
}


