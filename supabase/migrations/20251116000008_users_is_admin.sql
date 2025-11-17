-- ============================================================================
-- Migration: Add is_admin flag to users
-- Filename: 20251116000008_users_is_admin.sql
-- ============================================================================

ALTER TABLE public.users
	ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS users_is_admin_idx
	ON public.users (is_admin)
	WHERE is_admin = true;

-- ============================================================================
-- DOWN MIGRATION
-- ============================================================================
ALTER TABLE public.users
	DROP COLUMN IF EXISTS is_admin;


