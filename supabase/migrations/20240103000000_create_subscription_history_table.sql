-- Migration: Create subscription_history table for SaaS transformation
-- Table Created: subscription_history (public schema)
-- Users Table Reference: public.users (NOT auth.users)
-- Purpose: Track historical subscription lifecycle events for each user
-- This migration is idempotent and safe to run on production

CREATE TABLE IF NOT EXISTS public.subscription_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  plan_name TEXT NOT NULL,
  status TEXT NOT NULL,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NULL,
  stripe_subscription_id TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add CHECK constraint for status values (keep in sync with users.subscription_status)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_subscription_history_status'
  ) THEN
    ALTER TABLE public.subscription_history
      ADD CONSTRAINT check_subscription_history_status
      CHECK (status IN ('active', 'canceled', 'past_due', 'trialing'));
  END IF;
END $$;

-- Indexes for query performance
CREATE INDEX IF NOT EXISTS subscription_history_user_idx
  ON public.subscription_history (user_id, start_date DESC);

CREATE INDEX IF NOT EXISTS subscription_history_stripe_idx
  ON public.subscription_history (stripe_subscription_id);

-- Enable Row Level Security
ALTER TABLE public.subscription_history ENABLE ROW LEVEL SECURITY;

-- Minimal RLS policy for user self-access (write operations handled by service role/webhooks)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'subscription_history' 
      AND policyname = 'subhist_select_self'
  ) THEN
    CREATE POLICY "subhist_select_self"
      ON public.subscription_history FOR SELECT
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
-- DROP POLICY IF EXISTS "subhist_select_self" ON public.subscription_history;
-- DROP INDEX IF EXISTS subscription_history_stripe_idx;
-- DROP INDEX IF EXISTS subscription_history_user_idx;
-- DROP TABLE IF EXISTS public.subscription_history;
--
-- COMMIT;
