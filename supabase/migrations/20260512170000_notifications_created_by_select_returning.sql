-- PostgREST inserts use RETURNING (e.g. .select('id')). PostgreSQL evaluates SELECT policies
-- on rows returned from INSERT. The previous SELECT policy only allowed the recipient
-- (user_id = auth.uid()), so inviters creating crew_invite notifications could INSERT but
-- failed RETURNING — surfaced as 403 / RLS violation.
--
-- Server-side inserts (SECURITY DEFINER triggers, service_role) bypass RLS and may omit
-- created_by_user_id. Client inserts must set created_by_user_id = auth.uid().

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS created_by_user_id uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL;

COMMENT ON COLUMN public.notifications.created_by_user_id IS
  'User who created this notification row (inviter/sender). Lets creators read RETURNING rows; recipients still match user_id.';

CREATE INDEX IF NOT EXISTS idx_notifications_created_by_user_id ON public.notifications(created_by_user_id);

DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;

CREATE POLICY "Users can view their own notifications"
  ON public.notifications
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR created_by_user_id = auth.uid()
    OR public.is_superuser(auth.uid())
  );

DROP POLICY IF EXISTS "Company members can create notifications for company users" ON public.notifications;

CREATE POLICY "Company members can create notifications for company users"
  ON public.notifications
  FOR INSERT
  WITH CHECK (
    public.notification_insert_allowed_for_actor(company_id, user_id, auth.uid())
    AND created_by_user_id = auth.uid()
  );
