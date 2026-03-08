-- Add Conta invoice amount fields to customers
-- Total amount invoiced and total unpaid (synced from Conta)

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS conta_total_invoiced numeric(15, 2),
  ADD COLUMN IF NOT EXISTS conta_total_unpaid numeric(15, 2);

COMMENT ON COLUMN customers.conta_total_invoiced IS 'Total amount invoiced to this customer (from Conta).';
COMMENT ON COLUMN customers.conta_total_unpaid IS 'Total amount not yet paid (from Conta).';
