-- Migration: Extend user_generations with credit linkage
-- Notes: Detected primary key type is UUID; timestamp column is named created_at
-- This migration is idempotent and safe for production

-- Add credits_used column
ALTER TABLE public.user_generations
  ADD COLUMN IF NOT EXISTS credits_used INTEGER NOT NULL DEFAULT 0;

-- Add credit_transaction_id column (nullable)
ALTER TABLE public.user_generations
  ADD COLUMN IF NOT EXISTS credit_transaction_id UUID;

-- Add FOREIGN KEY constraint only if credit_transactions exists and constraint missing
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class WHERE relname = 'credit_transactions' AND relnamespace = 'public'::regnamespace
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_generations_credit_tx_fk'
  ) THEN
    ALTER TABLE public.user_generations
      ADD CONSTRAINT user_generations_credit_tx_fk
      FOREIGN KEY (credit_transaction_id)
      REFERENCES public.credit_transactions(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- Ensure credits_used is non-negative (optional safety constraint)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_user_generations_credits_nonnegative'
  ) THEN
    ALTER TABLE public.user_generations
      ADD CONSTRAINT chk_user_generations_credits_nonnegative
      CHECK (credits_used >= 0);
  END IF;
END $$;

-- Ensure composite index on (user_id, created_at DESC)
CREATE INDEX IF NOT EXISTS user_generations_user_created_idx
  ON public.user_generations (user_id, created_at DESC);

-- ============================================================================
-- ROLLBACK SECTION
-- ============================================================================
-- To rollback this migration, execute the following statements:
--
-- BEGIN;
--
-- ALTER TABLE public.user_generations DROP CONSTRAINT IF EXISTS user_generations_credit_tx_fk;
-- ALTER TABLE public.user_generations DROP CONSTRAINT IF EXISTS chk_user_generations_credits_nonnegative;
-- ALTER TABLE public.user_generations DROP COLUMN IF EXISTS credit_transaction_id;
-- ALTER TABLE public.user_generations DROP COLUMN IF EXISTS credits_used;
-- DROP INDEX IF EXISTS user_generations_user_created_idx;
--
-- COMMIT;
