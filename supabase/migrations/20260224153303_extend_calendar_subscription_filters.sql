-- Extend calendar_subscriptions: project lead jobs filter and vehicle filter
-- Default categories to only 'program' (jobs). Add include_project_lead_jobs
-- and vehicle_ids for transport.

ALTER TABLE public.calendar_subscriptions
  ALTER COLUMN categories SET DEFAULT ARRAY['program']::text[];

ALTER TABLE public.calendar_subscriptions
  ADD COLUMN IF NOT EXISTS include_project_lead_jobs boolean NOT NULL DEFAULT false;

ALTER TABLE public.calendar_subscriptions
  ADD COLUMN IF NOT EXISTS vehicle_ids uuid[] DEFAULT NULL;

COMMENT ON COLUMN public.calendar_subscriptions.include_project_lead_jobs
  IS 'When true and program is included: only include time_periods for jobs where this user is project lead.';
COMMENT ON COLUMN public.calendar_subscriptions.vehicle_ids
  IS 'When transport is included: only include time_periods for these vehicle IDs. NULL or empty = all vehicles.';
