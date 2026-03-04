-- ============================================================
-- Migration 001: Add profile & settings columns to organizations
-- Run this in your Supabase SQL editor (once)
-- ============================================================

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS profile      jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS org_settings jsonb DEFAULT '{}';

-- Profile shape (stored in profile jsonb):
-- {
--   website_url:        text,       -- company website
--   description:        text,       -- about my company
--   industry:           text,       -- e.g. "Technology Consulting"
--   services:           text[],     -- service tags
--   client_names:       text[],     -- notable clients
--   target_geography:   text[],     -- e.g. ["India","USA"]
--   target_industry:    text[],     -- e.g. ["FMCG","Banking"]
--   target_personas:    text[],     -- e.g. ["CIO","CEO"]
--   target_segment:     text[],     -- e.g. ["Enterprise (1000+)"]
--   sales_triggers:     jsonb[],    -- [{id, category, description, is_custom}]
-- }
