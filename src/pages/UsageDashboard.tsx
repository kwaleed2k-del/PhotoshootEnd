import React from 'react';
import { UserUsageDashboard } from '../components/analytics/UserUsageDashboard';

export default function UsageDashboard() {
	return (
		<div className="min-h-screen bg-zinc-950 text-white">
			<div className="max-w-6xl mx-auto px-6 py-12 space-y-8">
				<section className="rounded-3xl border border-white/10 bg-gradient-to-r from-violet-600/20 via-blue-500/10 to-transparent px-6 py-8">
					<p className="text-xs uppercase tracking-[0.25em] text-violet-200">Usage</p>
					<div className="mt-3 flex flex-wrap items-center justify-between gap-4">
						<div>
							<h1 className="text-3xl font-semibold">Your generation insights</h1>
							<p className="text-sm text-zinc-200/80">
								Track credits, usage cost, and event activity at a glance.
							</p>
						</div>
						<div className="text-xs text-zinc-300/70">
							Data refreshes each time you load this page. Need more detail? Export from the admin view.
						</div>
					</div>
				</section>

				<UserUsageDashboard />
			</div>
		</div>
	);
}

