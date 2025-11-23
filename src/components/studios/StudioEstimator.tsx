'use client';

import { STUDIOS_PRICING } from '@/config/studios';
import type { StudioJobDraft, StudioKind } from '@/lib/types.studios';

type Props = {
	kind: StudioKind;
	draft: StudioJobDraft;
	balance?: number | null;
};

function computeEstimate(kind: StudioKind, draft: StudioJobDraft): number {
	const pricing = STUDIOS_PRICING[kind];
	if (!pricing) return 0;
	const perImage = draft.images_count * pricing.per_image;
	const perVariation = draft.variations * pricing.per_variation;
	return pricing.base + perImage + perVariation;
}

export function StudioEstimator({ kind, draft, balance }: Props) {
	const estimated = computeEstimate(kind, draft);
	const insufficient = typeof balance === 'number' && estimated > balance;

	return (
		<div className="rounded border border-white/10 bg-white/5 p-4 text-sm text-white">
			<div className="flex justify-between">
				<span className="text-zinc-400">Estimated credits</span>
				<span className="text-xl font-semibold">{estimated}</span>
			</div>
			<div className="mt-2 flex justify-between text-zinc-400">
				<span>Current balance</span>
				<span>{typeof balance === 'number' ? balance : '—'}</span>
			</div>
			{insufficient ? (
				<div className="mt-3 rounded border border-amber-400/40 bg-amber-500/10 p-2 text-xs text-amber-200">
					Not enough credits for this run.{' '}
					<a href="/billing/credits" className="underline">
						Buy credits
					</a>
				</div>
			) : null}
		</div>
	);
}


