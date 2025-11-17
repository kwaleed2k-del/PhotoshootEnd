import { supabaseAdmin } from './supabaseAdmin';

/**
 * Custom error for insufficient credits
 */
export class InsufficientCreditsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InsufficientCreditsError';
  }
}

/**
 * Credit transaction result
 */
export interface CreditTransactionResult {
  transactionId: string;
  balanceAfter: number;
}

/**
 * Credit transaction history entry
 */
export interface CreditTransaction {
  id: string;
  user_id: string;
  transaction_type: string;
  amount: number;
  balance_after: number;
  description: string | null;
  related_generation_id: string | null;
  created_at: string;
}

/**
 * Get current credit balance for a user
 */
export async function getCreditBalance(userId: string): Promise<number> {
  if (!userId || typeof userId !== 'string') {
    throw new Error('Valid userId is required');
  }

  const { data, error } = await supabaseAdmin
    .from('users')
    .select('credits_balance')
    .eq('id', userId)
    .single();

  if (error) {
    throw new Error(`Failed to get credit balance: ${error.message}`);
  }

  return data?.credits_balance ?? 0;
}

/**
 * Get credit transaction history for a user
 */
export async function getCreditHistory(
  userId: string,
  limit: number = 50
): Promise<CreditTransaction[]> {
  if (!userId || typeof userId !== 'string') {
    throw new Error('Valid userId is required');
  }

  if (limit <= 0 || limit > 1000) {
    throw new Error('Limit must be between 1 and 1000');
  }

  const { data, error } = await supabaseAdmin
    .from('credit_transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to get credit history: ${error.message}`);
  }

  return (data ?? []) as CreditTransaction[];
}

/**
 * Check if user has sufficient credits
 */
export async function checkSufficientCredits(
  userId: string,
  amount: number
): Promise<boolean> {
  if (!userId || typeof userId !== 'string') {
    throw new Error('Valid userId is required');
  }

  if (amount <= 0) {
    throw new Error('Amount must be positive');
  }

  const balance = await getCreditBalance(userId);
  return balance >= amount;
}

/**
 * Add credits to a user's balance
 */
export async function addCredits(
  userId: string,
  amount: number,
  description: string,
  txType: 'purchase' | 'grant' | 'refund' | 'monthly_reset',
  generationId?: string
): Promise<CreditTransactionResult> {
  if (!userId || typeof userId !== 'string') {
    throw new Error('Valid userId is required');
  }

  if (amount <= 0) {
    throw new Error('Amount must be positive');
  }

  if (!description || typeof description !== 'string') {
    throw new Error('Description is required');
  }

  const { data, error } = await supabaseAdmin.rpc('fn_add_credits', {
    p_user_id: userId,
    p_amount: amount,
    p_description: description,
    p_tx_type: txType,
    p_generation_id: generationId || null
  });

  if (error) {
    // Map database errors to friendly messages
    if (error.code === 'P0003') {
      throw new Error(`User not found: ${userId}`);
    }
    throw new Error(`Failed to add credits: ${error.message}`);
  }

  if (!data || data.length === 0) {
    throw new Error('No result returned from add credits function');
  }

  return {
    transactionId: data[0].transaction_id,
    balanceAfter: data[0].balance_after
  };
}

/**
 * Deduct credits from a user's balance
 */
export async function deductCredits(
  userId: string,
  amount: number,
  description: string,
  generationId?: string
): Promise<CreditTransactionResult> {
  if (!userId || typeof userId !== 'string') {
    throw new Error('Valid userId is required');
  }

  if (amount <= 0) {
    throw new Error('Amount must be positive');
  }

  if (!description || typeof description !== 'string') {
    throw new Error('Description is required');
  }

  const { data, error } = await supabaseAdmin.rpc('fn_deduct_credits', {
    p_user_id: userId,
    p_amount: amount,
    p_description: description,
    p_generation_id: generationId || null
  });

  if (error) {
    // Map P3001 to InsufficientCreditsError
    if (error.code === 'P3001' || error.message.includes('Insufficient credits')) {
      throw new InsufficientCreditsError('Insufficient credits to complete this operation');
    }
    if (error.code === 'P0003') {
      throw new Error(`User not found: ${userId}`);
    }
    throw new Error(`Failed to deduct credits: ${error.message}`);
  }

  if (!data || data.length === 0) {
    throw new Error('No result returned from deduct credits function');
  }

  return {
    transactionId: data[0].transaction_id,
    balanceAfter: data[0].balance_after
  };
}

/**
 * Refund credits based on a previous transaction
 */
export async function refundCredits(
  userId: string,
  transactionId: string,
  reason?: string
): Promise<CreditTransactionResult> {
  if (!userId || typeof userId !== 'string') {
    throw new Error('Valid userId is required');
  }

  if (!transactionId || typeof transactionId !== 'string') {
    throw new Error('Valid transactionId is required');
  }

  const { data, error } = await supabaseAdmin.rpc('fn_refund_credits', {
    p_user_id: userId,
    p_transaction_id: transactionId,
    p_reason: reason || null
  });

  if (error) {
    // Map database errors to friendly messages
    if (error.code === 'P0004') {
      throw new Error(`Transaction not found: ${transactionId}`);
    }
    if (error.code === 'P0005') {
      throw new Error('Transaction does not belong to user');
    }
    if (error.code === 'P0003') {
      throw new Error(`User not found: ${userId}`);
    }
    throw new Error(`Failed to refund credits: ${error.message}`);
  }

  if (!data || data.length === 0) {
    throw new Error('No result returned from refund credits function');
  }

  return {
    transactionId: data[0].refund_transaction_id,
    balanceAfter: data[0].balance_after
  };
}

