import React, { useState, useEffect } from 'react';
import { useBillingHistory, type CreditTransaction, type UsageEvent } from '../../hooks/useBillingHistory';
import { X, Filter } from 'lucide-react';

interface CreditHistoryModalProps {
	userId: string;
	isOpen: boolean;
	onClose: () => void;
}

type TabType = 'credits' | 'usage';

const DAY_FILTERS = [
	{ label: 'Last 7 days', days: 7 },
	{ label: 'Last 30 days', days: 30 },
	{ label: 'Last 90 days', days: 90 },
] as const;

const getDeltaColor = (delta: number): string => {
	return delta > 0 ? 'text-green-400' : 'text-red-400';
};

const formatDate = (dateString: string): string => {
	return new Date(dateString).toLocaleDateString('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
	});
};

export const CreditHistoryModal: React.FC<CreditHistoryModalProps> = ({
	userId,
	isOpen,
	onClose,
}) => {
	const [activeTab, setActiveTab] = useState<TabType>('credits');
	const [daysFilter, setDaysFilter] = useState<number>(30);
	const [limitFilter, setLimitFilter] = useState<number>(50);

	const { from, to, credits, usage, loading, error, refresh } = useBillingHistory({
		days: daysFilter,
		limit: limitFilter,
	});

	useEffect(() => {
		if (isOpen) {
			refresh();
		}
	}, [isOpen, daysFilter, limitFilter, refresh]);

	if (!isOpen) return null;

	return (
		<div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
			<div className="bg-zinc-900 rounded-lg border border-white/10 w-full max-w-3xl max-h-[80vh] flex flex-col">
				{/* Header */}
				<div className="flex items-center justify-between p-4 border-b border-white/10">
					<h2 className="text-lg font-semibold text-white">Billing History</h2>
					<button
						onClick={onClose}
						className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
					>
						<X size={20} />
					</button>
				</div>

				{/* Filters */}
				<div className="p-4 border-b border-white/10 space-y-3">
					<div className="flex items-center gap-4">
						<div className="flex items-center gap-2">
							<Filter size={16} className="text-zinc-400" />
							<span className="text-sm text-zinc-400">Period:</span>
							<select
								value={daysFilter}
								onChange={(e) => setDaysFilter(Number.parseInt(e.target.value, 10))}
								className="px-3 py-1 bg-zinc-800 border border-white/10 rounded text-sm text-zinc-300 focus:outline-none focus:border-violet-500"
							>
								{DAY_FILTERS.map((filter) => (
									<option key={filter.label} value={filter.days}>
										{filter.label}
									</option>
								))}
							</select>
						</div>

						<div className="flex items-center gap-2">
							<span className="text-sm text-zinc-400">Limit:</span>
							<select
								value={limitFilter}
								onChange={(e) => setLimitFilter(Number.parseInt(e.target.value, 10))}
								className="px-3 py-1 bg-zinc-800 border border-white/10 rounded text-sm text-zinc-300 focus:outline-none focus:border-violet-500"
							>
								<option value={10}>10</option>
								<option value={25}>25</option>
								<option value={50}>50</option>
								<option value={100}>100</option>
								<option value={200}>200</option>
							</select>
						</div>
					</div>
				</div>

				{/* Tabs */}
				<div className="flex border-b border-white/10">
					<button
						onClick={() => setActiveTab('credits')}
						className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
							activeTab === 'credits'
								? 'text-violet-400 border-b-2 border-violet-400'
								: 'text-zinc-400 hover:text-zinc-200'
						}`}
					>
						Credits ({credits.length})
					</button>
					<button
						onClick={() => setActiveTab('usage')}
						className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
							activeTab === 'usage'
								? 'text-violet-400 border-b-2 border-violet-400'
								: 'text-zinc-400 hover:text-zinc-200'
						}`}
					>
						Usage ({usage.length})
					</button>
				</div>

				{/* Content */}
				<div className="flex-1 overflow-y-auto p-4">
					{error && (
						<div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded text-sm text-red-400">
							{error}
							<button
								onClick={() => refresh()}
								className="ml-2 text-xs underline hover:text-red-300"
							>
								Retry
							</button>
						</div>
					)}

					{loading ? (
						<div className="text-center py-8">
							<div className="animate-pulse text-zinc-400">Loading history...</div>
						</div>
					) : activeTab === 'credits' ? (
						credits.length === 0 ? (
							<div className="text-center py-8">
								<p className="text-zinc-400 text-sm">No credit transactions found</p>
							</div>
						) : (
							<div className="space-y-2">
								{credits.map((tx) => (
									<div
										key={tx.id}
										className="flex items-center justify-between p-3 bg-zinc-800/50 rounded border border-white/5 hover:border-white/10 transition-colors"
									>
										<div className="flex-1">
											<div className="flex items-center gap-3">
												<span className={`text-sm font-medium ${getDeltaColor(tx.delta)}`}>
													{tx.delta > 0 ? '+' : ''}
													{tx.delta}
												</span>
												<span className="text-xs text-zinc-500">{formatDate(tx.created_at)}</span>
											</div>
											{tx.reason && (
												<p className="text-xs text-zinc-400 mt-1">{tx.reason}</p>
											)}
										</div>
									</div>
								))}
							</div>
						)
					) : activeTab === 'usage' ? (
						usage.length === 0 ? (
							<div className="text-center py-8">
								<p className="text-zinc-400 text-sm">No usage events found</p>
							</div>
						) : (
							<div className="space-y-2">
								{usage.map((event) => (
									<div
										key={event.id}
										className="flex items-center justify-between p-3 bg-zinc-800/50 rounded border border-white/5 hover:border-white/10 transition-colors"
									>
										<div className="flex-1">
											<div className="flex items-center gap-3">
												<span className="text-sm font-medium text-red-400">
													-{event.cost}
												</span>
												<span className="text-xs text-zinc-400">{event.event_type}</span>
												<span className="text-xs text-zinc-500">{formatDate(event.created_at)}</span>
											</div>
											<div className="flex items-center gap-2 mt-1">
												{event.tokens !== null && (
													<span className="text-xs text-zinc-500">Tokens: {event.tokens}</span>
												)}
												{event.request_id && (
													<span className="text-xs text-zinc-500">
														ID: {event.request_id.slice(0, 8)}...
													</span>
												)}
											</div>
										</div>
									</div>
								))}
							</div>
						)
					) : null}
				</div>
			</div>
		</div>
	);
};
