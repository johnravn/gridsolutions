-- Conflict detection: prevent double-booking of crew and vehicles (excluding canceled)
-- and add RPCs to list conflicts for the UI.

-- =============================================================================
-- 1. Crew: prevent overlapping non-canceled bookings for the same user
-- =============================================================================
-- Use a trigger since reserved_crew.during may not always be populated from time_periods.
-- We check overlap via time_periods.start_at/end_at.

CREATE OR REPLACE FUNCTION public.check_no_overlapping_crew_booking()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_start timestamptz;
  v_end   timestamptz;
  v_exists boolean;
BEGIN
  -- Placeholder slots (no user_id) are not checked for overlap
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Only consider non-canceled bookings
  IF NEW.status = 'canceled' THEN
    RETURN NEW;
  END IF;

  SELECT tp.start_at, tp.end_at INTO v_start, v_end
  FROM public.time_periods tp
  WHERE tp.id = NEW.time_period_id;

  IF v_start IS NULL OR v_end IS NULL THEN
    RETURN NEW;
  END IF;

  -- Check for another non-canceled reserved_crew for same user with overlapping period
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

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_no_overlapping_crew_booking ON public.reserved_crew;
CREATE TRIGGER trg_check_no_overlapping_crew_booking
  BEFORE INSERT OR UPDATE OF time_period_id, user_id, status
  ON public.reserved_crew
  FOR EACH ROW
  EXECUTE FUNCTION public.check_no_overlapping_crew_booking();


-- =============================================================================
-- 2. Vehicles: make exclusion constraint partial so canceled bookings don't block
-- =============================================================================
ALTER TABLE public.reserved_vehicles
  DROP CONSTRAINT IF EXISTS no_overlapping_vehicle_bookings;

ALTER TABLE public.reserved_vehicles
  ADD CONSTRAINT no_overlapping_vehicle_bookings
  EXCLUDE USING gist (vehicle_id WITH =, during WITH &&)
  WHERE (status IS DISTINCT FROM 'canceled');

COMMENT ON CONSTRAINT no_overlapping_vehicle_bookings ON public.reserved_vehicles
  IS 'Prevent overlapping vehicle bookings; canceled bookings are excluded from the check';


-- =============================================================================
-- 3. RPC: List crew conflicts in a date range (overlapping assignments per user)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_conflicts_crew(
  p_company_id uuid,
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL
)
RETURNS TABLE (
  user_id uuid,
  user_display_name text,
  period_id_1 uuid,
  period_id_2 uuid,
  job_id_1 uuid,
  job_id_2 uuid,
  job_title_1 text,
  job_title_2 text,
  start_1 timestamptz,
  end_1 timestamptz,
  start_2 timestamptz,
  end_2 timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.user_id,
    (SELECT pr.display_name FROM public.profiles pr WHERE pr.user_id = a.user_id),
    a.time_period_id AS period_id_1,
    b.time_period_id AS period_id_2,
    a.job_id AS job_id_1,
    b.job_id AS job_id_2,
    a.job_title AS job_title_1,
    b.job_title AS job_title_2,
    a.start_at AS start_1,
    a.end_at AS end_1,
    b.start_at AS start_2,
    b.end_at AS end_2
  FROM (
    SELECT
      rc.user_id,
      rc.time_period_id,
      tp.job_id,
      j.title AS job_title,
      tp.start_at,
      tp.end_at
    FROM public.reserved_crew rc
    JOIN public.time_periods tp ON tp.id = rc.time_period_id
    LEFT JOIN public.jobs j ON j.id = tp.job_id
    WHERE tp.company_id = p_company_id
      AND rc.status != 'canceled'
      AND rc.user_id IS NOT NULL
      AND (p_from IS NULL OR tp.end_at >= p_from)
      AND (p_to IS NULL OR tp.start_at <= p_to)
  ) a
  JOIN (
    SELECT
      rc.user_id,
      rc.time_period_id,
      tp.job_id,
      j.title AS job_title,
      tp.start_at,
      tp.end_at
    FROM public.reserved_crew rc
    JOIN public.time_periods tp ON tp.id = rc.time_period_id
    LEFT JOIN public.jobs j ON j.id = tp.job_id
    WHERE tp.company_id = p_company_id
      AND rc.status != 'canceled'
      AND rc.user_id IS NOT NULL
      AND (p_from IS NULL OR tp.end_at >= p_from)
      AND (p_to IS NULL OR tp.start_at <= p_to)
  ) b ON a.user_id = b.user_id
    AND a.time_period_id < b.time_period_id
    AND tstzrange(a.start_at, a.end_at, '[)') && tstzrange(b.start_at, b.end_at, '[)');
END;
$$;

COMMENT ON FUNCTION public.get_conflicts_crew(uuid, timestamptz, timestamptz)
  IS 'Returns one row per overlapping crew booking pair in the company within the optional date range';


-- =============================================================================
-- 4. RPC: List vehicle conflicts in a date range (with partial constraint, normally empty)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_conflicts_vehicle(
  p_company_id uuid,
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL
)
RETURNS TABLE (
  vehicle_id uuid,
  vehicle_name text,
  period_id_1 uuid,
  period_id_2 uuid,
  job_id_1 uuid,
  job_id_2 uuid,
  job_title_1 text,
  job_title_2 text,
  start_1 timestamptz,
  end_1 timestamptz,
  start_2 timestamptz,
  end_2 timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.vehicle_id,
    (SELECT v.name FROM public.vehicles v WHERE v.id = a.vehicle_id),
    a.time_period_id AS period_id_1,
    b.time_period_id AS period_id_2,
    a.job_id AS job_id_1,
    b.job_id AS job_id_2,
    a.job_title AS job_title_1,
    b.job_title AS job_title_2,
    a.start_at AS start_1,
    a.end_at AS end_1,
    b.start_at AS start_2,
    b.end_at AS end_2
  FROM (
    SELECT
      rv.vehicle_id,
      rv.time_period_id,
      tp.job_id,
      j.title AS job_title,
      tp.start_at,
      tp.end_at
    FROM public.reserved_vehicles rv
    JOIN public.time_periods tp ON tp.id = rv.time_period_id
    LEFT JOIN public.jobs j ON j.id = tp.job_id
    WHERE tp.company_id = p_company_id
      AND rv.status != 'canceled'
      AND (p_from IS NULL OR tp.end_at >= p_from)
      AND (p_to IS NULL OR tp.start_at <= p_to)
  ) a
  JOIN (
    SELECT
      rv.vehicle_id,
      rv.time_period_id,
      tp.job_id,
      j.title AS job_title,
      tp.start_at,
      tp.end_at
    FROM public.reserved_vehicles rv
    JOIN public.time_periods tp ON tp.id = rv.time_period_id
    LEFT JOIN public.jobs j ON j.id = tp.job_id
    WHERE tp.company_id = p_company_id
      AND rv.status != 'canceled'
      AND (p_from IS NULL OR tp.end_at >= p_from)
      AND (p_to IS NULL OR tp.start_at <= p_to)
  ) b ON a.vehicle_id = b.vehicle_id
    AND a.time_period_id < b.time_period_id
    AND tstzrange(a.start_at, a.end_at, '[)') && tstzrange(b.start_at, b.end_at, '[)');
END;
$$;

COMMENT ON FUNCTION public.get_conflicts_vehicle(uuid, timestamptz, timestamptz)
  IS 'Returns one row per overlapping vehicle booking pair; normally empty due to EXCLUDE constraint';
