/**
 * Generation Tracking Service
 * 
 * Wraps fn_log_generation RPC to atomically log generations,
 * link credit transactions, and update usage analytics.
 */

import { supabaseAdmin } from './supabaseAdmin';

export interface GenerationLogInput {
  userId: string;
  type: 'apparel' | 'product' | 'video';
  count: number;                 // images; 1 for video
  creditsUsed: number;           // 0 for enterprise/unlimited
  creditTransactionId?: string;  // undefined for enterprise/unlimited
  prompt?: string;
  settings?: Record<string, unknown>;
  resultUrls: string[];          // required on success
}

/**
 * Logs a successful generation atomically.
 * 
 * Inserts into user_generations, links credit_transactions.related_generation_id,
 * and upserts usage_analytics for today.
 * 
 * @param input Generation log input
 * @returns Generation ID
 * @throws Error if validation fails or RPC call fails
 */
export async function logGenerationSuccess(
  input: GenerationLogInput
): Promise<{ generationId: string }> {
  // Validation
  if (!input.userId || typeof input.userId !== 'string') {
    throw new Error('Valid userId is required');
  }

  if (!input.type || !['apparel', 'product', 'video'].includes(input.type)) {
    throw new Error(`Invalid generation type: ${input.type}`);
  }

  if (!input.count || input.count < 1) {
    throw new Error(`Count must be at least 1, got ${input.count}`);
  }

  if (!input.resultUrls || input.resultUrls.length === 0) {
    throw new Error('resultUrls is required and must not be empty');
  }

  if (input.creditsUsed < 0) {
    throw new Error(`creditsUsed must be non-negative, got ${input.creditsUsed}`);
  }

  // Call RPC function
  const { data, error } = await supabaseAdmin.rpc('fn_log_generation', {
    p_user_id: input.userId,
    p_type: input.type,
    p_credits_used: input.creditsUsed,
    p_credit_tx_id: input.creditTransactionId || null,
    p_prompt: input.prompt || '',
    p_settings: (input.settings || {}) as any, // JSONB
    p_result_urls: input.resultUrls,
    p_count: input.count,
  });

  if (error) {
    throw new Error(`Failed to log generation: ${error.message}`);
  }

  if (!data || data.length === 0 || !data[0]?.generation_id) {
    throw new Error('No generation ID returned from log function');
  }

  return {
    generationId: data[0].generation_id,
  };
}

