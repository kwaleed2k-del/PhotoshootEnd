/**
 * Billing Store (Optional)
 * 
 * Zustand store for caching credit balance and transaction history.
 * Reduces redundant API calls.
 */

import { create } from 'zustand';

interface BillingState {
  creditsBalance: number | null;
  lastFetch: number | null;
  setCreditsBalance: (balance: number) => void;
  clearCache: () => void;
}

export const useBillingStore = create<BillingState>((set) => ({
  creditsBalance: null,
  lastFetch: null,
  setCreditsBalance: (balance: number) =>
    set({ creditsBalance: balance, lastFetch: Date.now() }),
  clearCache: () => set({ creditsBalance: null, lastFetch: null }),
}));

