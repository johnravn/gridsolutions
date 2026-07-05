-- Recurring jobs: lightweight grouping container for related jobs (e.g. theater season).

CREATE TABLE IF NOT EXISTS recurring_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  project_lead_user_id UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  customer_user_id UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
  archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recurring_jobs_company_id ON recurring_jobs(company_id);
CREATE INDEX IF NOT EXISTS idx_recurring_jobs_project_lead ON recurring_jobs(project_lead_user_id);
CREATE INDEX IF NOT EXISTS idx_recurring_jobs_archived ON recurring_jobs(company_id, archived);

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS recurring_job_id UUID REFERENCES recurring_jobs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_jobs_recurring_job_id ON jobs(recurring_job_id);

-- updated_at trigger
DROP TRIGGER IF EXISTS recurring_jobs_updated_at ON recurring_jobs;
CREATE TRIGGER recurring_jobs_updated_at
  BEFORE UPDATE ON recurring_jobs
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- RLS
ALTER TABLE recurring_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view recurring jobs for their companies" ON recurring_jobs;
CREATE POLICY "Users can view recurring jobs for their companies"
  ON recurring_jobs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM company_users
      WHERE company_users.company_id = recurring_jobs.company_id
        AND company_users.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

DROP POLICY IF EXISTS "Users can create recurring jobs for their companies" ON recurring_jobs;
CREATE POLICY "Users can create recurring jobs for their companies"
  ON recurring_jobs
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_users
      WHERE company_users.company_id = recurring_jobs.company_id
        AND company_users.user_id = auth.uid()
        AND company_users.role IN ('owner', 'super_user', 'employee')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

DROP POLICY IF EXISTS "Users can update recurring jobs for their companies" ON recurring_jobs;
CREATE POLICY "Users can update recurring jobs for their companies"
  ON recurring_jobs
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM company_users
      WHERE company_users.company_id = recurring_jobs.company_id
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
      WHERE company_users.company_id = recurring_jobs.company_id
        AND company_users.user_id = auth.uid()
        AND company_users.role IN ('owner', 'super_user', 'employee')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

DROP POLICY IF EXISTS "Users can delete recurring jobs for their companies" ON recurring_jobs;
CREATE POLICY "Users can delete recurring jobs for their companies"
  ON recurring_jobs
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM company_users
      WHERE company_users.company_id = recurring_jobs.company_id
        AND company_users.user_id = auth.uid()
        AND company_users.role IN ('owner', 'super_user', 'employee')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );
