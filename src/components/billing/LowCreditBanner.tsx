import React, { useState } from 'react';
import { useCreditBalance } from '../../hooks/useCreditBalance';
import { AlertCircle, X } from 'lucide-react';

interface LowCreditBannerProps {
	threshold?: number;
}

/**
 * Dismissible banner that appears when credit balance is below threshold.
 * Default threshold is 10 credits.
 */
export const LowCreditBanner: React.FC<LowCreditBannerProps> = ({ threshold = 10 }) => {
	const { balance } = useCreditBalance();
	const [dismissed, setDismissed] = useState(false);

	if (dismissed || balance === null || balance >= threshold) {
		return null;
	}

	return (
		<div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 flex items-center justify-between">
			<div className="flex items-center gap-3">
				<AlertCircle size={20} className="text-yellow-400" />
				<div>
					<p className="text-sm font-medium text-yellow-400">
						Low credits remaining: {balance}
					</p>
					<p className="text-xs text-yellow-400/80 mt-0.5">
						Consider purchasing more credits to continue using the service.
					</p>
				</div>
			</div>
			<div className="flex items-center gap-2">
				<a
					href="/billing"
					className="px-3 py-1.5 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 text-xs font-medium rounded transition-colors"
				>
					Manage Billing
				</a>
				<button
					onClick={() => setDismissed(true)}
					className="p-1 rounded hover:bg-yellow-500/20 text-yellow-400 hover:text-yellow-300 transition-colors"
					title="Dismiss"
				>
					<X size={16} />
				</button>
			</div>
		</div>
	);
};

