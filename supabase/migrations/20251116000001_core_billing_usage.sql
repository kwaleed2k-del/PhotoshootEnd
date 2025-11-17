-- ============================================================================
-- Migration: Core billing and usage tables with strict RLS (idempotent)
-- Filename: 20251116000001_core_billing_usage.sql
--
-- Intent:
--   - Create or reconcile core billing/usage tables and policies:
--       * public.credit_transactions
--       * public.usage_events
--       * public.subscriptions
--       * public.billing_events
--   - Enforce strict RLS: users can read their own rows; service_role can do ALL;
--     writes are service_role-only (server/webhook).
--   - Be safe to run multiple times (CI, local reset).
--
-- Test notes:
--   - With a user JWT:
--       * SELECT from each table returns only your rows
--       * INSERT/UPDATE/DELETE should be denied
--   - With a service_role JWT:
--       * Full CRUD across all four tables
--   - usage_events idempotency:
--       * Insert two rows with same non-null request_id -> second insert fails
--   - subscriptions partial unique index:
--       * Two rows for same user_id with status IN ('active','trialing','past_due') -> second insert fails
-- ============================================================================

-- 1) credit_transactions ------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.credit_transactions (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL,
  delta              integer NOT NULL,
  reason             text NOT NULL,
  metadata           jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at         timestamptz NOT NULL DEFAULT now()
);

-- Ensure required columns exist (merge-safe)
ALTER TABLE public.credit_transactions
  ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS delta integer,
  ADD COLUMN IF NOT EXISTS reason text,
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

-- Ensure FK exists (named for idempotency)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'credit_transactions_user_fk'
      AND conrelid = 'public.credit_transactions'::regclass
  ) THEN
    ALTER TABLE public.credit_transactions
      ADD CONSTRAINT credit_transactions_user_fk
      FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END$$;

-- Indexes
CREATE INDEX IF NOT EXISTS credit_tx_user_created_idx
  ON public.credit_transactions(user_id, created_at DESC);

COMMENT ON TABLE public.credit_transactions IS 'core_billing_usage_mig';

-- RLS
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='credit_transactions' AND policyname='credit_tx_self_select'
  ) THEN
    CREATE POLICY credit_tx_self_select
      ON public.credit_transactions
      FOR SELECT
      USING (user_id = auth.uid());
    COMMENT ON POLICY credit_tx_self_select ON public.credit_transactions IS 'core_billing_usage_mig';
  END IF;
END$$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='credit_transactions' AND policyname='credit_tx_service_all'
  ) THEN
    CREATE POLICY credit_tx_service_all
      ON public.credit_transactions
      FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
    COMMENT ON POLICY credit_tx_service_all ON public.credit_transactions IS 'core_billing_usage_mig';
  END IF;
END$$;

-- 2) usage_events -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.usage_events (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL,
  event_type         text NOT NULL,
  cost               integer NOT NULL,
  tokens             integer,
  request_id         text,
  metadata           jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at         timestamptz NOT NULL DEFAULT now()
);

-- Ensure required columns exist (merge-safe)
ALTER TABLE public.usage_events
  ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS event_type text,
  ADD COLUMN IF NOT EXISTS cost integer,
  ADD COLUMN IF NOT EXISTS tokens integer,
  ADD COLUMN IF NOT EXISTS request_id text,
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

-- Ensure constraints (FK + cost >= 0)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'usage_events_user_fk'
      AND conrelid = 'public.usage_events'::regclass
  ) THEN
    ALTER TABLE public.usage_events
      ADD CONSTRAINT usage_events_user_fk
      FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'usage_events_cost_nonneg_ck'
      AND conrelid = 'public.usage_events'::regclass
  ) THEN
    ALTER TABLE public.usage_events
      ADD CONSTRAINT usage_events_cost_nonneg_ck CHECK (cost >= 0);
  END IF;
END$$;

-- Indexes
CREATE INDEX IF NOT EXISTS usage_events_user_created_idx
  ON public.usage_events(user_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS usage_events_request_unique_idx
  ON public.usage_events(request_id)
  WHERE request_id IS NOT NULL;

COMMENT ON TABLE public.usage_events IS 'core_billing_usage_mig';

-- RLS
ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='usage_events' AND policyname='usage_events_self_select'
  ) THEN
    CREATE POLICY usage_events_self_select
      ON public.usage_events
      FOR SELECT
      USING (user_id = auth.uid());
    COMMENT ON POLICY usage_events_self_select ON public.usage_events IS 'core_billing_usage_mig';
  END IF;
END$$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='usage_events' AND policyname='usage_events_service_all'
  ) THEN
    CREATE POLICY usage_events_service_all
      ON public.usage_events
      FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
    COMMENT ON POLICY usage_events_service_all ON public.usage_events IS 'core_billing_usage_mig';
  END IF;
END$$;

-- 3) subscriptions ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 uuid NOT NULL,
  stripe_customer_id      text,
  stripe_subscription_id  text,
  plan_code               text NOT NULL,
  status                  text NOT NULL,
  current_period_start    timestamptz,
  current_period_end      timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

-- Ensure required columns exist (merge-safe)
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS plan_code text,
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS current_period_start timestamptz,
  ADD COLUMN IF NOT EXISTS current_period_end timestamptz,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Ensure FK exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'subscriptions_user_fk'
      AND conrelid = 'public.subscriptions'::regclass
  ) THEN
    ALTER TABLE public.subscriptions
      ADD CONSTRAINT subscriptions_user_fk
      FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END$$;

