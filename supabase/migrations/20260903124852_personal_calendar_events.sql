-- Personal calendar holds visible to the company; treated as busy vs crew bookings.

CREATE TABLE IF NOT EXISTS public.personal_calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  title text NOT NULL,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT personal_calendar_events_title_not_blank CHECK (length(trim(title)) > 0),
  CONSTRAINT personal_calendar_events_positive_range CHECK (end_at > start_at)
);

COMMENT ON TABLE public.personal_calendar_events IS
  'Manual personal holds on a company member calendar; not a job booking.';

CREATE INDEX IF NOT EXISTS personal_calendar_events_company_user_start_idx
  ON public.personal_calendar_events (company_id, user_id, start_at);

CREATE OR REPLACE FUNCTION public.touch_personal_calendar_events()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_personal_calendar_events_touch
  ON public.personal_calendar_events;
CREATE TRIGGER trg_personal_calendar_events_touch
  BEFORE UPDATE ON public.personal_calendar_events
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_personal_calendar_events();

ALTER TABLE public.personal_calendar_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Company members can view personal calendar events"
  ON public.personal_calendar_events;
CREATE POLICY "Company members can view personal calendar events"
  ON public.personal_calendar_events
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.company_users cu
      WHERE cu.company_id = personal_calendar_events.company_id
        AND cu.user_id = auth.uid()
        AND cu.role <> 'freelancer'
    )
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.superuser = true
    )
  );

DROP POLICY IF EXISTS "Users can insert own personal calendar events"
  ON public.personal_calendar_events;
CREATE POLICY "Users can insert own personal calendar events"
  ON public.personal_calendar_events
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.company_users cu
      WHERE cu.company_id = personal_calendar_events.company_id
        AND cu.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update own personal calendar events"
  ON public.personal_calendar_events;
CREATE POLICY "Users can update own personal calendar events"
  ON public.personal_calendar_events
  FOR UPDATE
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.company_users cu
      WHERE cu.company_id = personal_calendar_events.company_id
        AND cu.user_id = auth.uid()
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.company_users cu
      WHERE cu.company_id = personal_calendar_events.company_id
        AND cu.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete own personal calendar events"
  ON public.personal_calendar_events;
CREATE POLICY "Users can delete own personal calendar events"
  ON public.personal_calendar_events
  FOR DELETE
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.company_users cu
      WHERE cu.company_id = personal_calendar_events.company_id
        AND cu.user_id = auth.uid()
    )
  );

GRANT ALL ON TABLE public.personal_calendar_events TO anon;
GRANT ALL ON TABLE public.personal_calendar_events TO authenticated;
GRANT ALL ON TABLE public.personal_calendar_events TO service_role;

-- Crew bookings overlap personal holds unless the crew booking is forced.
CREATE OR REPLACE FUNCTION public.check_no_overlapping_crew_booking()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_start timestamptz;
  v_end   timestamptz;
  v_company_id uuid;
  v_exists boolean;
BEGIN
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.forced THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'canceled' THEN
    RETURN NEW;
  END IF;

  SELECT tp.start_at, tp.end_at, tp.company_id
    INTO v_start, v_end, v_company_id
  FROM public.time_periods tp
  WHERE tp.id = NEW.time_period_id;

  IF v_start IS NULL OR v_end IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.reserved_crew rc
    JOIN public.time_periods tp ON tp.id = rc.time_period_id
    WHERE rc.user_id = NEW.user_id
      AND rc.status != 'canceled'
      AND (TG_OP = 'INSERT' OR rc.id != NEW.id)
      AND tstzrange(tp.start_at, tp.end_at, '[)') && tstzrange(v_start, v_end, '[)')
  ) INTO v_exists;

  IF v_exists THEN
    RAISE EXCEPTION 'Crew member is already booked in an overlapping time period'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.personal_calendar_events pe
    WHERE pe.user_id = NEW.user_id
      AND pe.company_id = v_company_id
      AND tstzrange(pe.start_at, pe.end_at, '[)') && tstzrange(v_start, v_end, '[)')
  ) INTO v_exists;

  IF v_exists THEN
    RAISE EXCEPTION 'Crew member has a personal calendar event in an overlapping time period'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_no_overlapping_personal_calendar_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.personal_calendar_events pe
    WHERE pe.user_id = NEW.user_id
      AND pe.company_id = NEW.company_id
      AND (TG_OP = 'INSERT' OR pe.id != NEW.id)
      AND tstzrange(pe.start_at, pe.end_at, '[)') && tstzrange(NEW.start_at, NEW.end_at, '[)')
  ) INTO v_exists;

  IF v_exists THEN
    RAISE EXCEPTION 'This overlaps another personal calendar event'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.reserved_crew rc
    JOIN public.time_periods tp ON tp.id = rc.time_period_id
    WHERE rc.user_id = NEW.user_id
      AND tp.company_id = NEW.company_id
      AND rc.status != 'canceled'
      AND NOT rc.forced
      AND tstzrange(tp.start_at, tp.end_at, '[)') && tstzrange(NEW.start_at, NEW.end_at, '[)')
  ) INTO v_exists;

  IF v_exists THEN
    RAISE EXCEPTION 'This overlaps a crew booking'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_no_overlapping_personal_calendar_event
  ON public.personal_calendar_events;
CREATE TRIGGER trg_check_no_overlapping_personal_calendar_event
  BEFORE INSERT OR UPDATE OF user_id, company_id, start_at, end_at
  ON public.personal_calendar_events
  FOR EACH ROW
  EXECUTE FUNCTION public.check_no_overlapping_personal_calendar_event();
