/**
 * Billing Overview Page (Demo)
 * 
 * Demo page showing the credit balance widget and history.
 * Can be embedded in header or used as standalone page.
 * 
 * Note: CreditBalance component will automatically fetch userId from Supabase auth session
 * if not provided as a prop.
 */
import React from 'react';
import { CreditBalance } from '../components/billing/CreditBalance';

export function BillingOverview() {
  return (
    <div className="min-h-screen bg-zinc-950 p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-6">Billing & Credits</h1>
        <div className="max-w-md">
          <CreditBalance />
        </div>
      </div>
    </div>
  );
}

