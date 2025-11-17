-- Migration: Finalize Phase-1 RLS hardening and helper indexes
-- Purpose: Ensure pgcrypto extension, tighten service-role write access, and add missing indexes
-- All statements are idempotent and safe for production

-- Ensure required extension
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Helper indexes ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS credit_tx_related_gen_idx
  ON public.credit_transactions (related_generation_id);

CREATE INDEX IF NOT EXISTS user_generations_credit_tx_idx
  ON public.user_generations (credit_transaction_id);

CREATE INDEX IF NOT EXISTS subscription_history_user_idx
  ON public.subscription_history (user_id, start_date DESC);

CREATE INDEX IF NOT EXISTS subscription_history_stripe_idx
  ON public.subscription_history (stripe_subscription_id);

-- RLS hardening: service-role write policies --------------------------------

-- credit_transactions: allow service role writes (keep existing user policies)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'credit_transactions' AND policyname = 'credit_tx_service_insert'
  ) THEN
    CREATE POLICY "credit_tx_service_insert"
      ON public.credit_transactions FOR INSERT
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'credit_transactions' AND policyname = 'credit_tx_service_update'
  ) THEN
    CREATE POLICY "credit_tx_service_update"
      ON public.credit_transactions FOR UPDATE
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'credit_transactions' AND policyname = 'credit_tx_service_delete'
  ) THEN
    CREATE POLICY "credit_tx_service_delete"
      ON public.credit_transactions FOR DELETE
      USING (auth.role() = 'service_role');
  END IF;
END $$;

-- billing_events: service role insert
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'billing_events' AND policyname = 'billing_events_service_insert'
  ) THEN
    CREATE POLICY "billing_events_service_insert"
      ON public.billing_events FOR INSERT
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

-- subscription_history: service role insert
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'subscription_history' AND policyname = 'subhist_service_insert'
  ) THEN
    CREATE POLICY "subhist_service_insert"
      ON public.subscription_history FOR INSERT
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

-- usage_analytics: service role inserts/updates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'usage_analytics' AND policyname = 'usage_analytics_service_insert'
  ) THEN
    CREATE POLICY "usage_analytics_service_insert"
      ON public.usage_analytics FOR INSERT
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'usage_analytics' AND policyname = 'usage_analytics_service_update'
  ) THEN
    CREATE POLICY "usage_analytics_service_update"
      ON public.usage_analytics FOR UPDATE
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

-- credit_packages: temporary service role writes (admin gating later)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'credit_packages' AND policyname = 'credit_packages_service_insert'
  ) THEN
    CREATE POLICY "credit_packages_service_insert"
      ON public.credit_packages FOR INSERT
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'credit_packages' AND policyname = 'credit_packages_service_update'
  ) THEN
    CREATE POLICY "credit_packages_service_update"
      ON public.credit_packages FOR UPDATE
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'credit_packages' AND policyname = 'credit_packages_service_delete'
  ) THEN
    CREATE POLICY "credit_packages_service_delete"
      ON public.credit_packages FOR DELETE
      USING (auth.role() = 'service_role');
  END IF;
END $$;

-- ============================================================================
-- ROLLBACK SECTION
-- ============================================================================
-- To rollback this migration, execute the following statements in order:
--
-- BEGIN;
--
-- DROP POLICY IF EXISTS "credit_packages_service_delete" ON public.credit_packages;
-- DROP POLICY IF EXISTS "credit_packages_service_update" ON public.credit_packages;
-- DROP POLICY IF EXISTS "credit_packages_service_insert" ON public.credit_packages;
-- DROP POLICY IF EXISTS "usage_analytics_service_update" ON public.usage_analytics;
-- DROP POLICY IF EXISTS "usage_analytics_service_insert" ON public.usage_analytics;
-- DROP POLICY IF EXISTS "subhist_service_insert" ON public.subscription_history;
-- DROP POLICY IF EXISTS "billing_events_service_insert" ON public.billing_events;
-- DROP POLICY IF EXISTS "credit_tx_service_delete" ON public.credit_transactions;
-- DROP POLICY IF EXISTS "credit_tx_service_update" ON public.credit_transactions;
-- DROP POLICY IF EXISTS "credit_tx_service_insert" ON public.credit_transactions;
-- DROP INDEX IF EXISTS subscription_history_stripe_idx;
-- DROP INDEX IF EXISTS subscription_history_user_idx;
-- DROP INDEX IF EXISTS user_generations_credit_tx_idx;
-- DROP INDEX IF EXISTS credit_tx_related_gen_idx;
--
-- COMMIT;
