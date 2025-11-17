-- Migration: Create billing_events table for SaaS transformation
-- Purpose: Store Stripe webhook events (invoices, payments, refunds, chargebacks)
-- Users Table Reference: public.users (NOT auth.users)
-- This migration is idempotent and safe to run on production

CREATE TABLE IF NOT EXISTS public.billing_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  stripe_event_id TEXT NOT NULL UNIQUE,
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  status TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add CHECK constraint for allowed event types
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_billing_events_type'
  ) THEN
    ALTER TABLE public.billing_events
      ADD CONSTRAINT check_billing_events_type
      CHECK (event_type IN ('invoice_created','payment_succeeded','payment_failed','refund','chargeback'));
  END IF;
END $$;

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS billing_events_user_created_idx
  ON public.billing_events (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS billing_events_event_type_idx
  ON public.billing_events (event_type);

-- Enable Row Level Security
ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;

-- Allow users to select their own billing events
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'billing_events' 
      AND policyname = 'billing_events_select_self'
  ) THEN
    CREATE POLICY "billing_events_select_self"
      ON public.billing_events FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- ============================================================================
-- ROLLBACK SECTION
-- ============================================================================
-- To rollback this migration, execute the following statements:
--
-- BEGIN;
--
-- DROP POLICY IF EXISTS "billing_events_select_self" ON public.billing_events;
-- DROP INDEX IF EXISTS billing_events_event_type_idx;
-- DROP INDEX IF EXISTS billing_events_user_created_idx;
-- DROP TABLE IF EXISTS public.billing_events;
--
-- COMMIT;
