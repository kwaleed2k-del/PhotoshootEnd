-- ============================================================================
-- Migration: Extend public.users profile fields with RLS-safe, idempotent DDL
-- Filename: 20251116000000_extend_users_profile.sql
--
-- Intent:
--   - Ensure RLS is enabled on public.users
--   - Add commonly used profile fields with safe defaults
--   - Provide an updated_at trigger that bumps timestamp on updates
--   - Define minimal, strict RLS policies:
--       * users_self_select: users can SELECT their own row
--       * users_self_update: users can UPDATE their own row
--       * users_admin_all:   service_role can do ALL operations
--   - Idempotent: safe to run multiple times (CI, reset)
--
-- How to test (examples):
--   1) With a user JWT (not service_role):
--      - SELECT * FROM public.users;  -- returns only your row
--      - UPDATE public.users SET display_name = 'Test' WHERE id = auth.uid(); -- succeeds
--      - UPDATE public.users SET display_name = 'Nope' WHERE id <> auth.uid(); -- denied
--   2) With a service_role JWT:
--      - SELECT/UPDATE any user works
--   3) updated_at bump:
--      - UPDATE public.users SET display_name = 'Bump' WHERE id = auth.uid();
--      - Observe updated_at changes, created_at stays unchanged
--
-- Dependencies:
--   - public.users exists with primary key id uuid
--   - Supabase/Postgres with auth.uid() and auth.role()
-- ============================================================================

-- Ensure RLS is enabled
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Add columns if not exists
DO $$
BEGIN
  -- username text
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'username'
  ) THEN
    ALTER TABLE public.users
      ADD COLUMN IF NOT EXISTS username text;
    COMMENT ON COLUMN public.users.username IS 'added_by_migration=20251116000000_extend_users_profile';
  END IF;

  -- avatar_url text
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'avatar_url'
  ) THEN
    ALTER TABLE public.users
      ADD COLUMN IF NOT EXISTS avatar_url text;
    COMMENT ON COLUMN public.users.avatar_url IS 'added_by_migration=20251116000000_extend_users_profile';
  END IF;

  -- display_name text
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'display_name'
  ) THEN
    ALTER TABLE public.users
      ADD COLUMN IF NOT EXISTS display_name text;
    COMMENT ON COLUMN public.users.display_name IS 'added_by_migration=20251116000000_extend_users_profile';
  END IF;

  -- locale text NOT NULL DEFAULT 'en'
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'locale'
  ) THEN
    ALTER TABLE public.users
      ADD COLUMN IF NOT EXISTS locale text NOT NULL DEFAULT 'en';
    COMMENT ON COLUMN public.users.locale IS 'added_by_migration=20251116000000_extend_users_profile';
  END IF;

  -- timezone text NOT NULL DEFAULT 'Asia/Riyadh'
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'timezone'
  ) THEN
    ALTER TABLE public.users
      ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Asia/Riyadh';
    COMMENT ON COLUMN public.users.timezone IS 'added_by_migration=20251116000000_extend_users_profile';
  END IF;

  -- marketing_opt_in boolean NOT NULL DEFAULT false
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'marketing_opt_in'
  ) THEN
    ALTER TABLE public.users
      ADD COLUMN IF NOT EXISTS marketing_opt_in boolean NOT NULL DEFAULT false;
    COMMENT ON COLUMN public.users.marketing_opt_in IS 'added_by_migration=20251116000000_extend_users_profile';
  END IF;

  -- created_at timestamptz NOT NULL DEFAULT now()
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'created_at'
  ) THEN
    ALTER TABLE public.users
      ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
    COMMENT ON COLUMN public.users.created_at IS 'added_by_migration=20251116000000_extend_users_profile';
  END IF;

  -- updated_at timestamptz NOT NULL DEFAULT now()
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.users
      ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
    COMMENT ON COLUMN public.users.updated_at IS 'added_by_migration=20251116000000_extend_users_profile';
  END IF;
END
$$;

-- Ensure username is unique via unique index (idempotent)
-- Using an explicit index name to avoid clashes with pre-existing constraints
CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique_idx
  ON public.users (username);
COMMENT ON INDEX users_username_unique_idx IS 'added_by_migration=20251116000000_extend_users_profile';

