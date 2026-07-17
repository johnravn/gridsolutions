-- Add active period for recurring job series
ALTER TABLE recurring_jobs
  ADD COLUMN IF NOT EXISTS period_start date,
  ADD COLUMN IF NOT EXISTS period_end date;

UPDATE recurring_jobs
SET period_start = (created_at AT TIME ZONE 'UTC')::date
WHERE period_start IS NULL;

ALTER TABLE recurring_jobs
  DROP CONSTRAINT IF EXISTS recurring_jobs_period_range_check;

ALTER TABLE recurring_jobs
  ADD CONSTRAINT recurring_jobs_period_range_check
  CHECK (
    period_end IS NULL
    OR period_start IS NULL
    OR period_end >= period_start
  );
