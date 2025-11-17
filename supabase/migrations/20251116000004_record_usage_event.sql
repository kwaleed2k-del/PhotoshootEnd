-- ============================================================================
-- Migration: Atomic usage event recording with credit consumption
-- Filename: 20251116000004_record_usage_event.sql
--
-- Intent:
--   - Provide a single RPC to atomically consume credits and record a usage event
--     in one transaction. SECURITY INVOKER (must be called with service role).
--   - Idempotent via CREATE OR REPLACE. Includes comment marker and clean DOWN.
--
-- Test notes:
--   - With service role:
--       SELECT public.record_usage_event(:uid, 'image.generate', 2, 100, 'abc', '{"env":"dev"}');
--         -> creates event, returns {"was_duplicate": false, ...}, balance decremented
--       SELECT public.record_usage_event(:uid, 'image.generate', 2, 100, 'abc', '{"env":"dev"}');
--         -> returns {"was_duplicate": true, ...}, no double charge
--       Over-consume path:
--         -> raises P0001 (INSUFFICIENT_CREDITS) from consume_credits
--   - With user JWT (not service role):
--       Direct INSERT into public.usage_events remains blocked by RLS.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.record_usage_event(
  p_user_id    uuid,
  p_event_type text,
  p_cost       int,
  p_tokens     int DEFAULT NULL,
  p_request_id text DEFAULT NULL,
  p_metadata   jsonb DEFAULT '{}'::jsonb
)
RETURNS json
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_event_id    uuid;
  v_new_balance int;
  v_dup         boolean := false;
BEGIN
  -- basic validation
  IF p_user_id IS NULL OR p_event_type IS NULL OR p_event_type = '' THEN
    RAISE EXCEPTION 'INVALID_INPUT';
  END IF;
  IF p_cost IS NULL OR p_cost <= 0 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT';
  END IF;

  -- idempotency: if request_id provided and already exists, return existing without charging again
  IF p_request_id IS NOT NULL THEN
    SELECT id INTO v_event_id
    FROM public.usage_events
    WHERE request_id = p_request_id;

    IF v_event_id IS NOT NULL THEN
      v_dup := true;
      v_new_balance := public.get_credit_balance(p_user_id);
      RETURN json_build_object('event_id', v_event_id, 'new_balance', v_new_balance, 'was_duplicate', v_dup);
    END IF;
  END IF;

  -- serialize per user (same advisory lock strategy as consume_credits)
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'hashtextextended') THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 42));
  ELSE
    PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text));
  END IF;

  -- consume credits (raises P0001 INSUFFICIENT_CREDITS if not enough)
  v_new_balance := public.consume_credits(p_user_id, p_cost, 'usage:' || p_event_type, p_metadata);

  -- insert usage event
  INSERT INTO public.usage_events (user_id, event_type, cost, tokens, request_id, metadata)
  VALUES (p_user_id, p_event_type, p_cost, p_tokens, p_request_id, COALESCE(p_metadata, '{}'::jsonb))
  RETURNING id INTO v_event_id;

  RETURN json_build_object('event_id', v_event_id, 'new_balance', v_new_balance, 'was_duplicate', v_dup);
END;
$$;

COMMENT ON FUNCTION public.record_usage_event(uuid, text, int, int, text, jsonb) IS 'usage_record_mig';

-- ============================================================================
-- DOWN MIGRATION
-- ============================================================================
DROP FUNCTION IF EXISTS public.record_usage_event(uuid, text, int, int, text, jsonb);


