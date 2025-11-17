import React, { useState, useEffect } from 'react';
import { supabase } from '../../../services/supabaseClient';
import { isLowCredit } from '../../utils/credits';
import { CreditHistoryModal } from './CreditHistoryModal';
import { useCreditBalance } from '../../hooks/useCreditBalance';
import { AlertCircle, DollarSign, History, RefreshCw } from 'lucide-react';

interface UserPlanData {
  subscription_plan: string;
  subscription_status: string;
}

interface CreditBalanceProps {
  userId?: string; // Optional - will fetch from auth session if not provided
}

const PLAN_NAMES: Record<string, string> = {
  free: 'Free',
  starter: 'Starter',
  professional: 'Professional',
  enterprise: 'Enterprise',
};

const PLAN_COLORS: Record<string, string> = {
  free: 'text-zinc-400',
  starter: 'text-blue-400',
  professional: 'text-purple-400',
  enterprise: 'text-gold-400',
};

export const CreditBalance: React.FC<CreditBalanceProps> = ({ userId: propUserId }) => {
  const [planData, setPlanData] = useState<UserPlanData | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(propUserId || null);
  const { balance, loading, error, refresh } = useCreditBalance();

  // Get user ID from auth session if not provided
  useEffect(() => {
    const getUserId = async () => {
      if (propUserId) {
        setCurrentUserId(propUserId);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
      }
    };
    getUserId();
  }, [propUserId]);

  // Fetch plan info separately (could be added to balance API later)
  useEffect(() => {
    const fetchPlanInfo = async () => {
      if (!currentUserId) return;

      try {
        const { data, error: fetchError } = await supabase
          .from('users')
          .select('subscription_plan, subscription_status')
          .eq('id', currentUserId)
          .single();

        if (!fetchError && data) {
          setPlanData(data);
        }
      } catch (err) {
        console.error('Error fetching plan info:', err);
      }
    };

    if (currentUserId) {
      fetchPlanInfo();
    }
  }, [currentUserId]);

  const handleRefresh = async () => {
    await refresh();
  };

  const planName = planData ? PLAN_NAMES[planData.subscription_plan] || planData.subscription_plan : null;
  const planColor = planData ? PLAN_COLORS[planData.subscription_plan] || 'text-zinc-400' : 'text-zinc-400';
  const lowCredit = balance !== null ? isLowCredit(balance) : false;

  if (loading) {
    return (
      <div className="bg-zinc-900 rounded-lg border border-white/10 p-4">
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-zinc-700 rounded w-1/3"></div>
          <div className="h-6 bg-zinc-700 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-zinc-900 rounded-lg border border-red-500/20 p-4">
        <p className="text-sm text-red-400">Error loading balance: {error}</p>
        <button
          onClick={handleRefresh}
          className="mt-2 text-xs text-zinc-400 hover:text-zinc-200 underline"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="bg-zinc-900 rounded-lg border border-white/10 p-4 space-y-3">
        {/* Plan Badge */}
        {planName && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-400">Plan</span>
            <span className={`text-sm font-semibold ${planColor}`}>{planName}</span>
          </div>
        )}

        {/* Credit Balance */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign size={16} className="text-violet-400" />
            <span className="text-xs text-zinc-400">Credits</span>
          </div>
          <span className="text-lg font-bold text-white">{balance !== null ? balance : '—'}</span>
        </div>

        {/* Low Credit Warning */}
        {lowCredit && (
          <div className="flex items-center gap-2 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded text-xs text-yellow-400">
            <AlertCircle size={14} />
            <span>Low credits remaining</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2 border-t border-white/10">
          <button
            onClick={() => setShowHistory(true)}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-xs text-zinc-300 transition-colors"
          >
            <History size={14} />
            View History
          </button>
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="p-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-zinc-400 hover:text-zinc-200 transition-colors disabled:opacity-50"
            title="Refresh balance"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Purchase Credits CTA */}
        <a
          href="/billing/credits"
          className="block w-full text-center px-3 py-2 bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium rounded transition-colors"
        >
          Purchase Credits
        </a>
      </div>

      {/* History Modal */}
      {showHistory && currentUserId && (
        <CreditHistoryModal
          userId={currentUserId}
          isOpen={showHistory}
          onClose={() => setShowHistory(false)}
        />
      )}
    </>
  );
};

