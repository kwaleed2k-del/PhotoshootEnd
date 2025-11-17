-- User Provisioning Trigger (Standalone SQL)
-- 
-- This file contains the standalone SQL for the user provisioning trigger.
-- The same trigger is also included in Migration 1.12.
-- 
-- Purpose: Automatically creates public.users row when auth.users row is created.
-- Ensures public.users.id = auth.users.id immediately so RLS self-select policies work.

-- Helper function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  INSERT INTO public.users (id, email, subscription_plan, credits_balance, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    'free',  -- Default plan
    0,       -- Default credits
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;  -- Idempotent: don't error if row already exists
  RETURN NEW;
END;
$$;

-- Drop trigger if it exists (idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger on auth.users insert
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Add comment for documentation
COMMENT ON FUNCTION public.handle_new_user() IS 
  'Automatically provisions public.users row when auth.users row is created. Ensures RLS policies work correctly.';

