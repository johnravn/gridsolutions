-- Optional 1-hour ICS reminder on project-lead job calendars.
-- Existing subscriptions stay off; users opt in from Subscribe to calendar.

ALTER TABLE public.calendar_subscriptions
  ADD COLUMN IF NOT EXISTS remind_1h_before boolean NOT NULL DEFAULT false;

ALTER TABLE public.calendar_subscriptions
  DROP CONSTRAINT IF EXISTS calendar_subscriptions_remind_1h_kind_check;

ALTER TABLE public.calendar_subscriptions
  ADD CONSTRAINT calendar_subscriptions_remind_1h_kind_check
  CHECK (remind_1h_before = false OR kind = 'project_lead_jobs');

COMMENT ON COLUMN public.calendar_subscriptions.remind_1h_before IS
  'When true and kind is project_lead_jobs, ICS events include a VALARM 1 hour before start.';
