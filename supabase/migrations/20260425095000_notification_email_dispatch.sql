-- Server-side notification email dispatch:
-- - Enables pg_net + pg_cron (hosted Supabase supports these).
-- - Schedules an hourly/minutely job that invokes an Edge Function which processes pending notifications.
-- - Updates the activity like/comment trigger to also create a row in public.notifications (unified bell + email pipeline).

-- Extensions (Supabase hosted supports these)
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA extensions;

-- Recreate notify_activity_creator() to ALSO create a notification-center entry.
-- NOTE: We cannot edit old migrations; this replaces the function in-place.
CREATE OR REPLACE FUNCTION public.notify_activity_creator()
RETURNS TRIGGER AS $$
DECLARE
  activity_creator_id UUID;
  activity_company_id UUID;
  activity_title TEXT;
  activity_metadata JSONB;
  actor_user_id UUID;
  notification_type TEXT;
  matter_title TEXT;
  matter_content TEXT;
  new_matter_id UUID;
  actor_display_name TEXT;
BEGIN
  -- Determine the actor (person who liked/commented) and notification type
  IF TG_TABLE_NAME = 'activity_likes' THEN
    actor_user_id := NEW.user_id;
    notification_type := 'like';
  ELSIF TG_TABLE_NAME = 'activity_comments' THEN
    actor_user_id := NEW.created_by_user_id;
    notification_type := 'comment';
  ELSE
    RETURN NEW;
  END IF;

  -- Get activity details
  SELECT
    created_by_user_id,
    company_id,
    title,
    metadata
  INTO
    activity_creator_id,
    activity_company_id,
    activity_title,
    activity_metadata
  FROM activity_log
  WHERE id = NEW.activity_id
    AND deleted = false;

  -- If activity not found or creator is the same as actor, don't create notification
  IF activity_creator_id IS NULL OR activity_creator_id = actor_user_id THEN
    RETURN NEW;
  END IF;

  -- Get actor's display name for the notification
  SELECT display_name INTO actor_display_name
  FROM profiles
  WHERE user_id = actor_user_id;

  -- Build notification title and content
  IF notification_type = 'like' THEN
    matter_title := COALESCE(actor_display_name, 'Someone') || ' liked your update';
    matter_content := 'Your latest update "' || COALESCE(activity_title, 'Untitled') || '" received a like.';
  ELSE
    matter_title := COALESCE(actor_display_name, 'Someone') || ' commented on your update';
    matter_content := 'Your latest update "' || COALESCE(activity_title, 'Untitled') || '" received a comment.';
  END IF;

  -- Create the matter
  INSERT INTO matters (
    company_id,
    created_by_user_id,
    matter_type,
    title,
    content,
    metadata
  ) VALUES (
    activity_company_id,
    actor_user_id,
    'update',
    matter_title,
    matter_content,
    jsonb_build_object(
      'activity_id', NEW.activity_id,
      'notification_type', notification_type,
      'activity_title', activity_title
    )
  )
  RETURNING id INTO new_matter_id;

  -- Create matter recipient for the activity creator
  INSERT INTO matter_recipients (
    matter_id,
    user_id,
    status
  ) VALUES (
    new_matter_id,
    activity_creator_id,
    'pending'
  );

  -- ALSO create a Notification Center entry (unifies bell + email pipeline)
  INSERT INTO public.notifications (
    company_id,
    user_id,
    type,
    title,
    body_text,
    action_url,
    entity_type,
    entity_id
  ) VALUES (
    activity_company_id,
    activity_creator_id,
    'other',
    matter_title,
    matter_content,
    '/matters?matterId=' || new_matter_id::text,
    'matter',
    new_matter_id::text
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- (Re)create triggers to ensure they point at the latest function definition
DROP TRIGGER IF EXISTS trigger_notify_on_activity_like ON public.activity_likes;
CREATE TRIGGER trigger_notify_on_activity_like
  AFTER INSERT ON public.activity_likes
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_activity_creator();

DROP TRIGGER IF EXISTS trigger_notify_on_activity_comment ON public.activity_comments;
CREATE TRIGGER trigger_notify_on_activity_comment
  AFTER INSERT ON public.activity_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_activity_creator();

-- Schedule dispatch-notification-emails every minute.
-- Requires vault secrets:
--   - name='project_url' value='https://<project-ref>.supabase.co'
--   - name='anon_key' value='<your anon key>'
-- See: https://supabase.com/docs/guides/functions/schedule-functions
DO $$
DECLARE
  existing_job_id integer;
BEGIN
  -- Remove any existing job with this name (idempotent)
  SELECT jobid INTO existing_job_id
  FROM cron.job
  WHERE jobname = 'dispatch-notification-emails-every-minute'
  LIMIT 1;

  IF existing_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job_id);
  END IF;
END $$;

SELECT
  cron.schedule(
    'dispatch-notification-emails-every-minute',
    '* * * * *',
    $$
    select
      net.http_post(
        url:= (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
          || '/functions/v1/dispatch-notification-emails',
        headers:=jsonb_build_object(
          'Content-type', 'application/json',
          'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'anon_key')
        ),
        body: '{}'::jsonb
      ) as request_id;
    $$
  );

