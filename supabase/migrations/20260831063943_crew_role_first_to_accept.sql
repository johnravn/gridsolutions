-- First-N-wins for crew roles: when confirmed crew reaches needed_count,
-- remaining pending invites are closed. Concurrent accepts are serialized
-- per role so extras cannot sneak through.

CREATE INDEX IF NOT EXISTS reserved_crew_time_period_status_idx
  ON public.reserved_crew (time_period_id, status);

CREATE INDEX IF NOT EXISTS matters_crew_invite_time_period_idx
  ON public.matters (time_period_id)
  WHERE matter_type = 'crew_invite';

CREATE OR REPLACE FUNCTION public.close_pending_crew_invites_if_role_full(
  p_time_period_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_needed integer;
  v_confirmed integer;
  v_now timestamptz := clock_timestamp();
BEGIN
  SELECT GREATEST(COALESCE(needed_count, 1), 1)
  INTO v_needed
  FROM public.time_periods
  WHERE id = p_time_period_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT COUNT(*)::integer
  INTO v_confirmed
  FROM public.reserved_crew
  WHERE time_period_id = p_time_period_id
    AND status = 'confirmed';

  IF v_confirmed < v_needed THEN
    RETURN;
  END IF;

  UPDATE public.reserved_crew rc
  SET status = 'canceled'
  WHERE rc.time_period_id = p_time_period_id
    AND rc.status = 'planned'
    AND rc.user_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.matter_recipients mr
      JOIN public.matters m ON m.id = mr.matter_id
      WHERE m.time_period_id = p_time_period_id
        AND m.matter_type = 'crew_invite'
        AND mr.user_id = rc.user_id
        AND mr.status NOT IN ('accepted', 'declined')
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.reserved_crew confirmed
      WHERE confirmed.time_period_id = p_time_period_id
        AND confirmed.user_id = rc.user_id
        AND confirmed.status = 'confirmed'
    );

  INSERT INTO public.matter_responses (matter_id, user_id, response)
  SELECT mr.matter_id, mr.user_id, 'role_filled'
  FROM public.matter_recipients mr
  JOIN public.matters m ON m.id = mr.matter_id
  WHERE m.time_period_id = p_time_period_id
    AND m.matter_type = 'crew_invite'
    AND mr.status NOT IN ('accepted', 'declined')
    AND NOT EXISTS (
      SELECT 1
      FROM public.reserved_crew rc
      WHERE rc.time_period_id = p_time_period_id
        AND rc.user_id = mr.user_id
        AND rc.status = 'confirmed'
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.matter_responses resp
      WHERE resp.matter_id = mr.matter_id
        AND resp.user_id = mr.user_id
        AND lower(resp.response) IN ('approved', 'accepted', 'rejected')
    )
  ON CONFLICT (matter_id, user_id)
  DO UPDATE SET
    response = EXCLUDED.response,
    updated_at = v_now;

  UPDATE public.matter_recipients mr
  SET
    status = 'declined',
    responded_at = COALESCE(mr.responded_at, v_now)
  FROM public.matters m
  WHERE m.id = mr.matter_id
    AND m.time_period_id = p_time_period_id
    AND m.matter_type = 'crew_invite'
    AND mr.status NOT IN ('accepted', 'declined')
    AND NOT EXISTS (
      SELECT 1
      FROM public.reserved_crew rc
      WHERE rc.time_period_id = p_time_period_id
        AND rc.user_id = mr.user_id
        AND rc.status = 'confirmed'
    );
END;
$$;

COMMENT ON FUNCTION public.close_pending_crew_invites_if_role_full(uuid) IS
  'When a crew role is full (confirmed >= needed_count), cancel leftover planned invitees and mark their invites as role_filled.';

