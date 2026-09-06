-- Allow Conta-paid invoices to be stored as status = 'paid' on job_invoices.
ALTER TABLE public.job_invoices
  DROP CONSTRAINT IF EXISTS job_invoices_status_check;

ALTER TABLE public.job_invoices
  ADD CONSTRAINT job_invoices_status_check
  CHECK (status = ANY (ARRAY['pending'::text, 'created'::text, 'failed'::text, 'paid'::text]));
