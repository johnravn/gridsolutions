-- When a notification row is inserted with email_sent_at null, queue immediate delivery
-- via send-notification-email (same vault/pg_net pattern as welcome email and cron dispatch).
-- Ensures DB-triggered matters (crew answer, offer accept/reject, revision, activity) send email
-- without waiting only on pg_cron.

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.dispatch_notification_email_after_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  base_url text;
  api_key text;
BEGIN
  IF NEW.email_sent_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT decrypted_secret INTO base_url
  FROM vault.decrypted_secrets
  WHERE name = 'project_url'
  LIMIT 1;

  SELECT decrypted_secret INTO api_key
  FROM vault.decrypted_secrets
  WHERE name = 'anon_key'
  LIMIT 1;

  IF base_url IS NULL OR api_key IS NULL THEN
    RETURN NEW;
  END IF;

  base_url := rtrim(trim(base_url), '/');
  IF length(base_url) = 0 OR length(trim(api_key)) = 0 THEN
    RETURN NEW;
  END IF;

  BEGIN
    PERFORM net.http_post(
      url := base_url || '/functions/v1/send-notification-email',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || trim(api_key)
      ),
      body := jsonb_build_object(
        'notification_id', NEW.id::text,
        'force_email', false
      )
    );
  EXCEPTION WHEN OTHERS THEN
    -- Never block notification creation if dispatch fails (cron can retry).
    NULL;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notifications_dispatch_email_after_insert ON public.notifications;
CREATE TRIGGER trg_notifications_dispatch_email_after_insert
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  WHEN (NEW.email_sent_at IS NULL)
  EXECUTE FUNCTION public.dispatch_notification_email_after_insert();