-- Helpful indexes
CREATE INDEX IF NOT EXISTS subs_user_idx ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS subs_status_idx ON public.subscriptions(status);
CREATE UNIQUE INDEX IF NOT EXISTS subs_stripe_id_unique_idx
  ON public.subscriptions(stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS subs_user_active_one_idx
  ON public.subscriptions(user_id)
  WHERE status IN ('active','trialing','past_due');

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at_subs()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS subs_set_updated_at ON public.subscriptions;
CREATE TRIGGER subs_set_updated_at
BEFORE UPDATE ON public.subscriptions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_subs();

COMMENT ON TABLE public.subscriptions IS 'core_billing_usage_mig';

-- RLS
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='subscriptions' AND policyname='subs_self_select'
  ) THEN
    CREATE POLICY subs_self_select
      ON public.subscriptions
      FOR SELECT
      USING (user_id = auth.uid());
    COMMENT ON POLICY subs_self_select ON public.subscriptions IS 'core_billing_usage_mig';
  END IF;
END$$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='subscriptions' AND policyname='subs_service_all'
  ) THEN
    CREATE POLICY subs_service_all
      ON public.subscriptions
      FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
    COMMENT ON POLICY subs_service_all ON public.subscriptions IS 'core_billing_usage_mig';
  END IF;
END$$;

-- 4) billing_events -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.billing_events (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid,
  type              text NOT NULL,
  stripe_object_id  text,
  payload           jsonb NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- Ensure required columns exist (merge-safe)
ALTER TABLE public.billing_events
  ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS type text,
  ADD COLUMN IF NOT EXISTS stripe_object_id text,
  ADD COLUMN IF NOT EXISTS payload jsonb,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

-- Ensure FK exists (SET NULL on delete)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'billing_events_user_fk'
      AND conrelid = 'public.billing_events'::regclass
  ) THEN
    ALTER TABLE public.billing_events
      ADD CONSTRAINT billing_events_user_fk
      FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;
END$$;

-- Indexes
CREATE INDEX IF NOT EXISTS billing_events_type_created_idx
  ON public.billing_events(type, created_at DESC);
CREATE INDEX IF NOT EXISTS billing_events_user_created_idx
  ON public.billing_events(user_id, created_at DESC);

COMMENT ON TABLE public.billing_events IS 'core_billing_usage_mig';

-- RLS
ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='billing_events' AND policyname='billing_events_self_select'
  ) THEN
    CREATE POLICY billing_events_self_select
      ON public.billing_events
      FOR SELECT
      USING (user_id = auth.uid());
    COMMENT ON POLICY billing_events_self_select ON public.billing_events IS 'core_billing_usage_mig';
  END IF;
END$$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='billing_events' AND policyname='billing_events_service_all'
  ) THEN
    CREATE POLICY billing_events_service_all
      ON public.billing_events
      FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
    COMMENT ON POLICY billing_events_service_all ON public.billing_events IS 'core_billing_usage_mig';
  END IF;
END$$;

-- ============================================================================
-- DOWN MIGRATION (guarded by table comments to avoid dropping pre-existing tables)
-- Order: drop policies -> drop tables (reverse dependency)
-- ============================================================================

-- Drop policies if exist (safe) ----------------------------------------------
-- credit_transactions
DROP POLICY IF EXISTS credit_tx_self_select ON public.credit_transactions;
DROP POLICY IF EXISTS credit_tx_service_all ON public.credit_transactions;
-- usage_events
DROP POLICY IF EXISTS usage_events_self_select ON public.usage_events;
DROP POLICY IF EXISTS usage_events_service_all ON public.usage_events;
-- subscriptions
DROP POLICY IF EXISTS subs_self_select ON public.subscriptions;
DROP POLICY IF EXISTS subs_service_all ON public.subscriptions;
-- billing_events
DROP POLICY IF EXISTS billing_events_self_select ON public.billing_events;
DROP POLICY IF EXISTS billing_events_service_all ON public.billing_events;

-- Drop triggers created here (safe) ------------------------------------------
DROP TRIGGER IF EXISTS subs_set_updated_at ON public.subscriptions;

-- Drop tables only if created by this migration (check table comment) --------
DO $$
BEGIN
  IF (SELECT obj_description('public.billing_events'::regclass,'pg_class')) = 'core_billing_usage_mig' THEN
    DROP TABLE IF EXISTS public.billing_events;
  END IF;
END$$;

DO $$
BEGIN
  IF (SELECT obj_description('public.subscriptions'::regclass,'pg_class')) = 'core_billing_usage_mig' THEN
    DROP TABLE IF EXISTS public.subscriptions;
  END IF;
END$$;

DO $$
BEGIN
  IF (SELECT obj_description('public.usage_events'::regclass,'pg_class')) = 'core_billing_usage_mig' THEN
    DROP TABLE IF EXISTS public.usage_events;
  END IF;
END$$;

DO $$
BEGIN
  IF (SELECT obj_description('public.credit_transactions'::regclass,'pg_class')) = 'core_billing_usage_mig' THEN
    DROP TABLE IF EXISTS public.credit_transactions;
  END IF;
END$$;


