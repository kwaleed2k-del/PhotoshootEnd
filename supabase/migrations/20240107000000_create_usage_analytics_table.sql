-- Migration: Create usage_analytics table for SaaS analytics
-- Purpose: Store daily aggregates per user and generation type
-- This migration is idempotent and safe to run on production

CREATE TABLE IF NOT EXISTS public.usage_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  generation_type TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  credits_used INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique composite index for upsert operations
CREATE UNIQUE INDEX IF NOT EXISTS usage_analytics_unique_day
  ON public.usage_analytics (user_id, date, generation_type);

-- Helpful index for time-series queries
CREATE INDEX IF NOT EXISTS usage_analytics_user_date_idx
  ON public.usage_analytics (user_id, date DESC);

-- Enable Row Level Security
ALTER TABLE public.usage_analytics ENABLE ROW LEVEL SECURITY;

-- Allow users to view their own usage analytics
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'usage_analytics' 
      AND policyname = 'usage_analytics_select_self'
  ) THEN
    CREATE POLICY "usage_analytics_select_self"
      ON public.usage_analytics FOR SELECT
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
-- DROP POLICY IF EXISTS "usage_analytics_select_self" ON public.usage_analytics;
-- DROP INDEX IF EXISTS usage_analytics_user_date_idx;
-- DROP INDEX IF EXISTS usage_analytics_unique_day;
-- DROP TABLE IF EXISTS public.usage_analytics;
--
-- COMMIT;
