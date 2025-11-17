/**
 * Credit Pre-Check Guard Middleware
 * 
 * Wraps generation handlers to:
 * - Compute required credits from plan & request
 * - Verify user has sufficient credits
 * - Deduct/reserve credits atomically before generation
 * - Auto-refund on failure (optional)
 */

import { costForGeneration } from '../services/creditCostService';
import * as credits from '../services/creditService';
import { supabaseAdmin } from '../services/supabaseAdmin';
import { PlanTier } from '../../src/constants/creditCosts';

export type GenerationType = 'apparel' | 'product' | 'video';

export interface CreditGuardOptions {
  type: GenerationType;
  count: number; // # images for apparel/product; for video use 1
  autoRefundOnFailure?: boolean; // default true
  description?: string; // goes into credit_transactions.description
}

export interface CreditReservation {
  transactionId: string;
  creditsUsed: number;
  balanceAfter: number;
}

export interface CreditGuardResult<T> {
  ok: true;
  data: T;
  reservation?: CreditReservation;
} | {
  ok: false;
  code: 'INSUFFICIENT_CREDITS' | 'PLAN_BLOCKED' | 'UNKNOWN';
  message: string;
  needed?: number; // required credits
  have?: number;   // current balance
  purchaseHintUrl?: string;
}

interface UserPlanAndBalance {
  userId: string;
  plan: PlanTier;
  balance: number;
}

/**
 * Resolves user ID, plan tier, and current balance from the users table.
 * Uses service role client to read subscription_plan and credits_balance.
 */
async function resolveUserPlanAndBalance(userId: string): Promise<UserPlanAndBalance> {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('id, subscription_plan, subscription_status, credits_balance')
    .eq('id', userId)
    .single();

  if (error || !data) {
    throw new Error(`User not found: ${userId}`);
  }

  // Normalize plan tier (handle legacy plan values if any)
  let plan: PlanTier = 'free';
  if (data.subscription_plan) {
    const planValue = data.subscription_plan.toLowerCase();
    if (['free', 'starter', 'professional', 'enterprise'].includes(planValue)) {
      plan = planValue as PlanTier;
    }
  }

  // Note: We don't block canceled subscriptions here (handled in feature-gating later)
  const balance = data.credits_balance ?? 0;

  return {
    userId: data.id,
    plan,
    balance,
  };
}

/**
 * Internal implementation - use createCreditGuard() or withCreditGuard() instead
 */
async function withCreditGuardInternal<T>(
  userId: string,
  opts: CreditGuardOptions,
  work: (ctx: {
    userId: string;
    plan: PlanTier;
    reservation?: CreditReservation;
  }) => Promise<T>
): Promise<CreditGuardResult<T>> {
  try {
    const { userId: resolvedUserId, plan, balance } = await resolveUserPlanAndBalance(userId);

    // Compute required credits
    const required = costForGeneration(plan, opts.type, Math.max(1, opts.count));

    // Enterprise/unlimited plan: skip deduction
    if (required === 0) {
      const data = await work({ userId: resolvedUserId, plan });
      return { ok: true, data };
    }

    // Balance check
    if (!(await credits.checkSufficientCredits(resolvedUserId, required))) {
      return {
        ok: false,
        code: 'INSUFFICIENT_CREDITS',
        message: 'Not enough credits to run this generation.',
        needed: required,
        have: balance,
        purchaseHintUrl: '/billing/credits',
      };
    }

    // Deduct ("reserve") before generation
    const { transactionId, balanceAfter } = await credits.deductCredits(
      resolvedUserId,
      required,
      opts.description ?? `${opts.type} generation x${Math.max(1, opts.count)}`
    );

    const reservation: CreditReservation = {
      transactionId,
      creditsUsed: required,
      balanceAfter,
    };

    try {
      const data = await work({ userId: resolvedUserId, plan, reservation });
      return { ok: true, data, reservation };
    } catch (err) {
      // Auto-refund on failure (unless disabled)
      if (opts.autoRefundOnFailure !== false) {
        try {
          await credits.refundCredits(
            resolvedUserId,
            transactionId,
            'Auto-refund: generation failed'
          );
        } catch (refundError) {
          console.error('[creditPrecheck] Failed to auto-refund:', refundError);
          // Continue to throw original error even if refund fails
        }
      }
      throw err;
    }
  } catch (e: any) {
    if (e?.name === 'InsufficientCreditsError') {
      return {
        ok: false,
        code: 'INSUFFICIENT_CREDITS',
        message: 'Not enough credits.',
      };
    }
    return {
      ok: false,
      code: 'UNKNOWN',
      message: e?.message ?? 'Unexpected error',
    };
  }
}

/**
 * Helper to check if user has low credits (below threshold).
 * Used by UI to show warnings.
 */
export function isLowCredit(balance: number): boolean {
  return balance < 10;
}

/**
 * Higher-order function that wraps generation handlers with credit pre-check.
 * 
 * Flow:
 * 1. Resolve user plan and balance
 * 2. Compute required credits
 * 3. Check sufficient credits (skip for enterprise/unlimited)
 * 4. Deduct credits atomically
 * 5. Execute work function
 * 6. Auto-refund on failure (if enabled)
 * 
 * @param userId User ID from auth context
 * @param opts Credit guard options
 * @param work Async function that performs the generation
 * @returns CreditGuardResult with success/error details
 */
export async function withCreditGuard<T>(
  userId: string,
  opts: CreditGuardOptions,
  work: (ctx: {
    userId: string;
    plan: PlanTier;
    reservation?: CreditReservation;
  }) => Promise<T>
): Promise<CreditGuardResult<T>> {
  return withCreditGuardInternal(userId, opts, work);
}

/**
 * Helper to create a credit guard wrapper that includes userId from context.
 * Use this in your route handlers after auth middleware.
 */
export function createCreditGuard(userId: string) {
  return async function<T>(
    opts: CreditGuardOptions,
    work: (ctx: {
      userId: string;
      plan: PlanTier;
      reservation?: CreditReservation;
    }) => Promise<T>
  ): Promise<CreditGuardResult<T>> {
    return withCreditGuardInternal(userId, opts, work);
  };
}

