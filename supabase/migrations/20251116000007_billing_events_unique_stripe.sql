-- ============================================================================
-- Migration: Ensure billing_events stripe_object_id uniqueness
-- Filename: 20251116000007_billing_events_unique_stripe.sql
--
-- Intent:
--   - Prevent duplicate processing of Stripe events by enforcing uniqueness
--     on stripe_object_id (when present).
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS billing_events_stripe_unique_idx
  ON public.billing_events(stripe_object_id)
  WHERE stripe_object_id IS NOT NULL;

-- ============================================================================
-- DOWN MIGRATION
-- ============================================================================
DROP INDEX IF EXISTS billing_events_stripe_unique_idx;


