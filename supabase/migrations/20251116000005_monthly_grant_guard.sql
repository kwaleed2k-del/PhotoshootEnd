-- ============================================================================
-- Migration: Guard monthly credit grants with unique index
-- Filename: 20251116000005_monthly_grant_guard.sql
--
-- Intent:
--   - Ensure at most one monthly grant per user per period by adding a
--     partial unique index on credit_transactions.
--   - Keeps grant job idempotent / retry-safe.
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS credit_tx_monthly_unique_idx
  ON public.credit_transactions (user_id, (metadata->>'period'))
  WHERE reason = 'monthly_grant';

COMMENT ON INDEX credit_tx_monthly_unique_idx IS 'Idempotency guard: one monthly_grant per user+period.';

-- ============================================================================
-- DOWN MIGRATION
-- ============================================================================
DROP INDEX IF EXISTS credit_tx_monthly_unique_idx;


