-- ============================================================================
-- Migration: Add bump_rate_limit RPC for rate limiting
-- Filename: 20251116000006_bump_rate_limit.sql
--
-- Intent:
--   - Provide an atomic function to increment per-user scope counters
--     in public.rate_limit_counters.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.bump_rate_limit(
  p_user_id uuid,
  p_scope text,
  p_window_start timestamptz
)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_hits integer;
BEGIN
  INSERT INTO public.rate_limit_counters (user_id, scope, window_start, hits)
  VALUES (p_user_id, p_scope, p_window_start, 1)
  ON CONFLICT (user_id, scope, window_start)
  DO UPDATE SET hits = public.rate_limit_counters.hits + 1
  RETURNING hits INTO v_hits;
  RETURN v_hits;
END;
$$;

COMMENT ON FUNCTION public.bump_rate_limit(uuid, text, timestamptz) IS 'rate_limit_bump_mig';

-- ============================================================================
-- DOWN MIGRATION
-- ============================================================================
DROP FUNCTION IF EXISTS public.bump_rate_limit(uuid, text, timestamptz);


