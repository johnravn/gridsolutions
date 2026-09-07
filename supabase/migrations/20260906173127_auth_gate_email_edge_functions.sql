-- Email Edge Functions now require a user JWT or CRON_SECRET (in-function).
-- pg_net / pg_cron must send Authorization: Bearer <vault cron_secret>
-- instead of the public anon key.
--
-- Hosted: upsert vault secret name='cron_secret' to the same value as the
-- Edge Function secret CRON_SECRET (and Vercel CRON_SECRET).
-- Local: `npm run db:seed-email-vault-local` writes cron_secret.

-- ---------------------------------------------------------------------------
-- notifications INSERT → send-notification-email
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.dispatch_notification_email_after_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  base_url text;
  cron_secret text;
BEGIN
  IF NEW.email_sent_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  base_url := public.resolve_pg_net_edge_base_url();
  IF base_url IS NULL OR length(trim(base_url)) = 0 THEN
    RETURN NEW;
  END IF;

  SELECT decrypted_secret
  INTO cron_secret
  FROM vault.decrypted_secrets
  WHERE name = 'cron_secret'
  LIMIT 1;

  IF cron_secret IS NULL OR length(trim(cron_secret)) = 0 THEN
    RAISE WARNING
      'dispatch_notification_email_after_insert: vault secret cron_secret missing; skipping email for notification %',
      NEW.id;
    RETURN NEW;
  END IF;

  BEGIN
    PERFORM net.http_post(
      url := rtrim(trim(base_url), '/') || '/functions/v1/send-notification-email',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || trim(cron_secret)
      ),
      body := jsonb_build_object(
        'notification_id', NEW.id::text,
        'force_email', COALESCE(NEW.email_force_send, false)
      )
    );
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING
        'dispatch_notification_email_after_insert failed for notification %: %',
        NEW.id,
        SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- pending_invites → send-welcome-email
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.dispatch_welcome_email_for_pending_invite()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  base_url text;
  cron_secret text;
BEGIN
  BEGIN
    base_url := public.resolve_pg_net_edge_base_url();
    SELECT decrypted_secret
    INTO cron_secret
    FROM vault.decrypted_secrets
    WHERE name = 'cron_secret'
    LIMIT 1;

    IF cron_secret IS NULL OR length(trim(cron_secret)) = 0 THEN
      RAISE WARNING 'dispatch_welcome_email_for_pending_invite: vault cron_secret missing';
      RETURN NEW;
    END IF;

    PERFORM net.http_post(
      url := rtrim(trim(base_url), '/') || '/functions/v1/send-welcome-email',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || trim(cron_secret)
      ),
      body := jsonb_build_object('pending_invite_id', NEW.id)
    );
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'dispatch_welcome_email_for_pending_invite: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Cron: dispatch-notification-emails batch
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.dispatch_notification_emails_cron()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  base_url text;
  cron_secret text;
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
  INTO cron_secret
  FROM vault.decrypted_secrets
  WHERE name = 'cron_secret'
  LIMIT 1;

  IF cron_secret IS NULL OR length(trim(cron_secret)) = 0 THEN
    RAISE WARNING 'dispatch_notification_emails_cron: vault secret cron_secret missing';
    RETURN;
  END IF;

  BEGIN
    PERFORM net.http_post(
      url := rtrim(trim(base_url), '/') || '/functions/v1/dispatch-notification-emails',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || trim(cron_secret)
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
  'pg_cron entrypoint: calls dispatch-notification-emails with vault cron_secret when pending notification emails exist.';
