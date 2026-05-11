-- The INSERT policy on notifications used EXISTS() over reserved_crew / time_periods /
-- matter_recipients. Those tables use RLS; joined rows can disappear during WITH CHECK
-- (e.g. inviter cannot SELECT a time_period row even though reserved_crew links exist).
-- Eligibility must match actual FK relationships, not "what the inviter can see".
-- Mirror the pattern used for can_freelancer_view_job: SECURITY DEFINER + row_security off.

CREATE OR REPLACE FUNCTION public.notification_recipient_allowed_for_company(
  p_company_id uuid,
  p_recipient_user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT
    EXISTS (
      SELECT 1
      FROM public.company_users cu
      WHERE cu.company_id = p_company_id
        AND cu.user_id = p_recipient_user_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.reserved_crew rc
      INNER JOIN public.time_periods tp ON tp.id = rc.time_period_id
      WHERE rc.user_id IS NOT NULL
        AND rc.user_id = p_recipient_user_id
        AND tp.company_id = p_company_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.matter_recipients mr
      INNER JOIN public.matters m ON m.id = mr.matter_id
      WHERE mr.user_id = p_recipient_user_id
        AND m.company_id = p_company_id
    );
$$;

ALTER FUNCTION public.notification_recipient_allowed_for_company(uuid, uuid) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.notification_recipient_allowed_for_company(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notification_recipient_allowed_for_company(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.notification_recipient_allowed_for_company(uuid, uuid) TO service_role;

COMMENT ON FUNCTION public.notification_recipient_allowed_for_company(uuid, uuid) IS
  'Used by notifications INSERT RLS; sees underlying rows without inviter SELECT privileges.';

DROP POLICY IF EXISTS "Company members can create notifications for company users" ON public.notifications;

CREATE POLICY "Company members can create notifications for company users"
  ON public.notifications
  FOR INSERT
  WITH CHECK (
    public.is_superuser(auth.uid())
    OR (
      company_id IN (
        SELECT cu.company_id
        FROM public.company_users cu
        WHERE cu.user_id = auth.uid()
      )
      AND public.notification_recipient_allowed_for_company(
        notifications.company_id,
        notifications.user_id
      )
    )
  );
