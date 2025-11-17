-- ============================================================================
-- Migration: Credit operations (read/credit/debit) as Postgres functions
-- Filename: 20251116000003_credit_functions.sql
--
-- Intent:
--   - Provide atomic credit operations to be invoked by the server using the
--     service role (RLS stays strict on public.credit_transactions).
--   - SECURITY INVOKER (no RLS bypass); idempotent via CREATE OR REPLACE.
--
-- Test notes:
--   - With service role:
--       SELECT public.get_credit_balance(:uid) -> 0 initially
--       SELECT public.grant_credits(:uid, 10, 'monthly_grant', '{"source":"test"}') -> 10
--       SELECT public.consume_credits(:uid, 3, 'generation', '{"req":"abc"}') -> 7
--       SELECT public.consume_credits(:uid, 99, 'overdraw', '{}') -> raises P0001 (INSUFFICIENT_CREDITS)
--   - With user JWT (not service role):
--       Direct INSERT into public.credit_transactions should still be denied by RLS.
-- ============================================================================

-- Read-only balance function --------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_credit_balance(p_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT COALESCE(SUM(delta), 0)::int
  FROM public.credit_transactions
  WHERE user_id = p_user_id;
$$;

COMMENT ON FUNCTION public.get_credit_balance(uuid) IS 'credit_functions_mig';

-- Grant credits (positive delta) ---------------------------------------------
CREATE OR REPLACE FUNCTION public.grant_credits(
  p_user_id uuid,
  p_amount int,
  p_reason text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT';
  END IF;

  INSERT INTO public.credit_transactions (user_id, delta, reason, metadata)
  VALUES (p_user_id, p_amount, p_reason, COALESCE(p_metadata, '{}'::jsonb));

  RETURN public.get_credit_balance(p_user_id);
END;
$$;

COMMENT ON FUNCTION public.grant_credits(uuid, integer, text, jsonb) IS 'credit_functions_mig';

-- Consume credits (negative delta) with per-user serialization ----------------
CREATE OR REPLACE FUNCTION public.consume_credits(
  p_user_id uuid,
  p_amount int,
  p_reason text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_curr integer;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT';
  END IF;

  -- Serialize per user to prevent race conditions on balance checks.
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'hashtextextended') THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 42));
  ELSE
    PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text));
  END IF;

  v_curr := public.get_credit_balance(p_user_id);
  IF v_curr - p_amount < 0 THEN
    RAISE EXCEPTION 'INSUFFICIENT_CREDITS'
      USING ERRCODE = 'P0001',
            HINT = 'Not enough credits to consume.';
  END IF;

  INSERT INTO public.credit_transactions (user_id, delta, reason, metadata)
  VALUES (p_user_id, -p_amount, p_reason, COALESCE(p_metadata, '{}'::jsonb));

  RETURN public.get_credit_balance(p_user_id);
END;
$$;

COMMENT ON FUNCTION public.consume_credits(uuid, integer, text, jsonb) IS 'credit_functions_mig';

-- ============================================================================
-- DOWN MIGRATION
-- ============================================================================
DROP FUNCTION IF EXISTS public.consume_credits(uuid, integer, text, jsonb);
DROP FUNCTION IF EXISTS public.grant_credits(uuid, integer, text, jsonb);
DROP FUNCTION IF EXISTS public.get_credit_balance(uuid);


