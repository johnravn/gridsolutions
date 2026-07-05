-- Standard contact for recurring jobs (applied to new member jobs).

ALTER TABLE recurring_jobs
  ADD COLUMN IF NOT EXISTS customer_contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_recurring_jobs_customer_contact_id
  ON recurring_jobs(customer_contact_id);
