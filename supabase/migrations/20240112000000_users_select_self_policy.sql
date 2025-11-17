-- Migration: Add read-only SELECT policy for users table
-- Purpose: Allow authenticated users to read their own user record via RLS
-- This migration is idempotent and safe for production

-- Ensure RLS is enabled on public.users (don't disable anything)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Create read-only select-self policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'users'
      AND policyname = 'users_select_self'
  ) THEN
    CREATE POLICY "users_select_self"
      ON public.users FOR SELECT
      USING (auth.uid() = id);
  END IF;
END $$;

-- ============================================================================
-- ROLLBACK SECTION
-- ============================================================================
-- To rollback this migration, execute the following statement:
--
-- DROP POLICY IF EXISTS "users_select_self" ON public.users;

