import React from 'react';

export const UI_PLANS = {
	free: { name: 'Free', price: 0, credits: 10, api: false, watermark: true },
	starter: { name: 'Starter', price: 29, credits: 100, api: false, watermark: false },
	professional: { name: 'Professional', price: 99, credits: 500, api: true, watermark: false },
	enterprise: { name: 'Enterprise', price: null, credits: null, api: true, watermark: false }
} as const;

type PlanKey = keyof typeof UI_PLANS;

interface PricingCardsProps {
	currentCode?: PlanKey;
	onUpgrade?: (code: 'starter' | 'professional') => void;
	onPortal?: () => void;
	loadingPlan?: PlanKey | null;
}

const order: PlanKey[] = ['free', 'starter', 'professional', 'enterprise'];

export function PricingCards({ currentCode, onUpgrade, onPortal, loadingPlan }: PricingCardsProps) {
	return (
		<div className="space-y-4">
			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
				{order.map((code) => {
					const plan = UI_PLANS[code];
					const isCurrent = currentCode === code;
					const isEnterprise = code === 'enterprise';
					const isPaid = code === 'starter' || code === 'professional';
					const isLoading = loadingPlan === code;

					return (
						<div
							key={code}
							className={`rounded-2xl border border-white/10 bg-zinc-900/50 p-5 flex flex-col gap-4 ${
								isCurrent ? 'ring-1 ring-violet-400/40' : ''
							}`}
						>
							<div>
								<p className="text-sm text-zinc-400">{plan.name}</p>
								<div className="mt-2 flex items-baseline gap-1">
									{plan.price === null ? (
										<span className="text-2xl font-semibold text-white">Custom</span>
									) : (
										<>
											<span className="text-2xl font-semibold text-white">${plan.price}</span>
											<span className="text-sm text-zinc-400">/mo</span>
										</>
									)}
								</div>
								<p className="text-xs text-zinc-500 mt-1">
									{plan.credits === null ? 'Unlimited credits' : `${plan.credits} credits / month`}
								</p>
							</div>

							<ul className="space-y-1 text-sm text-zinc-300">
								<li className="flex items-center gap-2">
									<span className={`text-xs font-semibold ${plan.api ? 'text-emerald-400' : 'text-red-400'}`}>
										{plan.api ? '✓' : '✗'}
									</span>
									API access
								</li>
								<li className="flex items-center gap-2">
									<span className={`text-xs font-semibold ${plan.watermark ? 'text-amber-400' : 'text-emerald-400'}`}>
										{plan.watermark ? '✓' : '✗'}
									</span>
									Watermarking
								</li>
							</ul>

							<div className="mt-auto">
								{isEnterprise ? (
									<a
										href="mailto:sales@siyada.dev"
										className="w-full inline-flex items-center justify-center rounded-lg border border-white/20 px-3 py-2 text-sm text-white hover:bg-white/10 transition-colors"
									>
										Contact Sales
									</a>
								) : (
									<button
										type="button"
										disabled={isCurrent || (isPaid && !onUpgrade)}
										onClick={() => {
											if (isPaid && onUpgrade) onUpgrade(code);
										}}
										className={`w-full inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
											isCurrent
												? 'bg-zinc-800 text-zinc-400 cursor-default'
												: 'bg-violet-600 text-white hover:bg-violet-500 disabled:bg-zinc-800 disabled:text-zinc-500'
										}`}
									>
										{isCurrent
											? 'Current plan'
											: isLoading
												? 'Redirecting…'
												: `Upgrade to ${plan.name}`}
									</button>
								)}
							</div>
						</div>
					);
				})}
			</div>
			{currentCode && (currentCode === 'starter' || currentCode === 'professional') && onPortal && (
				<div className="text-right">
					<button
						type="button"
						onClick={onPortal}
						className="text-sm text-violet-300 hover:text-violet-200 underline"
					>
						Manage in Stripe
					</button>
				</div>
			)}
		</div>
	);
}


