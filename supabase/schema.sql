-- ============================================================
-- Vani AI — Complete Standalone Supabase Schema
-- Run this in your dedicated Supabase project's SQL editor
-- WARNING: DROP statements will erase ALL existing data!
-- ============================================================

-- ============================================================
-- STEP 0: CLEAN SLATE — Drop everything in reverse-dependency order
-- ============================================================

DROP TABLE IF EXISTS knowledge_chunks     CASCADE;
DROP TABLE IF EXISTS kb_collections       CASCADE;
DROP TABLE IF EXISTS playbooks            CASCADE;
DROP TABLE IF EXISTS chat_messages        CASCADE;
DROP TABLE IF EXISTS research_sessions    CASCADE;
DROP TABLE IF EXISTS documents            CASCADE;
DROP TABLE IF EXISTS opportunities        CASCADE;
DROP TABLE IF EXISTS contacts             CASCADE;
DROP TABLE IF EXISTS accounts             CASCADE;
DROP TABLE IF EXISTS signals              CASCADE;
DROP TABLE IF EXISTS invoices             CASCADE;
DROP TABLE IF EXISTS subscriptions        CASCADE;
DROP TABLE IF EXISTS promo_codes          CASCADE;
DROP TABLE IF EXISTS pending_invites      CASCADE;
DROP TABLE IF EXISTS org_memberships      CASCADE;
DROP TABLE IF EXISTS organizations        CASCADE;

DROP FUNCTION IF EXISTS get_my_org_ids()  CASCADE;
DROP FUNCTION IF EXISTS match_knowledge   CASCADE;

-- ============================================================
-- STEP 1: EXTENSIONS
-- ============================================================

CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- PART 1: MULTI-TENANT CORE
-- ============================================================

CREATE TABLE organizations (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name                  text NOT NULL,
  slug                  text UNIQUE NOT NULL,
  owner_user_id         uuid,
  subscription_tier     text DEFAULT 'starter',    -- 'starter'|'pro'|'enterprise'
  subscription_status   text DEFAULT 'trial',       -- 'trial'|'active'|'cancelled'|'past_due'
  trial_ends_at         timestamptz DEFAULT now() + interval '14 days',
  razorpay_customer_id  text,
  -- Company profile & ICP data (populated via Settings page)
  profile               jsonb DEFAULT '{}',
  -- App-level settings (timezone, notifications, etc.)
  org_settings          jsonb DEFAULT '{}',
  created_at            timestamptz DEFAULT now()
);

-- profile jsonb shape:
-- {
--   "website_url": "https://example.com",
--   "tagline": "...",
--   "description": "...",
--   "founded_year": "2020",
--   "employee_count": "50-200",
--   "headquarters": "Mumbai, India",
--   "industries": ["IT Services", "Consulting"],
--   "services": ["AI/GenAI", "Cloud Migration", "ERP"],
--   "client_names": ["Tata", "Infosys"],
--   "icp": {
--     "geographies": ["India", "Southeast Asia"],
--     "industries":  ["BFSI", "Healthcare"],
--     "personas":    ["CTO", "CIO"],
--     "segments":    ["Mid-Market", "Enterprise"]
--   },
--   "sales_triggers": [
--     { "id": "1", "label": "New CTO/CIO hired", "category": "Leadership" }
--   ]
-- }

CREATE TABLE org_memberships (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id     uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  user_id    uuid NOT NULL,   -- references auth.users(id)
  role       text DEFAULT 'member',  -- 'owner'|'admin'|'member' (owner = org creator, one per org)
  created_at timestamptz DEFAULT now(),
  UNIQUE(org_id, user_id)
);

