-- Send "Welcome to Grid" email when a pending_invites row is created.
-- Uses pg_net to call the `send-welcome-email` Edge Function asynchronously.

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.dispatch_welcome_email_for_pending_invite()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  BEGIN
    -- Requires vault secrets:
    --   - name='project_url' value='https://<project-ref>.supabase.co'
    --   - name='anon_key' value='<your anon key>'
    PERFORM
      net.http_post(
        url:= (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
          || '/functions/v1/send-welcome-email',
        headers:=jsonb_build_object(
          'Content-type', 'application/json',
          'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'anon_key')
        ),
        body:= jsonb_build_object('pending_invite_id', NEW.id)
      );
  EXCEPTION WHEN OTHERS THEN
    -- Never block invite creation if email dispatch fails.
    NULL;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pending_invites_send_welcome_email ON public.pending_invites;
CREATE TRIGGER trg_pending_invites_send_welcome_email
  AFTER INSERT ON public.pending_invites
  FOR EACH ROW
  EXECUTE FUNCTION public.dispatch_welcome_email_for_pending_invite();

