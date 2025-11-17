-- Migration: Create application users table (public.users)
-- Purpose: Provide the app-level users table (distinct from auth.users) so later migrations can ALTER it
-- Notes:
-- - This does NOT touch auth.users; it creates public.users if missing
-- - The primary key matches Supabase Auth UUIDs; provisioning trigger (Migration 1.12) will sync rows on signup
-- - Kept minimal; subsequent migrations extend columns and policies

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create the table if it does not exist
CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY,
  email text UNIQUE,
  -- Legacy/demo fields (non-blocking); later migrations add SaaS columns
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Ensure RLS is enabled (policies added in later migrations)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Helpful index for lookups by created_at
CREATE INDEX IF NOT EXISTS users_created_at_idx ON public.users (created_at DESC);

-- ============================================================================
-- ROLLBACK SECTION
-- ============================================================================
-- To rollback this migration (only if you are sure nothing depends on it):
-- BEGIN;
--   DROP INDEX IF EXISTS public.users_created_at_idx;
--   DROP TABLE IF EXISTS public.users;
-- COMMIT;


