-- Migration: Credit Ledger RPC Functions
-- Purpose: Atomic, transaction-safe functions for credit balance management
-- All functions are SECURITY DEFINER and run with elevated privileges
-- This migration is idempotent and safe for production

-- Function: Add credits to a user's balance
CREATE OR REPLACE FUNCTION public.fn_add_credits(
  p_user_id UUID,
  p_amount INTEGER,
  p_description TEXT,
  p_tx_type TEXT DEFAULT 'grant',
  p_generation_id UUID DEFAULT NULL
)
RETURNS TABLE(transaction_id UUID, balance_after INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
STRICT
AS $$
DECLARE
  v_balance_after INTEGER;
  v_transaction_id UUID;
BEGIN
  -- Preconditions
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive' USING ERRCODE = 'P0001';
  END IF;
  
  IF p_tx_type NOT IN ('purchase', 'grant', 'refund', 'monthly_reset') THEN
    RAISE EXCEPTION 'Invalid transaction type: %', p_tx_type USING ERRCODE = 'P0002';
  END IF;

  -- Lock user row and update balance atomically
  SELECT credits_balance INTO v_balance_after
  FROM public.users
  WHERE id = p_user_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found: %', p_user_id USING ERRCODE = 'P0003';
  END IF;

  -- Update balance
  UPDATE public.users
  SET credits_balance = credits_balance + p_amount
  WHERE id = p_user_id
  RETURNING credits_balance INTO v_balance_after;

  -- Insert transaction record
  INSERT INTO public.credit_transactions (
    user_id,
    transaction_type,
    amount,
    balance_after,
    description,
    related_generation_id
  )
  VALUES (
    p_user_id,
    p_tx_type,
    p_amount,
    v_balance_after,
    p_description,
    p_generation_id
  )
  RETURNING id INTO v_transaction_id;

  -- Return results
  RETURN QUERY SELECT v_transaction_id, v_balance_after;
END;
$$;

COMMENT ON FUNCTION public.fn_add_credits IS 
'Adds credits to a user balance atomically. Valid transaction types: purchase, grant, refund, monthly_reset. Returns transaction ID and new balance.';

-- Function: Deduct credits from a user's balance
CREATE OR REPLACE FUNCTION public.fn_deduct_credits(
  p_user_id UUID,
  p_amount INTEGER,
  p_description TEXT,
  p_generation_id UUID DEFAULT NULL
)
RETURNS TABLE(transaction_id UUID, balance_after INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
STRICT
AS $$
DECLARE
  v_balance_after INTEGER;
  v_transaction_id UUID;
  v_current_balance INTEGER;
BEGIN
  -- Preconditions
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive' USING ERRCODE = 'P0001';
  END IF;

  -- Lock user row and check balance
  SELECT credits_balance INTO v_current_balance
  FROM public.users
  WHERE id = p_user_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found: %', p_user_id USING ERRCODE = 'P0003';
  END IF;

  -- Check sufficient credits
  IF v_current_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient credits' USING ERRCODE = 'P3001';
  END IF;

  -- Update balance (decrement)
  UPDATE public.users
  SET credits_balance = credits_balance - p_amount
  WHERE id = p_user_id
  RETURNING credits_balance INTO v_balance_after;

  -- Insert transaction record (amount is negative for deduction)
  INSERT INTO public.credit_transactions (
    user_id,
    transaction_type,
    amount,
    balance_after,
    description,
    related_generation_id
  )
  VALUES (
    p_user_id,
    'usage',
    -p_amount,
    v_balance_after,
    p_description,
    p_generation_id
  )
  RETURNING id INTO v_transaction_id;

  -- Return results
  RETURN QUERY SELECT v_transaction_id, v_balance_after;
END;
$$;

COMMENT ON FUNCTION public.fn_deduct_credits IS 
'Deducts credits from a user balance atomically. Raises P3001 if insufficient credits. Returns transaction ID and new balance.';

-- Function: Refund credits based on a previous transaction
CREATE OR REPLACE FUNCTION public.fn_refund_credits(
  p_user_id UUID,
  p_transaction_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS TABLE(refund_transaction_id UUID, balance_after INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
STRICT
AS $$
DECLARE
  v_balance_after INTEGER;
  v_refund_transaction_id UUID;
  v_original_tx RECORD;
  v_refund_amount INTEGER;
BEGIN
  -- Fetch and validate original transaction
  SELECT 
    id,
    user_id,
    amount,
    related_generation_id
  INTO v_original_tx
  FROM public.credit_transactions
  WHERE id = p_transaction_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction not found: %', p_transaction_id USING ERRCODE = 'P0004';
  END IF;

  -- Verify transaction belongs to user
  IF v_original_tx.user_id != p_user_id THEN
    RAISE EXCEPTION 'Transaction does not belong to user' USING ERRCODE = 'P0005';
  END IF;

  -- Compute refund amount (absolute value of original, positive)
  v_refund_amount := ABS(v_original_tx.amount);

  -- Lock user row
  SELECT credits_balance INTO v_balance_after
  FROM public.users
  WHERE id = p_user_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found: %', p_user_id USING ERRCODE = 'P0003';
  END IF;

  -- Update balance (increment)
  UPDATE public.users
  SET credits_balance = credits_balance + v_refund_amount
  WHERE id = p_user_id
  RETURNING credits_balance INTO v_balance_after;

  -- Insert refund transaction
  INSERT INTO public.credit_transactions (
    user_id,
    transaction_type,
    amount,
    balance_after,
    description,
    related_generation_id
  )
  VALUES (
    p_user_id,
    'refund',
    v_refund_amount,
    v_balance_after,
    'Refund: ' || COALESCE(p_reason, 'No reason provided'),
    v_original_tx.related_generation_id
  )
  RETURNING id INTO v_refund_transaction_id;

  -- Return results
  RETURN QUERY SELECT v_refund_transaction_id, v_balance_after;
END;
$$;

COMMENT ON FUNCTION public.fn_refund_credits IS 
'Refunds credits based on a previous transaction. Validates ownership and computes refund amount from original transaction. Returns refund transaction ID and new balance.';

-- ============================================================================
-- ROLLBACK SECTION
-- ============================================================================
-- To rollback this migration, execute the following statements:
--
-- DROP FUNCTION IF EXISTS public.fn_refund_credits(UUID, UUID, TEXT);
-- DROP FUNCTION IF EXISTS public.fn_deduct_credits(UUID, INTEGER, TEXT, UUID);
-- DROP FUNCTION IF EXISTS public.fn_add_credits(UUID, INTEGER, TEXT, TEXT, UUID);

