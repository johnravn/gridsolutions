-- Supabase load optimizations:
-- 1) Mark stuck test/seed notification emails as processed (stop cron retry loop)
-- 2) Notification email cron: every 5 minutes, skip when queue is empty
-- 3) Partial index for pending notification email scans

-- ---------------------------------------------------------------------------
-- 1) Clear backlog for non-deliverable test/seed profile emails
-- ---------------------------------------------------------------------------
UPDATE public.notifications n
SET email_sent_at = COALESCE(n.email_sent_at, now())
FROM public.profiles p
WHERE n.user_id = p.user_id
  AND n.email_sent_at IS NULL
  AND (
    lower(p.email) LIKE '%@test.grid.local'
    OR lower(p.email) LIKE '%@example.com'
    OR lower(p.email) LIKE '%@grid.local'
    OR lower(p.email) LIKE '%@demo.internal'
  );

-- ---------------------------------------------------------------------------
-- 2) Cron wrapper: only invoke dispatch when pending notifications exist
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.dispatch_notification_emails_cron()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  base_url text;
  api_key text;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.notifications
    WHERE email_sent_at IS NULL
    LIMIT 1
  ) THEN
    RETURN;
  END IF;

  base_url := public.resolve_pg_net_edge_base_url();
  IF base_url IS NULL OR length(trim(base_url)) = 0 THEN
    RETURN;
  END IF;

  SELECT decrypted_secret
  INTO api_key
  FROM vault.decrypted_secrets
  WHERE name = 'anon_key'
  LIMIT 1;

  IF api_key IS NULL OR length(trim(api_key)) = 0 THEN
    RAISE WARNING 'dispatch_notification_emails_cron: vault secret anon_key missing';
    RETURN;
  END IF;

  BEGIN
    PERFORM net.http_post(
      url := rtrim(trim(base_url), '/') || '/functions/v1/dispatch-notification-emails',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || trim(api_key)
      ),
      body := '{}'::jsonb
    );
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'dispatch_notification_emails_cron: %', SQLERRM;
  END;
END;
$$;

COMMENT ON FUNCTION public.dispatch_notification_emails_cron() IS
  'pg_cron entrypoint: calls dispatch-notification-emails only when pending notification emails exist.';

DO $$
DECLARE
  existing_job_id integer;
BEGIN
  SELECT jobid
  INTO existing_job_id
  FROM cron.job
  WHERE jobname = 'dispatch-notification-emails-every-minute'
  LIMIT 1;

  IF existing_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job_id);
  END IF;

  SELECT jobid
  INTO existing_job_id
  FROM cron.job
  WHERE jobname = 'dispatch-notification-emails-every-five-minutes'
  LIMIT 1;

  IF existing_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job_id);
  END IF;
END $$;

SELECT cron.schedule(
  'dispatch-notification-emails-every-five-minutes',
  '*/5 * * * *',
  $$SELECT public.dispatch_notification_emails_cron();$$
);

-- ---------------------------------------------------------------------------
-- 3) Partial index for pending notification email dispatch
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_notifications_pending_email
  ON public.notifications (created_at)
  WHERE email_sent_at IS NULL;
