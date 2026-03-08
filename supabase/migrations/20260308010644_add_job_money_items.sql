-- Add job_money_items table for project lead–controlled income and expense items.
-- Items are suggested from real events (offers, crew, conta) and explicitly added by the project lead.

CREATE TABLE IF NOT EXISTS job_money_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  description TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  date TIMESTAMPTZ,
  reference TEXT,
  source TEXT NOT NULL CHECK (source IN ('offer', 'crew', 'conta', 'manual')),
  source_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_money_items_job_id ON job_money_items(job_id);
CREATE INDEX IF NOT EXISTS idx_job_money_items_company_id ON job_money_items(company_id);
CREATE INDEX IF NOT EXISTS idx_job_money_items_source_id ON job_money_items(job_id, source, source_id);

-- RLS
ALTER TABLE job_money_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view money items for their company jobs" ON job_money_items;
CREATE POLICY "Users can view money items for their company jobs"
  ON job_money_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM jobs j
      JOIN company_users cu ON cu.company_id = j.company_id
      WHERE j.id = job_money_items.job_id
        AND cu.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can create money items for their company jobs" ON job_money_items;
CREATE POLICY "Users can create money items for their company jobs"
  ON job_money_items
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM jobs j
      JOIN company_users cu ON cu.company_id = j.company_id
      WHERE j.id = job_money_items.job_id
        AND cu.user_id = auth.uid()
        AND cu.role IN ('owner', 'super_user', 'employee')
    )
  );

DROP POLICY IF EXISTS "Users can update money items for their company jobs" ON job_money_items;
CREATE POLICY "Users can update money items for their company jobs"
  ON job_money_items
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM jobs j
      JOIN company_users cu ON cu.company_id = j.company_id
      WHERE j.id = job_money_items.job_id
        AND cu.user_id = auth.uid()
        AND cu.role IN ('owner', 'super_user', 'employee')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM jobs j
      JOIN company_users cu ON cu.company_id = j.company_id
      WHERE j.id = job_money_items.job_id
        AND cu.user_id = auth.uid()
        AND cu.role IN ('owner', 'super_user', 'employee')
    )
  );

DROP POLICY IF EXISTS "Users can delete money items for their company jobs" ON job_money_items;
CREATE POLICY "Users can delete money items for their company jobs"
  ON job_money_items
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM jobs j
      JOIN company_users cu ON cu.company_id = j.company_id
      WHERE j.id = job_money_items.job_id
        AND cu.user_id = auth.uid()
        AND cu.role IN ('owner', 'super_user', 'employee')
    )
  );

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_job_money_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS job_money_items_updated_at ON job_money_items;
CREATE TRIGGER job_money_items_updated_at
  BEFORE UPDATE ON job_money_items
  FOR EACH ROW
  EXECUTE FUNCTION update_job_money_items_updated_at();

COMMENT ON TABLE job_money_items IS 'Project lead–confirmed income and expense items for jobs. Suggested from offers, crew bookings, Conta; user adds manually.';
