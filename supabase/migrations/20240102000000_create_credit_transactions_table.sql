-- Migration: Create credit_transactions table for SaaS transformation
-- Table Created: credit_transactions (public schema)
-- Purpose: Track all credit transactions (purchases, usage, refunds, grants, etc.)
-- 
-- References:
-- - user_id references public.users(id) ON DELETE CASCADE
-- - related_generation_id references public.user_generations(id) ON DELETE SET NULL
--   (Detected PK type: public.user_generations.id is UUID, so related_generation_id uses UUID)
-- 
-- This migration is idempotent and safe to run on production

CREATE TABLE IF NOT EXISTS public.credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL,
  amount INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  description TEXT NULL,
  -- Create column first; add FK later if user_generations exists (fresh DB safety)
  related_generation_id UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add CHECK constraint for transaction_type
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_credit_tx_type'
  ) THEN
    ALTER TABLE public.credit_transactions 
      ADD CONSTRAINT check_credit_tx_type 
      CHECK (transaction_type IN ('purchase', 'usage', 'refund', 'grant', 'expiration', 'monthly_reset'));
  END IF;
END $$;

-- Add CHECK constraint for amount (must not be zero)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_credit_tx_amount_nonzero'
  ) THEN
    ALTER TABLE public.credit_transactions 
      ADD CONSTRAINT check_credit_tx_amount_nonzero 
      CHECK (amount <> 0);
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS credit_tx_user_created_idx 
  ON public.credit_transactions (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS credit_tx_type_idx 
  ON public.credit_transactions (transaction_type);

-- Add FK to user_generations if table exists and FK not already present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'user_generations'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'credit_transactions_related_generation_id_fkey'
    ) THEN
      ALTER TABLE public.credit_transactions
        ADD CONSTRAINT credit_transactions_related_generation_id_fkey
        FOREIGN KEY (related_generation_id) REFERENCES public.user_generations(id)
        ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

-- Enable Row Level Security
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

-- Create minimal RLS policies (light touch - will refine in later RLS pass)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'credit_transactions' 
      AND policyname = 'credit_tx_select_self'
  ) THEN
    CREATE POLICY "credit_tx_select_self"
      ON public.credit_transactions FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'credit_transactions' 
      AND policyname = 'credit_tx_insert_self'
  ) THEN
    CREATE POLICY "credit_tx_insert_self"
      ON public.credit_transactions FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ============================================================================
-- ROLLBACK SECTION
-- ============================================================================
-- To rollback this migration, execute the following SQL statements:
-- 
-- BEGIN;
-- 
-- -- Drop RLS policies
-- DROP POLICY IF EXISTS "credit_tx_insert_self" ON public.credit_transactions;
-- DROP POLICY IF EXISTS "credit_tx_select_self" ON public.credit_transactions;
-- 
-- -- Drop indexes
-- DROP INDEX IF EXISTS credit_tx_type_idx;
-- DROP INDEX IF EXISTS credit_tx_user_created_idx;
-- 
-- -- Drop table (this will also drop constraints and foreign keys)
-- DROP TABLE IF EXISTS public.credit_transactions;
-- 
-- COMMIT;

