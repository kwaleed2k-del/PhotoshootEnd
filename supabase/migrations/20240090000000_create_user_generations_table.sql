-- Migration: Create base public.user_generations table
-- Purpose: Provide the base table so later migrations can extend it and other tables can reference it
-- Notes:
-- - This does NOT alter credit/analytics; those are added in later migrations
-- - Keep schema minimal and idempotent

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.user_generations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  generation_type text NOT NULL, -- e.g. 'apparel' | 'product' | 'video'
  prompt text NULL,
  settings jsonb NULL,
  result_urls text[] NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Helpful index for common queries
CREATE INDEX IF NOT EXISTS user_generations_user_created_idx
  ON public.user_generations (user_id, created_at DESC);

-- Enable RLS (policies are applied in later migrations)
ALTER TABLE public.user_generations ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- ROLLBACK SECTION
-- ============================================================================
-- To rollback this migration (only if safe to do so):
-- BEGIN;
--   DROP INDEX IF EXISTS public.user_generations_user_created_idx;
--   DROP TABLE IF EXISTS public.user_generations;
-- COMMIT;


