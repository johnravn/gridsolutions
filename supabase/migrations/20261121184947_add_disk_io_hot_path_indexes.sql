-- Hot-path indexes for Prod Disk IO / API Gateway pressure.
-- Additive only: Conta invoice sync/link, Accounting unverified queue, Reporting money.

-- Conta paid sync + link-by-number: filter by organization_id (+ conta_invoice_id).
CREATE INDEX IF NOT EXISTS idx_job_invoices_organization_id
  ON public.job_invoices (organization_id);

CREATE INDEX IF NOT EXISTS idx_job_invoices_org_conta_invoice_id
  ON public.job_invoices (organization_id, conta_invoice_id)
  WHERE conta_invoice_id IS NOT NULL;

-- Conta invoice-paid sync scans unpaid Conta-linked rows per organization.
CREATE INDEX IF NOT EXISTS idx_job_invoices_org_unpaid_conta
  ON public.job_invoices (organization_id)
  WHERE conta_invoice_id IS NOT NULL
    AND status IS DISTINCT FROM 'paid'
    AND status IS DISTINCT FROM 'failed';

-- Accounting unverified queue (project lead): money_verified_at IS NULL.
-- Existing jobs_money_verified_at_idx is WHERE money_verified_at IS NOT NULL (wrong polarity).
CREATE INDEX IF NOT EXISTS jobs_accounting_unverified_idx
  ON public.jobs (company_id, project_lead_user_id, status, start_at DESC)
  WHERE money_verified_at IS NULL
    AND archived = false;

-- Reporting monthly trend: company_id + dated ledger rows.
CREATE INDEX IF NOT EXISTS idx_job_money_items_company_date
  ON public.job_money_items (company_id, date)
  WHERE date IS NOT NULL;

-- FK / lead filters (ready-to-invoice, unverified, reporting joins).
CREATE INDEX IF NOT EXISTS jobs_project_lead_user_id_idx
  ON public.jobs (project_lead_user_id);
