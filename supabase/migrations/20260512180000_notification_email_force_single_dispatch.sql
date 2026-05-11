-- Client + DB trigger both invoked send-notification-email → duplicate emails.
-- Store intent on the row; trigger + cron pass it; client no longer invokes the edge function.

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS email_force_send boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.notifications.email_force_send IS
  'When true, send-notification-email bypasses per-type prefs (e.g. crew_invite must email). Dispatched via pg_net trigger / cron only.';

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
        'force_email', COALESCE(NEW.email_force_send, false)
      )
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN NEW;
END;
$$;
