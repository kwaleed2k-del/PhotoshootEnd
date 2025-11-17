-- Migration: Security Hardening & RPC Grants
-- Purpose: Lock down credit ledger RPCs to service role only, remove client insert policy
-- This migration is idempotent and safe for production

-- Ensure pgcrypto extension (required for UUID generation)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- RLS Policy Cleanup: Remove client insert policy on credit_transactions
-- End-users should not write ledger rows directly; only service role can insert
DROP POLICY IF EXISTS "credit_tx_insert_self" ON public.credit_transactions;

-- Note: We keep:
-- - credit_tx_select_self (users can read their own transactions)
-- - credit_tx_service_insert/update/delete (service role can write)

-- Lock down RPC functions to service role only
-- Revoke any public execute grants
REVOKE ALL ON FUNCTION public.fn_add_credits(UUID, INTEGER, TEXT, TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_deduct_credits(UUID, INTEGER, TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_refund_credits(UUID, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_log_generation(UUID, TEXT, INTEGER, UUID, TEXT, JSONB, TEXT[], INTEGER) FROM PUBLIC;

-- Grant execute to service role only
GRANT EXECUTE ON FUNCTION public.fn_add_credits(UUID, INTEGER, TEXT, TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_deduct_credits(UUID, INTEGER, TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_refund_credits(UUID, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_log_generation(UUID, TEXT, INTEGER, UUID, TEXT, JSONB, TEXT[], INTEGER) TO service_role;

-- Ensure function owners (SECURITY DEFINER functions run with owner privileges)
-- Adjust owner if your deploy role differs from postgres
ALTER FUNCTION public.fn_add_credits(UUID, INTEGER, TEXT, TEXT, UUID) OWNER TO postgres;
ALTER FUNCTION public.fn_deduct_credits(UUID, INTEGER, TEXT, UUID) OWNER TO postgres;
ALTER FUNCTION public.fn_refund_credits(UUID, UUID, TEXT) OWNER TO postgres;
ALTER FUNCTION public.fn_log_generation(UUID, TEXT, INTEGER, UUID, TEXT, JSONB, TEXT[], INTEGER) OWNER TO postgres;

-- ============================================================================
-- ROLLBACK SECTION
-- ============================================================================
-- To rollback this migration, execute the following statements:
--
-- -- Restore function owners (if needed, adjust to your original owner)
-- -- ALTER FUNCTION public.fn_log_generation(...) OWNER TO <original_owner>;
-- -- ALTER FUNCTION public.fn_refund_credits(...) OWNER TO <original_owner>;
-- -- ALTER FUNCTION public.fn_deduct_credits(...) OWNER TO <original_owner>;
-- -- ALTER FUNCTION public.fn_add_credits(...) OWNER TO <original_owner>;
--
-- -- Revoke service role grants
-- REVOKE EXECUTE ON FUNCTION public.fn_log_generation(...) FROM service_role;
-- REVOKE EXECUTE ON FUNCTION public.fn_refund_credits(...) FROM service_role;
-- REVOKE EXECUTE ON FUNCTION public.fn_deduct_credits(...) FROM service_role;
-- REVOKE EXECUTE ON FUNCTION public.fn_add_credits(...) FROM service_role;
--
-- -- Re-grant to PUBLIC (if you want to restore public access - not recommended)
-- -- GRANT EXECUTE ON FUNCTION public.fn_add_credits(...) TO PUBLIC;
-- -- GRANT EXECUTE ON FUNCTION public.fn_deduct_credits(...) TO PUBLIC;
-- -- GRANT EXECUTE ON FUNCTION public.fn_refund_credits(...) TO PUBLIC;
-- -- GRANT EXECUTE ON FUNCTION public.fn_log_generation(...) TO PUBLIC;
--
-- -- Re-add client insert policy (if needed - not recommended for security)
-- -- CREATE POLICY "credit_tx_insert_self"
-- --   ON public.credit_transactions FOR INSERT
-- --   WITH CHECK (auth.uid() = user_id);

