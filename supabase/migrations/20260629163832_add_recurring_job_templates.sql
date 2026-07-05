-- Job templates scoped to a recurring job (pre-fill fields when creating new jobs).

CREATE TABLE IF NOT EXISTS recurring_job_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recurring_job_id UUID NOT NULL REFERENCES recurring_jobs(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status job_status NOT NULL DEFAULT 'planned',
  duration_hours NUMERIC(5, 2) NOT NULL DEFAULT 3,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recurring_job_templates_recurring_job_id
  ON recurring_job_templates(recurring_job_id);

CREATE INDEX IF NOT EXISTS idx_recurring_job_templates_company_id
  ON recurring_job_templates(company_id);

DROP TRIGGER IF EXISTS recurring_job_templates_updated_at ON recurring_job_templates;
CREATE TRIGGER recurring_job_templates_updated_at
  BEFORE UPDATE ON recurring_job_templates
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

ALTER TABLE recurring_job_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view recurring job templates for their companies" ON recurring_job_templates;
CREATE POLICY "Users can view recurring job templates for their companies"
  ON recurring_job_templates
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM company_users
      WHERE company_users.company_id = recurring_job_templates.company_id
        AND company_users.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

DROP POLICY IF EXISTS "Users can create recurring job templates for their companies" ON recurring_job_templates;
CREATE POLICY "Users can create recurring job templates for their companies"
  ON recurring_job_templates
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_users
      WHERE company_users.company_id = recurring_job_templates.company_id
        AND company_users.user_id = auth.uid()
        AND company_users.role IN ('owner', 'super_user', 'employee')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

DROP POLICY IF EXISTS "Users can update recurring job templates for their companies" ON recurring_job_templates;
CREATE POLICY "Users can update recurring job templates for their companies"
  ON recurring_job_templates
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM company_users
      WHERE company_users.company_id = recurring_job_templates.company_id
        AND company_users.user_id = auth.uid()
        AND company_users.role IN ('owner', 'super_user', 'employee')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_users
      WHERE company_users.company_id = recurring_job_templates.company_id
        AND company_users.user_id = auth.uid()
        AND company_users.role IN ('owner', 'super_user', 'employee')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

DROP POLICY IF EXISTS "Users can delete recurring job templates for their companies" ON recurring_job_templates;
CREATE POLICY "Users can delete recurring job templates for their companies"
  ON recurring_job_templates
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM company_users
      WHERE company_users.company_id = recurring_job_templates.company_id
        AND company_users.user_id = auth.uid()
        AND company_users.role IN ('owner', 'super_user', 'employee')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );
