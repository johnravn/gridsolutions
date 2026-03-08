-- Add company default for invoice days until due (used when customer has no override in Conta)

ALTER TABLE company_expansions
  ADD COLUMN IF NOT EXISTS default_invoice_days_until_due integer;

COMMENT ON COLUMN company_expansions.default_invoice_days_until_due IS
  'Company default: days from invoice date to due date. Used when customer has no override in Conta.';
