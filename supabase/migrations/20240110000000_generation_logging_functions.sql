-- Migration: Generation Logging RPC Function
-- Purpose: Atomic function to log generation, link credit transaction, and update usage analytics
-- This migration is idempotent and safe for production

CREATE OR REPLACE FUNCTION public.fn_log_generation(
  p_user_id UUID,
  p_type TEXT,                 -- 'apparel' | 'product' | 'video'
  p_credits_used INTEGER,      -- 0 for enterprise/unlimited
  p_credit_tx_id UUID,         -- NULL for enterprise/unlimited
  p_prompt TEXT,
  p_settings JSONB,
  p_result_urls TEXT[],       -- image/video URLs
  p_count INTEGER              -- number of images (1 for video)
)
RETURNS TABLE(generation_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
STRICT
AS $$
DECLARE
  v_gen_id UUID;
  v_today DATE := CURRENT_DATE;
BEGIN
  -- 1) Insert generation record
  INSERT INTO public.user_generations (
    user_id,
    generation_type,
    prompt,
    settings,
    result_urls,
    credits_used,
    credit_transaction_id,
    created_at
  )
  VALUES (
    p_user_id,
    p_type,
    p_prompt,
    p_settings,
    p_result_urls,
    GREATEST(p_credits_used, 0),
    p_credit_tx_id,
    NOW()
  )
  RETURNING id INTO v_gen_id;

  -- 2) Link credit transaction → generation (if provided)
  IF p_credit_tx_id IS NOT NULL THEN
    UPDATE public.credit_transactions
    SET related_generation_id = v_gen_id
    WHERE id = p_credit_tx_id AND user_id = p_user_id;
  END IF;

  -- 3) Upsert usage_analytics for today
  INSERT INTO public.usage_analytics (
    user_id,
    date,
    generation_type,
    count,
    credits_used,
    created_at
  )
  VALUES (
    p_user_id,
    v_today,
    p_type,
    GREATEST(p_count, 1),
    GREATEST(p_credits_used, 0),
    NOW()
  )
  ON CONFLICT (user_id, date, generation_type)
  DO UPDATE SET
    count = public.usage_analytics.count + GREATEST(p_count, 1),
    credits_used = public.usage_analytics.credits_used + GREATEST(p_credits_used, 0);

  RETURN QUERY SELECT v_gen_id;
END;
$$;

COMMENT ON FUNCTION public.fn_log_generation IS 
'Atomically logs a generation: inserts user_generations row, links credit_transactions.related_generation_id (if provided), and upserts usage_analytics for today. Parameters: p_user_id (UUID), p_type (apparel|product|video), p_credits_used (INT, 0 for enterprise), p_credit_tx_id (UUID, NULL for enterprise), p_prompt (TEXT), p_settings (JSONB), p_result_urls (TEXT[]), p_count (INT, images count). Returns generation_id UUID.';

-- ============================================================================
-- ROLLBACK SECTION
-- ============================================================================
-- To rollback this migration, execute the following statement:
--
-- DROP FUNCTION IF EXISTS public.fn_log_generation(UUID, TEXT, INTEGER, UUID, TEXT, JSONB, TEXT[], INTEGER);

