-- Migration: Extend users table for SaaS transformation
-- Table Modified: users (public schema, NOT auth.users)
-- Purpose: Add credit system, subscription management, and Stripe integration fields
-- This migration is non-breaking and safe to run on production

-- Add credit balance columns
ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS credits_balance INTEGER NOT NULL DEFAULT 0;

ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS credits_total_purchased INTEGER NOT NULL DEFAULT 0;

-- Add subscription plan column with CHECK constraint
ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS subscription_plan TEXT NOT NULL DEFAULT 'free';

-- Add CHECK constraint (PostgreSQL doesn't support IF NOT EXISTS for constraints, 
-- but this is safe as Supabase tracks applied migrations)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_subscription_plan'
  ) THEN
    ALTER TABLE users 
      ADD CONSTRAINT check_subscription_plan 
      CHECK (subscription_plan IN ('free', 'starter', 'professional', 'enterprise'));
  END IF;
END $$;

-- Add subscription status column with CHECK constraint
ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS subscription_status TEXT NOT NULL DEFAULT 'trialing';

-- Add CHECK constraint (idempotent check)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_subscription_status'
  ) THEN
    ALTER TABLE users 
      ADD CONSTRAINT check_subscription_status 
      CHECK (subscription_status IN ('active', 'canceled', 'past_due', 'trialing'));
  END IF;
END $$;

-- Add subscription date columns
ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS subscription_start_date TIMESTAMPTZ NULL;

ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS subscription_end_date TIMESTAMPTZ NULL;

-- Add billing email column
ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS billing_email TEXT NULL;

-- Add Stripe integration columns
ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT NULL;

ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT NULL;

-- Create partial unique indexes for Stripe IDs (only unique when NOT NULL)
CREATE UNIQUE INDEX IF NOT EXISTS users_stripe_customer_id_uidx
  ON users (stripe_customer_id) 
  WHERE stripe_customer_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS users_stripe_subscription_id_uidx
  ON users (stripe_subscription_id) 
  WHERE stripe_subscription_id IS NOT NULL;

-- ============================================================================
-- ROLLBACK SECTION
-- ============================================================================
-- To rollback this migration, execute the following SQL statements in order:
-- 
-- -- Drop partial unique indexes
-- DROP INDEX IF EXISTS users_stripe_subscription_id_uidx;
-- DROP INDEX IF EXISTS users_stripe_customer_id_uidx;
-- 
-- -- Drop CHECK constraints
-- ALTER TABLE users DROP CONSTRAINT IF EXISTS check_subscription_status;
-- ALTER TABLE users DROP CONSTRAINT IF EXISTS check_subscription_plan;
-- 
-- -- Drop columns
-- ALTER TABLE users DROP COLUMN IF EXISTS stripe_subscription_id;
-- ALTER TABLE users DROP COLUMN IF EXISTS stripe_customer_id;
-- ALTER TABLE users DROP COLUMN IF EXISTS billing_email;
-- ALTER TABLE users DROP COLUMN IF EXISTS subscription_end_date;
-- ALTER TABLE users DROP COLUMN IF EXISTS subscription_start_date;
-- ALTER TABLE users DROP COLUMN IF EXISTS subscription_status;
-- ALTER TABLE users DROP COLUMN IF EXISTS subscription_plan;
-- ALTER TABLE users DROP COLUMN IF EXISTS credits_total_purchased;
-- ALTER TABLE users DROP COLUMN IF EXISTS credits_balance;

