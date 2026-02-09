-- Add job_id to time_entries so entries can be linked to a job

ALTER TABLE time_entries
  ADD COLUMN IF NOT EXISTS job_id UUID REFERENCES jobs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_time_entries_job_id ON time_entries(job_id);

COMMENT ON COLUMN time_entries.job_id IS 'Optional link to a job when logging time against a specific job';
