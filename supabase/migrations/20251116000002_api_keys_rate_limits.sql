-- ============================================================================
-- Migration: API keys and rate-limit counters with strict RLS (idempotent)
-- Filename: 20251116000002_api_keys_rate_limits.sql
--
-- Intent:
--   - Create or reconcile:
--       * public.api_keys
--       * public.rate_limit_counters
--   - Enforce strict RLS with stable policy names; merge-safe DDL.
--
-- Test notes:
--   - With a user JWT:
--       * api_keys: SELECT own rows; INSERT with user_id = auth.uid() succeeds;
--         UPDATE own rows succeeds; cannot access others.
--       * rate_limit_counters: SELECT own rows; cannot INSERT/UPDATE/DELETE.
--   - With a service_role JWT:
--       * Full CRUD on both tables.
--   - Uniqueness:
--       * Duplicate api_keys.key_hash rejected by unique index.
--       * Duplicate (user_id, scope, window_start) in rate_limit_counters rejected.
-- ============================================================================

-- 1) api_keys -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.api_keys (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL,
  name         text NOT NULL,
  key_hash     text NOT NULL,
  key_prefix   text,
  revoked      boolean NOT NULL DEFAULT false,
  last_used_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Merge-safe column adds
ALTER TABLE public.api_keys
  ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS key_hash text,
  ADD COLUMN IF NOT EXISTS key_prefix text,
  ADD COLUMN IF NOT EXISTS revoked boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_used_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

-- FK to public.users with stable constraint name
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'api_keys_user_fk'
      AND conrelid = 'public.api_keys'::regclass
  ) THEN
    ALTER TABLE public.api_keys
      ADD CONSTRAINT api_keys_user_fk
      FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS api_keys_hash_unique_idx
  ON public.api_keys(key_hash);
CREATE INDEX IF NOT EXISTS api_keys_user_created_idx
  ON public.api_keys(user_id, created_at DESC);

COMMENT ON TABLE public.api_keys IS 'core_api_limits_mig';

-- RLS: enable and add policies
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='api_keys' AND policyname='api_keys_self_select'
  ) THEN
    CREATE POLICY api_keys_self_select
      ON public.api_keys FOR SELECT
      USING (user_id = auth.uid());
    COMMENT ON POLICY api_keys_self_select ON public.api_keys IS 'core_api_limits_mig';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='api_keys' AND policyname='api_keys_self_write'
  ) THEN
    CREATE POLICY api_keys_self_write
      ON public.api_keys FOR INSERT
      WITH CHECK (user_id = auth.uid());
    COMMENT ON POLICY api_keys_self_write ON public.api_keys IS 'core_api_limits_mig';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='api_keys' AND policyname='api_keys_self_update'
  ) THEN
    CREATE POLICY api_keys_self_update
      ON public.api_keys FOR UPDATE
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
    COMMENT ON POLICY api_keys_self_update ON public.api_keys IS 'core_api_limits_mig';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='api_keys' AND policyname='api_keys_service_all'
  ) THEN
    CREATE POLICY api_keys_service_all
      ON public.api_keys FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
    COMMENT ON POLICY api_keys_service_all ON public.api_keys IS 'core_api_limits_mig';
  END IF;
END $$;

-- 2) rate_limit_counters ------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rate_limit_counters (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL,
  scope        text NOT NULL,
  window_start timestamptz NOT NULL,
  hits         integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Merge-safe column adds
ALTER TABLE public.rate_limit_counters
  ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS scope text,
  ADD COLUMN IF NOT EXISTS window_start timestamptz,
  ADD COLUMN IF NOT EXISTS hits integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

-- FK to public.users with stable constraint name
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'rlc_user_fk'
      AND conrelid = 'public.rate_limit_counters'::regclass
  ) THEN
    ALTER TABLE public.rate_limit_counters
      ADD CONSTRAINT rlc_user_fk
      FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Indexes and uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS rlc_user_scope_window_unique_idx
  ON public.rate_limit_counters(user_id, scope, window_start);
CREATE INDEX IF NOT EXISTS rlc_user_created_idx
  ON public.rate_limit_counters(user_id, created_at DESC);

COMMENT ON TABLE public.rate_limit_counters IS 'core_api_limits_mig';

-- RLS
ALTER TABLE public.rate_limit_counters ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='rate_limit_counters' AND policyname='rlc_self_select'
  ) THEN
    CREATE POLICY rlc_self_select
      ON public.rate_limit_counters FOR SELECT
      USING (user_id = auth.uid());
    COMMENT ON POLICY rlc_self_select ON public.rate_limit_counters IS 'core_api_limits_mig';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='rate_limit_counters' AND policyname='rlc_service_all'
  ) THEN
    CREATE POLICY rlc_service_all
      ON public.rate_limit_counters FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
    COMMENT ON POLICY rlc_service_all ON public.rate_limit_counters IS 'core_api_limits_mig';
  END IF;
END $$;

-- ============================================================================
-- DOWN MIGRATION (guarded by table comment markers)
--   Order: drop policies -> drop tables
-- ============================================================================

-- Drop policies (safe) --------------------------------------------------------
DROP POLICY IF EXISTS api_keys_self_select ON public.api_keys;
DROP POLICY IF EXISTS api_keys_self_write ON public.api_keys;
DROP POLICY IF EXISTS api_keys_self_update ON public.api_keys;
DROP POLICY IF EXISTS api_keys_service_all ON public.api_keys;

DROP POLICY IF EXISTS rlc_self_select ON public.rate_limit_counters;
DROP POLICY IF EXISTS rlc_service_all ON public.rate_limit_counters;

-- Drop tables only if created by this migration (check table comment) --------
DO $$
BEGIN
  IF (SELECT obj_description('public.rate_limit_counters'::regclass,'pg_class')) = 'core_api_limits_mig' THEN
    DROP TABLE IF EXISTS public.rate_limit_counters;
  END IF;
END $$;

DO $$
BEGIN
  IF (SELECT obj_description('public.api_keys'::regclass,'pg_class')) = 'core_api_limits_mig' THEN
    DROP TABLE IF EXISTS public.api_keys;
  END IF;
END $$;


