-- Subscribe to another company member's crew calendar (kind = crew_user).

ALTER TABLE public.calendar_subscriptions
  ADD COLUMN IF NOT EXISTS crew_user_id uuid REFERENCES public.profiles(user_id) ON DELETE CASCADE;

COMMENT ON COLUMN public.calendar_subscriptions.crew_user_id IS
  'For kind=crew_user: the crew member whose bookings to include. NULL for other kinds.';

ALTER TABLE public.calendar_subscriptions
  DROP CONSTRAINT IF EXISTS calendar_subscriptions_kind_check;

ALTER TABLE public.calendar_subscriptions
  ADD CONSTRAINT calendar_subscriptions_kind_check
  CHECK (kind IN (
    'all_jobs',
    'project_lead_jobs',
    'crew_jobs',
    'crew_user',
    'transport_vehicle',
    'transport_all'
  ));

ALTER TABLE public.calendar_subscriptions
  DROP CONSTRAINT IF EXISTS calendar_subscriptions_crew_user_id_kind_check;

ALTER TABLE public.calendar_subscriptions
  ADD CONSTRAINT calendar_subscriptions_crew_user_id_kind_check
  CHECK (
    (kind = 'crew_user' AND crew_user_id IS NOT NULL AND crew_user_id <> user_id)
    OR (kind <> 'crew_user' AND crew_user_id IS NULL)
  );

CREATE OR REPLACE FUNCTION public.can_subscribe_to_crew_user(
  p_company_id uuid,
  p_subscriber_id uuid,
  p_target_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub_role text;
  v_target_role text;
BEGIN
  IF p_subscriber_id IS NULL
     OR p_target_id IS NULL
     OR p_subscriber_id = p_target_id THEN
    RETURN false;
  END IF;

  SELECT cu.role INTO v_sub_role
  FROM public.company_users cu
  WHERE cu.company_id = p_company_id
    AND cu.user_id = p_subscriber_id;

  SELECT cu.role INTO v_target_role
  FROM public.company_users cu
  WHERE cu.company_id = p_company_id
    AND cu.user_id = p_target_id;

  IF v_sub_role IS NULL OR v_target_role IS NULL THEN
    RETURN false;
  END IF;

  IF v_sub_role = 'freelancer' THEN
    RETURN false;
  END IF;

  IF v_sub_role = 'employee' AND v_target_role = 'owner' THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$;

COMMENT ON FUNCTION public.can_subscribe_to_crew_user(uuid, uuid, uuid) IS
  'Whether subscriber may follow target crew calendar in the company.';

REVOKE ALL ON FUNCTION public.can_subscribe_to_crew_user(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_subscribe_to_crew_user(uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_subscribe_to_crew_user(uuid, uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.enforce_calendar_subscription_crew_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.kind = 'crew_user' THEN
    IF NOT public.can_subscribe_to_crew_user(
      NEW.company_id,
      NEW.user_id,
      NEW.crew_user_id
    ) THEN
      RAISE EXCEPTION 'Not allowed to subscribe to that crew calendar'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_calendar_subscriptions_crew_user
  ON public.calendar_subscriptions;
CREATE TRIGGER trg_calendar_subscriptions_crew_user
  BEFORE INSERT OR UPDATE OF kind, user_id, crew_user_id, company_id
  ON public.calendar_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_calendar_subscription_crew_user();