-- Active playbook per org (company, industry, step progress)
CREATE TABLE playbooks (
  org_id     uuid PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  company    text NOT NULL,
  industry   text NOT NULL DEFAULT '',
  steps      jsonb NOT NULL DEFAULT '{}',
  started_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Pending invites: token-based invite flow (email, org, role, token, expiry)
CREATE TABLE pending_invites (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  email      text NOT NULL,
  org_id     uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  role       text NOT NULL DEFAULT 'member',  -- 'admin'|'member' (never owner)
  token      uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days')
);

-- ============================================================
-- PART 2: BILLING
-- ============================================================

CREATE TABLE subscriptions (
  id                       uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id                   uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  plan_id                  text NOT NULL,   -- 'starter'|'pro'|'enterprise'
  status                   text DEFAULT 'created',
  razorpay_subscription_id text,
  is_dummy                 boolean DEFAULT false,
  amount                   integer,         -- in paise
  currency                 text DEFAULT 'INR',
  discount_amount          integer DEFAULT 0,
  promo_code               text,
  current_start            timestamptz,
  current_end              timestamptz,
  created_at               timestamptz DEFAULT now()
);

CREATE TABLE invoices (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id                uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  subscription_id       uuid REFERENCES subscriptions(id) ON DELETE SET NULL,
  razorpay_invoice_id   text,
  amount                integer,
  currency              text DEFAULT 'INR',
  status                text DEFAULT 'paid',
  paid_at               timestamptz DEFAULT now(),
  created_at            timestamptz DEFAULT now()
);

CREATE TABLE promo_codes (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  code             text UNIQUE NOT NULL,
  discount_type    text NOT NULL,   -- 'percentage'|'fixed'
  discount_value   integer NOT NULL,
  applicable_plans text[] DEFAULT ARRAY['starter','pro','enterprise'],
  max_uses         integer,
  current_uses     integer DEFAULT 0,
  expires_at       timestamptz,
  is_active        boolean DEFAULT true,
  created_at       timestamptz DEFAULT now()
);

INSERT INTO promo_codes (code, discount_type, discount_value, max_uses) VALUES
  ('BETA50',    'percentage', 50,  100),
  ('LAUNCH100', 'percentage', 100, 50),
  ('EARLYBIRD', 'fixed',      50000, 200);  -- ₹500 off

-- ============================================================
-- PART 3: DOMAIN DATA
-- ============================================================

CREATE TABLE signals (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id           uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  company          text NOT NULL,
  company_initials text NOT NULL,
  company_color    text DEFAULT '#6366f1',
  score            numeric(3,1) DEFAULT 3.0,
  tag              text,
  tag_color        text DEFAULT 'blue',
  source           text,
  posted_ago       text,
  published_at     timestamptz DEFAULT now(),
  segment_match    text DEFAULT 'Medium',
  title            text NOT NULL,
  summary          text,
  services         text[],
  ai_relevance     text,
  url              text,
  is_bookmarked    boolean DEFAULT false,
  generated_by     text DEFAULT 'Vigil',
  created_at       timestamptz DEFAULT now()
);

CREATE TABLE accounts (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id           uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  name             text NOT NULL,
  industry         text,
  location         text,
  website          text,
  description      text,
  is_watchlisted   boolean DEFAULT false,
  created_at       timestamptz DEFAULT now()
);

CREATE TABLE contacts (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id       uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  name         text NOT NULL,
  avatar       text,
  job_title    text,
  company      text,
  account_id   uuid REFERENCES accounts(id) ON DELETE SET NULL,
  industry     text,
  location     text,
  email        text,
  phone        text,
  linkedin_url text,
  source       text,
  created_at   timestamptz DEFAULT now()
);

CREATE TABLE opportunities (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id      uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  name        text NOT NULL,
  account     text,
  account_id  uuid REFERENCES accounts(id) ON DELETE SET NULL,
  owner       text DEFAULT 'You',
  stage       text DEFAULT 'Discovery',
  industry    text,
  people      integer DEFAULT 0,
  source_url  text,
  signal_id   uuid REFERENCES signals(id) ON DELETE SET NULL,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE documents (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id       uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  title        text NOT NULL,
  type         text DEFAULT 'Pitch',
  status       text DEFAULT 'Draft',
  content      text,
  storage_path text,
  generated_by text DEFAULT 'Varta',
  created_at   timestamptz DEFAULT now()
);

CREATE TABLE research_sessions (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id     uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  name       text,
  query      text,
  result     text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE chat_sessions (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id     uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  agent      text DEFAULT 'Vidya',
  name       text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE chat_messages (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id     uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  role       text NOT NULL,
  content    text NOT NULL,
  agent      text DEFAULT 'Vidya',
  session_id uuid REFERENCES chat_sessions(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- PART 4: KNOWLEDGE BASE (pgvector)
-- ============================================================

CREATE TABLE kb_collections (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id     uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  name       text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(org_id, name)
);

CREATE TABLE knowledge_chunks (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id        uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  collection_id uuid REFERENCES kb_collections(id) ON DELETE CASCADE NOT NULL,
  content       text NOT NULL,
  embedding     vector(1536),
  source_file   text,
  metadata      jsonb DEFAULT '{}',
  created_at    timestamptz DEFAULT now()
);

-- Vector similarity search function
CREATE OR REPLACE FUNCTION match_knowledge(
  query_embedding vector(1536),
  match_org_id    uuid,
  match_threshold float DEFAULT 0.65,
  match_count     int   DEFAULT 5
)
RETURNS TABLE (id uuid, content text, source_file text, similarity float)
LANGUAGE sql STABLE AS $$
  SELECT
    id,
    content,
    source_file,
    1 - (embedding <=> query_embedding) AS similarity
  FROM knowledge_chunks
  WHERE
    org_id = match_org_id
    AND 1 - (embedding <=> query_embedding) > match_threshold
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;

-- IVFFlat index for fast ANN search
CREATE INDEX ON knowledge_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ============================================================
-- PART 5: ROW LEVEL SECURITY
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE organizations      ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_memberships    ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices           ENABLE ROW LEVEL SECURITY;
ALTER TABLE signals            ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts           ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts           ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunities      ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents          ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_sessions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE playbooks         ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages     ENABLE ROW LEVEL SECURITY;
ALTER TABLE kb_collections     ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_chunks   ENABLE ROW LEVEL SECURITY;

-- Helper function: get org_ids for current user (SECURITY DEFINER = no RLS recursion)
CREATE OR REPLACE FUNCTION get_my_org_ids()
RETURNS SETOF uuid
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT org_id FROM org_memberships WHERE user_id = auth.uid();
$$;

-- ── org_memberships: users see only their own rows ──
CREATE POLICY "own_memberships" ON org_memberships FOR ALL
  USING (user_id = auth.uid());

-- ── organizations: members can read their org; owner can update ──
CREATE POLICY "org_read" ON organizations FOR SELECT
  USING (id IN (SELECT get_my_org_ids()));
CREATE POLICY "org_update" ON organizations FOR UPDATE
  USING (owner_user_id = auth.uid());
CREATE POLICY "org_insert" ON organizations FOR INSERT
  WITH CHECK (true); -- handled by service role in signup flow

-- ── subscriptions: org members read only ──
CREATE POLICY "sub_read" ON subscriptions FOR SELECT
  USING (org_id IN (SELECT get_my_org_ids()));

-- ── invoices: org members read only ──
CREATE POLICY "invoice_read" ON invoices FOR SELECT
  USING (org_id IN (SELECT get_my_org_ids()));

-- ── Domain data: full CRUD for org members (loop over all 9 tables) ──
DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'signals','accounts','contacts','opportunities',
    'documents','research_sessions','playbooks','chat_sessions','chat_messages',
    'kb_collections','knowledge_chunks'
  ])
  LOOP
    EXECUTE format(
      'CREATE POLICY "member_all_%s" ON %I FOR ALL USING (org_id IN (SELECT get_my_org_ids()))',
      tbl, tbl
    );
  END LOOP;
END;
$$;

-- ============================================================
-- PART 6: STORAGE POLICY (run after creating 'org-files' bucket in dashboard)
-- ============================================================

-- Uncomment after creating the 'org-files' private bucket in Supabase Storage:
-- CREATE POLICY "org_storage" ON storage.objects FOR ALL
--   USING (
--     bucket_id = 'org-files'
--     AND (storage.foldername(name))[1] IN (
--       SELECT org_id::text FROM org_memberships WHERE user_id = auth.uid()
--     )
--   );

-- ============================================================
-- DONE — Schema ready.
-- ============================================================
-- Next steps:
-- 1. Run this in Supabase SQL editor (replace existing schema)
-- 2. Create Storage bucket 'org-files' (private) in Supabase dashboard
-- 3. Uncomment the storage policy above and run it
-- 4. Update Supabase Auth → Site URL + Redirect URLs
-- 5. Run the seed script: npx ts-node --project tsconfig.seed.json scripts/seed.ts
-- ============================================================
