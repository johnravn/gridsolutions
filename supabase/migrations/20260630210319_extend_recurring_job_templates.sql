-- Extend recurring job templates with default start time and standard crew roles.

ALTER TABLE recurring_job_templates
  ADD COLUMN IF NOT EXISTS start_time TIME,
  ADD COLUMN IF NOT EXISTS crew_roles JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN recurring_job_templates.start_time IS
  'Default local start time of day for new jobs created from this template.';
COMMENT ON COLUMN recurring_job_templates.crew_roles IS
  'Array of { title, needed_count, role_category? } crew roles created with the job.';
