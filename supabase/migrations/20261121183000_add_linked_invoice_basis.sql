-- Allow job_invoices rows that link an existing Conta invoice (not created from offer/bookings).

ALTER TABLE job_invoices
  DROP CONSTRAINT IF EXISTS job_invoices_invoice_basis_check;

ALTER TABLE job_invoices
  ADD CONSTRAINT job_invoices_invoice_basis_check
  CHECK (invoice_basis IN ('offer', 'bookings', 'linked'));

COMMENT ON COLUMN job_invoices.invoice_basis IS
  'How the Conta invoice was associated: offer, bookings, or linked (existing Conta invoice number).';
