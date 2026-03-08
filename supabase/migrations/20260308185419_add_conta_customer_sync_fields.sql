-- Add Conta sync fields to customers table
-- These fields are read-only in Subb (synced from Conta). Only create new customers in Conta, never update.

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS conta_customer_id integer,
  ADD COLUMN IF NOT EXISTS conta_days_until_payment_reminder integer,
  ADD COLUMN IF NOT EXISTS conta_days_until_estimate_overdue integer,
  ADD COLUMN IF NOT EXISTS conta_invoice_delivery_method text,
  ADD COLUMN IF NOT EXISTS conta_invoice_count integer,
  ADD COLUMN IF NOT EXISTS conta_last_synced_at timestamptz;

COMMENT ON COLUMN customers.conta_customer_id IS 'Conta customer ID. Read-only in Subb.';
COMMENT ON COLUMN customers.conta_days_until_payment_reminder IS 'Days until payment reminder (from Conta). Edit in Conta only.';
COMMENT ON COLUMN customers.conta_days_until_estimate_overdue IS 'Days until estimate overdue (from Conta). Edit in Conta only.';
COMMENT ON COLUMN customers.conta_invoice_delivery_method IS 'Invoice delivery method (from Conta). Edit in Conta only.';
COMMENT ON COLUMN customers.conta_invoice_count IS 'Number of invoices sent to this customer (from Conta).';
COMMENT ON COLUMN customers.conta_last_synced_at IS 'Last time this customer was synced from Conta.';
