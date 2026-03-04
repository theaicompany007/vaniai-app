-- ============================================================
-- Migration 002: pending_invites table + Owner role backfill
-- Run this in your Supabase SQL editor (once)
-- ============================================================

-- Add pending_invites if not exists (for existing deployments)
CREATE TABLE IF NOT EXISTS pending_invites (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  email      text NOT NULL,
  org_id     uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  role       text NOT NULL DEFAULT 'member',
  token      uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days')
);

-- Backfill: set org_memberships.role = 'owner' where user is the org creator
-- (Existing users like rajvins@theaicompany.co become Owner; no re-verification)
UPDATE org_memberships m
SET role = 'owner'
FROM organizations o
WHERE m.org_id = o.id
  AND m.user_id = o.owner_user_id
  AND (m.role IS NULL OR m.role != 'owner');
