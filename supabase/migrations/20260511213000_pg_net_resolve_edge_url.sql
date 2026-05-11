-- pg_net runs inside Postgres (Docker). Vault secrets often use http://127.0.0.1:54321 which is
-- wrong from inside the DB container (localhost is the container itself). Rewrite to
-- host.docker.internal so Kong/Edge Functions are reachable from Mac/Windows Docker Desktop.
-- Also schedule cron + welcome-email triggers to use the same resolver.
--
-- Linux without extra_hosts: set vault project_url to your host gateway manually.

CREATE OR REPLACE FUNCTION public.resolve_pg_net_edge_base_url()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  raw text;
  out_url text;
BEGIN
  SELECT decrypted_secret
  INTO raw
  FROM vault.decrypted_secrets
  WHERE name = 'project_url'
  LIMIT 1;

  IF raw IS NOT NULL AND length(trim(raw)) > 0 THEN
    out_url := rtrim(trim(raw), '/');
    IF out_url ~* '^https?://(127\.0\.0\.1|localhost)(:[0-9]+)?(/|$)' THEN
      out_url := regexp_replace(
        out_url,
        '^https?://(127\.0\.0\.1|localhost)',
        'http://host.docker.internal',
        'i'
      );
    END IF;
    RETURN out_url;
  END IF;

  -- Local CLI default when vault is empty (db reset); production should set project_url in vault.
  RETURN 'http://host.docker.internal:54321';
END;
$$;

COMMENT ON FUNCTION public.resolve_pg_net_edge_base_url() IS
  'Kong/Functions base URL for net.http_post from Postgres. Rewrites 127.0.0.1/localhost to host.docker.internal.';

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
  api_key text;
BEGIN
  IF NEW.email_sent_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  base_url := public.resolve_pg_net_edge_base_url();
  IF length(base_url) = 0 THEN
    RETURN NEW;
  END IF;

  SELECT decrypted_secret
  INTO api_key
  FROM vault.decrypted_secrets
  WHERE name = 'anon_key'
  LIMIT 1;

  IF api_key IS NULL OR length(trim(api_key)) = 0 THEN
    RAISE WARNING
      'dispatch_notification_email_after_insert: vault secret anon_key missing; skipping email for notification %',
      NEW.id;
    RETURN NEW;
  END IF;

  api_key := trim(api_key);

  BEGIN
    PERFORM net.http_post(
      url := base_url || '/functions/v1/send-notification-email',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || api_key
      ),
      body := jsonb_build_object(
        'notification_id', NEW.id::text,
        'force_email', false
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
  api_key text;
BEGIN
  BEGIN
    base_url := public.resolve_pg_net_edge_base_url();
    SELECT decrypted_secret
    INTO api_key
    FROM vault.decrypted_secrets
    WHERE name = 'anon_key'
    LIMIT 1;

    IF api_key IS NULL OR length(trim(api_key)) = 0 THEN
      RAISE WARNING 'dispatch_welcome_email_for_pending_invite: vault anon_key missing';
      RETURN NEW;
    END IF;

    PERFORM net.http_post(
      url := base_url || '/functions/v1/send-welcome-email',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || trim(api_key)
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
END $$;

SELECT cron.schedule(
  'dispatch-notification-emails-every-minute',
  '* * * * *',
  $cron$
  SELECT net.http_post(
    url := public.resolve_pg_net_edge_base_url() || '/functions/v1/dispatch-notification-emails',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        SELECT trim(decrypted_secret)
        FROM vault.decrypted_secrets
        WHERE name = 'anon_key'
        LIMIT 1
      )
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $cron$
);
