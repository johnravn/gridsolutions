-- Matters-centric inbox: per-channel email prefs, activity notification type, matters INSERT RLS by role, Realtime for matters + matter_recipients.

-- ---------------------------------------------------------------------------
-- notification_type: value for activity-driven matter emails (prefs: updates)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'notification_type'
      AND e.enumlabel = 'matter_update'
  ) THEN
    ALTER TYPE public.notification_type ADD VALUE 'matter_update';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- notification_preferences: three explicit matter email toggles
-- ---------------------------------------------------------------------------
ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS email_matter_announcements boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS email_matter_updates boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS email_matter_invites boolean NOT NULL DEFAULT true;

UPDATE public.notification_preferences
SET
  email_matter_announcements = COALESCE(email_announcements, true),
  email_matter_updates = COALESCE(email_matter_replies, true),
  email_matter_invites = COALESCE(email_crew_invites, true)
WHERE true;

COMMENT ON COLUMN public.notification_preferences.email_matter_announcements IS 'Email for announcement matters';
COMMENT ON COLUMN public.notification_preferences.email_matter_updates IS 'Email for update matters and activity-driven matter notifications';
COMMENT ON COLUMN public.notification_preferences.email_matter_invites IS 'Email for crew invite matters';

-- ---------------------------------------------------------------------------
-- Activity like/comment: use matter_update for notification row (email prefs)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_activity_creator()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
  IF TG_TABLE_NAME = 'activity_likes' THEN
    actor_user_id := NEW.user_id;
    notification_type := 'like';
  ELSIF TG_TABLE_NAME = 'activity_comments' THEN
    actor_user_id := NEW.created_by_user_id;
    notification_type := 'comment';
  ELSE
    RETURN NEW;
  END IF;

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

  IF activity_creator_id IS NULL OR activity_creator_id = actor_user_id THEN
    RETURN NEW;
  END IF;

  SELECT display_name INTO actor_display_name
  FROM profiles
  WHERE user_id = actor_user_id;

  IF notification_type = 'like' THEN
    matter_title := COALESCE(actor_display_name, 'Someone') || ' liked your update';
    matter_content := 'Your latest update "' || COALESCE(activity_title, 'Untitled') || '" received a like.';
  ELSE
    matter_title := COALESCE(actor_display_name, 'Someone') || ' commented on your update';
    matter_content := 'Your latest update "' || COALESCE(activity_title, 'Untitled') || '" received a comment.';
  END IF;

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

  INSERT INTO matter_recipients (
    matter_id,
    user_id,
    status
  ) VALUES (
    new_matter_id,
    activity_creator_id,
    'pending'
  );

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
    'matter_update'::public.notification_type,
    matter_title,
    matter_content,
    '/matters?matterId=' || new_matter_id::text,
    'matter',
    new_matter_id::text
  );

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- matters INSERT: freelancers may only create crew_invite; others may create
-- announcement, update, crew_invite (vote/chat unused by app)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can create matters for their company" ON public.matters;
CREATE POLICY "Users can create matters for their company"
  ON public.matters
  FOR INSERT
  WITH CHECK (
    created_by_user_id = auth.uid()
    AND (
      public.is_superuser(auth.uid())
      OR (
        EXISTS (
          SELECT 1
          FROM public.company_users cu
          WHERE cu.user_id = auth.uid()
            AND cu.company_id = matters.company_id
            AND cu.role IN ('owner', 'employee', 'super_user')
        )
        AND matters.matter_type IN ('announcement', 'update', 'crew_invite', 'vote', 'chat')
      )
      OR (
        EXISTS (
          SELECT 1
          FROM public.company_users cu
          WHERE cu.user_id = auth.uid()
            AND cu.company_id = matters.company_id
            AND cu.role = 'freelancer'
        )
        AND matters.matter_type = 'crew_invite'
      )
    )
  );

-- ---------------------------------------------------------------------------
-- Realtime: matters + matter_recipients (replica identity for filtered subs)
-- ---------------------------------------------------------------------------
ALTER TABLE public.matters REPLICA IDENTITY FULL;
ALTER TABLE public.matter_recipients REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'matters'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.matters;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'matter_recipients'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.matter_recipients;
  END IF;
END $$;