CREATE OR REPLACE FUNCTION public.trg_close_crew_invites_when_role_full()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  IF NEW.status = 'confirmed' AND (
    TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'confirmed'
  ) THEN
    PERFORM public.close_pending_crew_invites_if_role_full(NEW.time_period_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_close_crew_invites_when_role_full ON public.reserved_crew;
CREATE TRIGGER trg_close_crew_invites_when_role_full
  AFTER INSERT OR UPDATE OF status
  ON public.reserved_crew
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_close_crew_invites_when_role_full();

CREATE OR REPLACE FUNCTION public.respond_to_crew_invite(
  p_matter_id uuid,
  p_response text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_response text := lower(btrim(COALESCE(p_response, '')));
  v_matter public.matters%ROWTYPE;
  v_needed integer;
  v_confirmed integer;
  v_now timestamptz := clock_timestamp();
  v_crew_id uuid;
  v_crew_status public.booking_status;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF v_response IN ('accepted') THEN
    v_response := 'approved';
  ELSIF v_response IN ('declined') THEN
    v_response := 'rejected';
  END IF;

  IF v_response NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid crew invite response';
  END IF;

  IF public.demo_company_blocks_matter_mutation(p_matter_id) THEN
    RAISE EXCEPTION 'Demo company is read-only';
  END IF;

  SELECT *
  INTO v_matter
  FROM public.matters
  WHERE id = p_matter_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invite not found';
  END IF;

  IF v_matter.matter_type IS DISTINCT FROM 'crew_invite' THEN
    RAISE EXCEPTION 'Not a crew invite';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.matter_recipients mr
    WHERE mr.matter_id = p_matter_id
      AND mr.user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Not a recipient of this invite';
  END IF;

  IF v_matter.time_period_id IS NULL THEN
    RAISE EXCEPTION 'Invite is missing a role';
  END IF;

  -- Serialize accepts for this role so the Nth+1 cannot both confirm.
  PERFORM 1
  FROM public.time_periods
  WHERE id = v_matter.time_period_id
  FOR UPDATE;

  SELECT GREATEST(COALESCE(needed_count, 1), 1)
  INTO v_needed
  FROM public.time_periods
  WHERE id = v_matter.time_period_id;

  SELECT rc.id, rc.status
  INTO v_crew_id, v_crew_status
  FROM public.reserved_crew rc
  WHERE rc.time_period_id = v_matter.time_period_id
    AND rc.user_id = v_user_id
  ORDER BY
    CASE rc.status
      WHEN 'confirmed' THEN 0
      WHEN 'planned' THEN 1
      ELSE 2
    END,
    rc.created_at
  LIMIT 1;

  IF v_response = 'rejected' THEN
    IF v_crew_id IS NOT NULL AND v_crew_status IS DISTINCT FROM 'canceled' THEN
      UPDATE public.reserved_crew
      SET status = 'canceled'
      WHERE id = v_crew_id;
    END IF;

    INSERT INTO public.matter_responses (matter_id, user_id, response)
    VALUES (p_matter_id, v_user_id, 'rejected')
    ON CONFLICT (matter_id, user_id)
    DO UPDATE SET
      response = EXCLUDED.response,
      updated_at = v_now;

    UPDATE public.matter_recipients
    SET
      status = 'declined',
      responded_at = v_now
    WHERE matter_id = p_matter_id
      AND user_id = v_user_id;

    RETURN jsonb_build_object('status', 'canceled');
  END IF;

  -- Already confirmed: keep them booked (idempotent re-accept).
  IF v_crew_status = 'confirmed' THEN
    INSERT INTO public.matter_responses (matter_id, user_id, response)
    VALUES (p_matter_id, v_user_id, 'approved')
    ON CONFLICT (matter_id, user_id)
    DO UPDATE SET
      response = EXCLUDED.response,
      updated_at = v_now;

    UPDATE public.matter_recipients
    SET
      status = 'accepted',
      responded_at = v_now
    WHERE matter_id = p_matter_id
      AND user_id = v_user_id;

    RETURN jsonb_build_object('status', 'confirmed');
  END IF;

  SELECT COUNT(*)::integer
  INTO v_confirmed
  FROM public.reserved_crew
  WHERE time_period_id = v_matter.time_period_id
    AND status = 'confirmed';

  IF v_confirmed >= v_needed THEN
    PERFORM public.close_pending_crew_invites_if_role_full(v_matter.time_period_id);
    RETURN jsonb_build_object('status', 'role_filled');
  END IF;

  IF v_crew_id IS NULL THEN
    RAISE EXCEPTION 'Crew assignment not found for this role';
  END IF;

  UPDATE public.reserved_crew
  SET status = 'confirmed'
  WHERE id = v_crew_id;

  INSERT INTO public.matter_responses (matter_id, user_id, response)
  VALUES (p_matter_id, v_user_id, 'approved')
  ON CONFLICT (matter_id, user_id)
  DO UPDATE SET
    response = EXCLUDED.response,
    updated_at = v_now;

  UPDATE public.matter_recipients
  SET
    status = 'accepted',
    responded_at = v_now
  WHERE matter_id = p_matter_id
    AND user_id = v_user_id;

  RETURN jsonb_build_object('status', 'confirmed');
END;
$$;

COMMENT ON FUNCTION public.respond_to_crew_invite(uuid, text) IS
  'Accept or decline a crew invite. First needed_count accepts win; later accepts return status role_filled.';

REVOKE ALL ON FUNCTION public.close_pending_crew_invites_if_role_full(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.trg_close_crew_invites_when_role_full() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.respond_to_crew_invite(uuid, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.trg_close_crew_invites_when_role_full() TO authenticated;
GRANT EXECUTE ON FUNCTION public.trg_close_crew_invites_when_role_full() TO service_role;
GRANT EXECUTE ON FUNCTION public.respond_to_crew_invite(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_to_crew_invite(uuid, text) TO service_role;
