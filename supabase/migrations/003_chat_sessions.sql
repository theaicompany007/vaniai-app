-- Chat sessions for Chat tab history panel (same pattern as Research)
-- Idempotent: safe to run when table/column/policy already exist.
CREATE TABLE IF NOT EXISTS chat_sessions (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id     uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  agent      text DEFAULT 'Vidya',
  name       text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES chat_sessions(id) ON DELETE SET NULL;

ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "member_all_chat_sessions" ON chat_sessions;
CREATE POLICY "member_all_chat_sessions" ON chat_sessions FOR ALL
  USING (org_id IN (SELECT get_my_org_ids()));

COMMENT ON TABLE chat_sessions IS 'Chat conversation sessions for History panel (Vidya etc.)';
