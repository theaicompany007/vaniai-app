-- Playbook state per org (replaces localStorage so prod/dev share state)
-- Idempotent: safe to run when table/policy already exist.
CREATE TABLE IF NOT EXISTS playbooks (
  org_id     uuid PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  company    text NOT NULL,
  industry   text NOT NULL DEFAULT '',
  steps      jsonb NOT NULL DEFAULT '{}',
  started_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE playbooks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "member_all_playbooks" ON playbooks;
CREATE POLICY "member_all_playbooks" ON playbooks FOR ALL
  USING (org_id IN (SELECT get_my_org_ids()));

COMMENT ON TABLE playbooks IS 'Active company playbook per org (company, industry, step progress)';
