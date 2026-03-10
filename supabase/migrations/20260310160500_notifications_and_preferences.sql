-- Notification center: store in-app notifications and per-user email preferences.
-- Email delivery is handled by an Edge Function (separate step).

-- Notification type enum for known event kinds
CREATE TYPE public.notification_type AS ENUM (
  'offer_sent',
  'offer_accepted',
  'offer_rejected',
  'offer_revision_requested',
  'crew_invite',
  'matter_reply',
  'matter_mention',
  'reminder',
  'announcement',
  'other'
);

-- Notifications table: one row per notification for a user
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  type public.notification_type NOT NULL DEFAULT 'other',
  title text NOT NULL,
  body_text text,
  action_url text,
  entity_type text,
  entity_id text,
  read_at timestamptz,
  email_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_company_id ON public.notifications(company_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_read_at ON public.notifications(read_at) WHERE read_at IS NULL;

COMMENT ON TABLE public.notifications IS 'In-app notifications for users; email delivery tracked via email_sent_at';

-- Notification preferences: one row per user per company (email toggles)
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  email_offer_updates boolean NOT NULL DEFAULT true,
  email_crew_invites boolean NOT NULL DEFAULT true,
  email_matter_replies boolean NOT NULL DEFAULT true,
  email_reminders boolean NOT NULL DEFAULT true,
  email_announcements boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, company_id)
);

CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_company ON public.notification_preferences(user_id, company_id);

COMMENT ON TABLE public.notification_preferences IS 'Per-user, per-company email notification preferences';

-- RLS: notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
CREATE POLICY "Users can view their own notifications"
  ON public.notifications
  FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own notifications (e.g. mark read)" ON public.notifications;
CREATE POLICY "Users can update their own notifications (e.g. mark read)"
  ON public.notifications
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Insert: allow company members to create notifications for users in the same company (e.g. from triggers or app)
DROP POLICY IF EXISTS "Company members can create notifications for company users" ON public.notifications;
CREATE POLICY "Company members can create notifications for company users"
  ON public.notifications
  FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.company_users WHERE user_id = auth.uid()
    )
    AND user_id IN (
      SELECT user_id FROM public.company_users WHERE company_id = notifications.company_id
    )
  );

-- RLS: notification_preferences
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own notification preferences" ON public.notification_preferences;
CREATE POLICY "Users can view their own notification preferences"
  ON public.notification_preferences
  FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert their own notification preferences" ON public.notification_preferences;
CREATE POLICY "Users can insert their own notification preferences"
  ON public.notification_preferences
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own notification preferences" ON public.notification_preferences;
CREATE POLICY "Users can update their own notification preferences"
  ON public.notification_preferences
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Trigger: updated_at for notification_preferences
CREATE OR REPLACE FUNCTION public.update_notification_preferences_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notification_preferences_updated_at ON public.notification_preferences;
CREATE TRIGGER trg_notification_preferences_updated_at
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_notification_preferences_updated_at();
