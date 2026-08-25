-- Junction table linking one Conta invoice to multiple jobs (multi-job invoicing)

CREATE TABLE IF NOT EXISTS job_invoice_jobs (
  invoice_id UUID NOT NULL REFERENCES job_invoices(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  PRIMARY KEY (invoice_id, job_id)
);

CREATE INDEX IF NOT EXISTS idx_job_invoice_jobs_job_id ON job_invoice_jobs(job_id);

ALTER TABLE job_invoice_jobs ENABLE ROW LEVEL SECURITY;

-- Users can view junction rows for invoices in their company
DROP POLICY IF EXISTS "Users can view job_invoice_jobs for their company" ON job_invoice_jobs;
CREATE POLICY "Users can view job_invoice_jobs for their company"
  ON job_invoice_jobs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM job_invoices ji
      JOIN jobs j ON j.id = ji.job_id
      JOIN company_users cu ON cu.company_id = j.company_id
      WHERE ji.id = job_invoice_jobs.invoice_id
        AND cu.user_id = auth.uid()
    )
  );

-- Users with appropriate permissions can create junction rows
DROP POLICY IF EXISTS "Users can create job_invoice_jobs for their company" ON job_invoice_jobs;
CREATE POLICY "Users can create job_invoice_jobs for their company"
  ON job_invoice_jobs
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM job_invoices ji
      JOIN jobs j ON j.id = ji.job_id
      JOIN company_users cu ON cu.company_id = j.company_id
      WHERE ji.id = job_invoice_jobs.invoice_id
        AND cu.user_id = auth.uid()
        AND cu.role IN ('owner', 'super_user', 'employee')
    )
    AND EXISTS (
      SELECT 1
      FROM jobs j2
      JOIN company_users cu2 ON cu2.company_id = j2.company_id
      WHERE j2.id = job_invoice_jobs.job_id
        AND cu2.user_id = auth.uid()
        AND cu2.role IN ('owner', 'super_user', 'employee')
    )
  );

-- Backfill: every existing invoice links to its primary job
INSERT INTO job_invoice_jobs (invoice_id, job_id)
SELECT id, job_id
FROM job_invoices
ON CONFLICT (invoice_id, job_id) DO NOTHING;

COMMENT ON TABLE job_invoice_jobs IS 'Links a Conta invoice (job_invoices row) to all member jobs included on that invoice';