-- Create or replace the updated_at trigger function
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- Recreate the trigger idempotently
DROP TRIGGER IF EXISTS users_set_updated_at ON public.users;
CREATE TRIGGER users_set_updated_at
BEFORE UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- Minimal RLS Policies (idempotent via pg_policies checks)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'users'
      AND policyname = 'users_self_select'
  ) THEN
    CREATE POLICY users_self_select
      ON public.users
      FOR SELECT
      USING (id = auth.uid());
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'users'
      AND policyname = 'users_self_update'
  ) THEN
    CREATE POLICY users_self_update
      ON public.users
      FOR UPDATE
      USING (id = auth.uid())
      WITH CHECK (id = auth.uid());
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'users'
      AND policyname = 'users_admin_all'
  ) THEN
    CREATE POLICY users_admin_all
      ON public.users
      FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END$$;

-- ============================================================================
-- DOWN MIGRATION
--   Attempt to revert only objects created by this migration.
--   We identify such objects via COMMENT markers where possible.
-- ============================================================================

-- Drop trigger (safe)
DROP TRIGGER IF EXISTS users_set_updated_at ON public.users;

-- Optionally drop the unique index if this migration created it
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename  = 'users'
      AND indexname  = 'users_username_unique_idx'
  ) AND (
    SELECT obj_description(i.indexrelid, 'pg_class')
    FROM pg_class t
    JOIN pg_index i ON t.oid = i.indrelid
    JOIN pg_class ic ON ic.oid = i.indexrelid
    WHERE ic.relname = 'users_username_unique_idx'
    LIMIT 1
  ) = 'added_by_migration=20251116000000_extend_users_profile' THEN
    DROP INDEX IF EXISTS public.users_username_unique_idx;
  END IF;
END
$$;

-- Remove policies if they exist
DROP POLICY IF EXISTS users_self_select ON public.users;
DROP POLICY IF EXISTS users_self_update ON public.users;
DROP POLICY IF EXISTS users_admin_all ON public.users;

-- Drop columns only if they were created by this migration (checked via comment)
DO $$
DECLARE
  v_mark constant text := 'added_by_migration=20251116000000_extend_users_profile';
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns c
    JOIN pg_catalog.pg_class t  ON t.relname = c.table_name
    JOIN pg_catalog.pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND c.table_name = 'users'
      AND c.column_name = 'username'
  ) AND col_description('public.users'::regclass, (
        SELECT ordinal_position
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'username'
      )) = v_mark THEN
    ALTER TABLE public.users DROP COLUMN IF EXISTS username;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'avatar_url'
  ) AND col_description('public.users'::regclass, (
        SELECT ordinal_position
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'avatar_url'
      )) = v_mark THEN
    ALTER TABLE public.users DROP COLUMN IF EXISTS avatar_url;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'display_name'
  ) AND col_description('public.users'::regclass, (
        SELECT ordinal_position
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'display_name'
      )) = v_mark THEN
    ALTER TABLE public.users DROP COLUMN IF EXISTS display_name;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'locale'
  ) AND col_description('public.users'::regclass, (
        SELECT ordinal_position
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'locale'
      )) = v_mark THEN
    ALTER TABLE public.users DROP COLUMN IF EXISTS locale;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'timezone'
  ) AND col_description('public.users'::regclass, (
        SELECT ordinal_position
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'timezone'
      )) = v_mark THEN
    ALTER TABLE public.users DROP COLUMN IF EXISTS timezone;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'marketing_opt_in'
  ) AND col_description('public.users'::regclass, (
        SELECT ordinal_position
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'marketing_opt_in'
      )) = v_mark THEN
    ALTER TABLE public.users DROP COLUMN IF EXISTS marketing_opt_in;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'created_at'
  ) AND col_description('public.users'::regclass, (
        SELECT ordinal_position
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'created_at'
      )) = v_mark THEN
    ALTER TABLE public.users DROP COLUMN IF EXISTS created_at;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'updated_at'
  ) AND col_description('public.users'::regclass, (
        SELECT ordinal_position
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'updated_at'
      )) = v_mark THEN
    ALTER TABLE public.users DROP COLUMN IF EXISTS updated_at;
  END IF;
END
$$;


