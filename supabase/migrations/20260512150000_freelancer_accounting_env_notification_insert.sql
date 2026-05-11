-- 1) Freelancers hit get_accounting_api_environment from dev UI (AppShell badge) / clients.
--    The RPC must return production vs sandbox for any company member — not raise — since it
--    does not expose secrets (keys stay behind get_conta_api_key).
-- 2) Notifications INSERT: evaluate sender membership + recipient eligibility in one
--    SECURITY DEFINER helper so WITH CHECK does not depend on nested RLS visibility.

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
      FROM public.reserved_crew rc
      INNER JOIN public.time_periods tp ON tp.id = rc.time_period_id
      INNER JOIN public.jobs j ON j.id = tp.job_id
      WHERE rc.user_id IS NOT NULL
        AND rc.user_id = p_recipient_user_id
        AND j.company_id = p_company_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.matter_recipients mr
      INNER JOIN public.matters m ON m.id = mr.matter_id
      WHERE mr.user_id = p_recipient_user_id
        AND m.company_id = p_company_id
    );
$$;

COMMENT ON FUNCTION public.notification_recipient_allowed_for_company(uuid, uuid) IS
  'Used by notifications INSERT RLS; sees underlying rows without inviter SELECT privileges.';

CREATE OR REPLACE FUNCTION public.notification_insert_allowed_for_actor(
  p_company_id uuid,
  p_recipient_user_id uuid,
  p_actor uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT
    (
      public.is_superuser(p_actor)
      OR EXISTS (
        SELECT 1
        FROM public.company_users cu
        WHERE cu.user_id = p_actor
          AND cu.company_id = p_company_id
      )
    )
    AND public.notification_recipient_allowed_for_company(p_company_id, p_recipient_user_id);
$$;

ALTER FUNCTION public.notification_insert_allowed_for_actor(uuid, uuid, uuid) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.notification_insert_allowed_for_actor(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notification_insert_allowed_for_actor(uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.notification_insert_allowed_for_actor(uuid, uuid, uuid) TO service_role;

COMMENT ON FUNCTION public.notification_insert_allowed_for_actor(uuid, uuid, uuid) IS
  'Single CHECK for notifications INSERT: sender may notify this company + recipient is eligible.';

DROP POLICY IF EXISTS "Company members can create notifications for company users" ON public.notifications;

CREATE POLICY "Company members can create notifications for company users"
  ON public.notifications
  FOR INSERT
  WITH CHECK (
    public.notification_insert_allowed_for_actor(
      company_id,
      user_id,
      auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.get_accounting_api_environment()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_company_id UUID;
  v_role TEXT;
  v_is_superuser BOOLEAN;
  v_environment TEXT;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT selected_company_id INTO v_company_id
  FROM profiles
  WHERE user_id = v_user_id;

  IF v_company_id IS NOT NULL THEN
    SELECT role INTO v_role
    FROM company_users
    WHERE user_id = v_user_id
      AND company_id = v_company_id;

    IF v_role IS NULL THEN
      v_company_id := NULL;
      v_role := NULL;
    END IF;
  END IF;

  IF v_company_id IS NULL THEN
    SELECT company_id, role INTO v_company_id, v_role
    FROM company_users
    WHERE user_id = v_user_id
      AND role IN ('owner', 'employee', 'super_user', 'freelancer')
    ORDER BY
      CASE role
        WHEN 'owner' THEN 1
        WHEN 'super_user' THEN 2
        WHEN 'employee' THEN 3
        WHEN 'freelancer' THEN 4
      END
    LIMIT 1;
  END IF;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'User is not a member of any company with access permissions';
  END IF;

  IF v_role IS NULL THEN
    SELECT role INTO v_role
    FROM company_users
    WHERE user_id = v_user_id
      AND company_id = v_company_id;
  END IF;

  SELECT COALESCE(superuser, false) INTO v_is_superuser
  FROM profiles
  WHERE user_id = v_user_id;

  IF v_is_superuser THEN
    NULL;
  ELSIF v_role IS NULL THEN
    RAISE EXCEPTION 'User is not a member of this company or does not have permission to access accounting settings';
  ELSIF v_role NOT IN ('owner', 'employee', 'super_user', 'freelancer') THEN
    RAISE EXCEPTION 'User role "%" does not have permission to access accounting settings. Required roles: owner, employee, super_user, or freelancer', v_role;
  END IF;

  SELECT COALESCE(accounting_api_environment, 'production') INTO v_environment
  FROM company_expansions
  WHERE company_id = v_company_id;

  RETURN COALESCE(v_environment, 'production');
END;
$$;

COMMENT ON FUNCTION public.get_accounting_api_environment() IS
  'Returns the selected accounting API environment (production or sandbox) for the current user''s company. Any company member may call; API keys remain restricted to get_conta_api_key.';
