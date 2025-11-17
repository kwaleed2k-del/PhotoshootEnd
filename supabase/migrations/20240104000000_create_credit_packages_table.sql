-- Migration: Create credit_packages table for SaaS transformation
-- Purpose: Define purchasable credit packs for one-time buy
-- This migration is idempotent and safe to run on production

CREATE TABLE IF NOT EXISTS public.credit_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  credits_amount INTEGER NOT NULL,
  price_usd DECIMAL(10,2) NOT NULL,
  stripe_price_id TEXT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  bonus_credits INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Partial unique index to ensure Stripe price IDs are unique when present
CREATE UNIQUE INDEX IF NOT EXISTS credit_packages_stripe_price_uidx
  ON public.credit_packages (stripe_price_id)
  WHERE stripe_price_id IS NOT NULL;

-- Index for quickly querying active packages
CREATE INDEX IF NOT EXISTS credit_packages_active_idx
  ON public.credit_packages (is_active);

-- Enable Row Level Security
ALTER TABLE public.credit_packages ENABLE ROW LEVEL SECURITY;

-- Allow all users to read active packages
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'credit_packages' 
      AND policyname = 'credit_packages_select_active'
  ) THEN
    CREATE POLICY "credit_packages_select_active"
      ON public.credit_packages FOR SELECT
      USING (is_active = TRUE);
  END IF;
END $$;

-- ============================================================================
-- ROLLBACK SECTION
-- ============================================================================
-- To rollback this migration, execute the following statements:
--
-- BEGIN;
--
-- DROP POLICY IF EXISTS "credit_packages_select_active" ON public.credit_packages;
-- DROP INDEX IF EXISTS credit_packages_active_idx;
-- DROP INDEX IF EXISTS credit_packages_stripe_price_uidx;
-- DROP TABLE IF EXISTS public.credit_packages;
--
-- COMMIT;
