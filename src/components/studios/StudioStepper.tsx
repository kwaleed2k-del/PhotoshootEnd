'use client';

import type { ReactNode } from 'react';

type Step = {
	id: string;
	title: string;
};

type StudioStepperProps = {
	steps: Step[];
	active: number;
	onPrev: () => void;
	onNext: () => void;
	onJump?: (index: number) => void;
	children: ReactNode;
};

export function StudioStepper({ steps, active, onPrev, onNext, onJump, children }: StudioStepperProps) {
	return (
		<div className="space-y-4">
			<div className="flex flex-wrap gap-2 text-sm">
				{steps.map((step, index) => {
					const isActive = index === active;
					const isComplete = index < active;
					const canJump = typeof onJump === 'function';
					return (
						<button
							key={step.id}
							type="button"
							onClick={() => canJump && onJump(index)}
							disabled={!canJump}
							className={`flex items-center gap-2 rounded border px-3 py-1 ${
								isActive
									? 'border-white/70 bg-white/10 text-white'
									: isComplete
										? 'border-green-500/70 bg-green-500/10 text-green-200'
										: 'border-white/20 text-zinc-400'
							} ${canJump ? 'cursor-pointer' : 'cursor-default'}`}
						>
							<span className="rounded-full border border-white/40 px-2 py-px text-xs">{index + 1}</span>
							<span>{step.title}</span>
						</button>
					);
				})}
			</div>
			<div className="rounded border border-white/10 bg-white/5 p-4">{children}</div>
			<div className="flex justify-between">
				<button
					type="button"
					onClick={onPrev}
					disabled={active === 0}
					className="rounded border border-white/20 px-4 py-2 text-sm text-white hover:bg-white/10 disabled:opacity-40"
				>
					Back
				</button>
				<button
					type="button"
					onClick={onNext}
					disabled={active === steps.length - 1}
					className="rounded bg-white px-4 py-2 text-sm font-semibold text-black disabled:opacity-40"
				>
					Next
				</button>
			</div>
		</div>
	);
}


