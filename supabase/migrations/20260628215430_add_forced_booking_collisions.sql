-- Forced booking support: allow intentional overlaps with visibility on dashboard.
-- Adds forced columns to crew/vehicles, updates enforcement triggers,
-- replaces vehicle EXCLUDE with trigger (forced bypass), and extends conflict RPCs.

-- =============================================================================
-- 1. Schema: forced + audit columns
-- =============================================================================

ALTER TABLE public.reserved_crew
  ADD COLUMN IF NOT EXISTS forced boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS forced_at timestamptz,
  ADD COLUMN IF NOT EXISTS forced_by_user_id uuid REFERENCES public.profiles(user_id);

ALTER TABLE public.reserved_vehicles
  ADD COLUMN IF NOT EXISTS forced boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS forced_at timestamptz,
  ADD COLUMN IF NOT EXISTS forced_by_user_id uuid REFERENCES public.profiles(user_id);

ALTER TABLE public.reserved_items
  ADD COLUMN IF NOT EXISTS forced_at timestamptz,
  ADD COLUMN IF NOT EXISTS forced_by_user_id uuid REFERENCES public.profiles(user_id);

COMMENT ON COLUMN public.reserved_crew.forced IS 'Intentional overlap; bypasses crew double-booking check';
COMMENT ON COLUMN public.reserved_vehicles.forced IS 'Intentional overlap; bypasses vehicle double-booking check';
COMMENT ON COLUMN public.reserved_items.forced IS 'Intentional over-capacity booking; bypasses quantity check';


-- =============================================================================
-- 2. Crew: respect forced flag
-- =============================================================================

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
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.forced THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'canceled' THEN
    RETURN NEW;
  END IF;

  SELECT tp.start_at, tp.end_at INTO v_start, v_end
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

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_no_overlapping_crew_booking ON public.reserved_crew;
CREATE TRIGGER trg_check_no_overlapping_crew_booking
  BEFORE INSERT OR UPDATE OF time_period_id, user_id, status, forced
  ON public.reserved_crew
  FOR EACH ROW
  EXECUTE FUNCTION public.check_no_overlapping_crew_booking();


-- =============================================================================
-- 3. Vehicles: replace EXCLUDE with trigger (forced bypass)
-- =============================================================================

ALTER TABLE public.reserved_vehicles
  DROP CONSTRAINT IF EXISTS no_overlapping_vehicle_bookings;

CREATE OR REPLACE FUNCTION public.check_no_overlapping_vehicle_booking()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_exists boolean;
BEGIN
  IF NEW.forced THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'canceled' THEN
    RETURN NEW;
  END IF;

  IF NEW.during IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.reserved_vehicles rv
    WHERE rv.vehicle_id = NEW.vehicle_id
      AND rv.status IS DISTINCT FROM 'canceled'
      AND (TG_OP = 'INSERT' OR rv.id != NEW.id)
      AND rv.during IS NOT NULL
      AND rv.during && NEW.during
  ) INTO v_exists;

  IF v_exists THEN
    RAISE EXCEPTION 'Vehicle is already booked in an overlapping time period'
      USING ERRCODE = 'exclusion_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_no_overlapping_vehicle_booking ON public.reserved_vehicles;
CREATE TRIGGER trg_check_no_overlapping_vehicle_booking
  BEFORE INSERT OR UPDATE OF vehicle_id, time_period_id, start_at, end_at, status, forced
  ON public.reserved_vehicles
  FOR EACH ROW
  EXECUTE FUNCTION public.check_no_overlapping_vehicle_booking();

COMMENT ON FUNCTION public.check_no_overlapping_vehicle_booking()
  IS 'Prevent overlapping vehicle bookings unless forced=true; canceled bookings are excluded';


-- =============================================================================
-- 4. Equipment: respect forced flag and exclude canceled/forced from capacity sum
-- =============================================================================

CREATE OR REPLACE FUNCTION public.check_item_quantity()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  hdr_start timestamptz;
  hdr_end   timestamptz;
  eff_start timestamptz;
  eff_end   timestamptz;
  overlap_sum integer;
  capacity  integer;
BEGIN
  IF NEW.forced THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'canceled' THEN
    RETURN NEW;
  END IF;

  SELECT r.start_at, r.end_at INTO hdr_start, hdr_end
  FROM public.time_periods r
  WHERE r.id = NEW.time_period_id;

  IF hdr_start IS NULL OR hdr_end IS NULL THEN
    RAISE EXCEPTION 'Reservation % must have start_at and end_at before adding items',
      NEW.time_period_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  eff_start := COALESCE(NEW.start_at, hdr_start);
  eff_end   := COALESCE(NEW.end_at,   hdr_end);

  SELECT total_quantity INTO capacity
  FROM public.items
  WHERE id = NEW.item_id;

  IF capacity IS NULL THEN
    RAISE EXCEPTION 'Item % does not exist', NEW.item_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  SELECT COALESCE(SUM(ri.quantity), 0) INTO overlap_sum
  FROM public.reserved_items ri
  JOIN public.time_periods r2 ON r2.id = ri.time_period_id
  WHERE ri.item_id = NEW.item_id
    AND ri.status IS DISTINCT FROM 'canceled'
    AND NOT ri.forced
    AND tstzrange(
          COALESCE(ri.start_at, r2.start_at),
          COALESCE(ri.end_at,   r2.end_at),
          '[)'
        ) && tstzrange(eff_start, eff_end, '[)')
    AND (TG_OP <> 'UPDATE' OR ri.id <> NEW.id);

  IF overlap_sum + NEW.quantity > capacity THEN
    RAISE EXCEPTION
      'Not enough quantity for item %, requested=% / capacity=% in period',
      NEW.item_id, (overlap_sum + NEW.quantity), capacity
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reserved_items_qty_guard ON public.reserved_items;
CREATE TRIGGER reserved_items_qty_guard
  BEFORE INSERT OR UPDATE OF item_id, quantity, start_at, end_at, time_period_id, status, forced
  ON public.reserved_items
  FOR EACH ROW
  EXECUTE FUNCTION public.check_item_quantity();


-- =============================================================================
-- 5. Update conflict RPCs: add forced flags
-- =============================================================================

DROP FUNCTION IF EXISTS public.get_conflicts_crew(uuid, timestamptz, timestamptz);
DROP FUNCTION IF EXISTS public.get_conflicts_vehicle(uuid, timestamptz, timestamptz);

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
  end_2 timestamptz,
  forced_1 boolean,
  forced_2 boolean
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
    b.end_at AS end_2,
    a.forced AS forced_1,
    b.forced AS forced_2
  FROM (
    SELECT
      rc.user_id,
      rc.time_period_id,
      rc.forced,
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
      rc.forced,
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
  end_2 timestamptz,
  forced_1 boolean,
  forced_2 boolean
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
    b.end_at AS end_2,
    a.forced AS forced_1,
    b.forced AS forced_2
  FROM (
    SELECT
      rv.vehicle_id,
      rv.time_period_id,
      rv.forced,
      tp.job_id,
      j.title AS job_title,
      tp.start_at,
      tp.end_at
    FROM public.reserved_vehicles rv
    JOIN public.time_periods tp ON tp.id = rv.time_period_id
    LEFT JOIN public.jobs j ON j.id = tp.job_id
    WHERE tp.company_id = p_company_id
      AND rv.status IS DISTINCT FROM 'canceled'
      AND (p_from IS NULL OR tp.end_at >= p_from)
      AND (p_to IS NULL OR tp.start_at <= p_to)
  ) a
  JOIN (
    SELECT
      rv.vehicle_id,
      rv.time_period_id,
      rv.forced,
      tp.job_id,
      j.title AS job_title,
      tp.start_at,
      tp.end_at
    FROM public.reserved_vehicles rv
    JOIN public.time_periods tp ON tp.id = rv.time_period_id
    LEFT JOIN public.jobs j ON j.id = tp.job_id
    WHERE tp.company_id = p_company_id
      AND rv.status IS DISTINCT FROM 'canceled'
      AND (p_from IS NULL OR tp.end_at >= p_from)
      AND (p_to IS NULL OR tp.start_at <= p_to)
  ) b ON a.vehicle_id = b.vehicle_id
    AND a.time_period_id < b.time_period_id
    AND tstzrange(a.start_at, a.end_at, '[)') && tstzrange(b.start_at, b.end_at, '[)');
END;
$$;


-- =============================================================================
-- 6. Equipment capacity conflicts RPC
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_conflicts_equipment(
  p_company_id uuid,
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL
)
RETURNS TABLE (
  item_id uuid,
  item_name text,
  capacity integer,
  total_reserved integer,
  start_at timestamptz,
  end_at timestamptz,
  job_ids uuid[],
  job_titles text[],
  has_forced boolean
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  RETURN QUERY
  WITH segments AS (
    SELECT
      ri.id,
      ri.item_id,
      ri.quantity,
      ri.forced,
      tp.job_id,
      j.title AS job_title,
      COALESCE(ri.start_at, tp.start_at) AS eff_start,
      COALESCE(ri.end_at, tp.end_at) AS eff_end
    FROM public.reserved_items ri
    JOIN public.time_periods tp ON tp.id = ri.time_period_id
    LEFT JOIN public.jobs j ON j.id = tp.job_id
    WHERE tp.company_id = p_company_id
      AND ri.status IS DISTINCT FROM 'canceled'
      AND (p_from IS NULL OR tp.end_at >= p_from)
      AND (p_to IS NULL OR tp.start_at <= p_to)
  ),
  overlap_groups AS (
    SELECT
      a.item_id,
      a.eff_start,
      a.eff_end,
      SUM(b.quantity)::integer AS total_reserved,
      BOOL_OR(b.forced) AS has_forced,
      array_agg(DISTINCT b.job_id) FILTER (WHERE b.job_id IS NOT NULL) AS job_ids,
      array_agg(DISTINCT b.job_title) FILTER (WHERE b.job_title IS NOT NULL) AS job_titles
    FROM segments a
    JOIN segments b
      ON a.item_id = b.item_id
      AND tstzrange(a.eff_start, a.eff_end, '[)') && tstzrange(b.eff_start, b.eff_end, '[)')
    GROUP BY a.item_id, a.eff_start, a.eff_end
  )
  SELECT DISTINCT ON (o.item_id, o.eff_start, o.eff_end)
    o.item_id,
    i.name AS item_name,
    i.total_quantity AS capacity,
    o.total_reserved,
    o.eff_start AS start_at,
    o.eff_end AS end_at,
    o.job_ids,
    o.job_titles,
    o.has_forced
  FROM overlap_groups o
  JOIN public.items i ON i.id = o.item_id
  WHERE o.total_reserved > i.total_quantity
  ORDER BY o.item_id, o.eff_start, o.eff_end;
END;
$$;

COMMENT ON FUNCTION public.get_conflicts_equipment(uuid, timestamptz, timestamptz)
  IS 'Returns equipment capacity overruns in the company within the optional date range';


-- =============================================================================
-- 7. Job-scoped booking conflicts RPC (JSON for client convenience)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_job_booking_conflicts(
  p_job_id uuid,
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_company_id uuid;
  v_crew jsonb;
  v_vehicles jsonb;
  v_equipment jsonb;
BEGIN
  SELECT j.company_id INTO v_company_id
  FROM public.jobs j
  WHERE j.id = p_job_id;

  IF v_company_id IS NULL THEN
    RETURN jsonb_build_object('crew', '[]'::jsonb, 'vehicles', '[]'::jsonb, 'equipment', '[]'::jsonb);
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(c)::jsonb), '[]'::jsonb) INTO v_crew
  FROM public.get_conflicts_crew(v_company_id, p_from, p_to) c
  WHERE c.job_id_1 = p_job_id OR c.job_id_2 = p_job_id;

  SELECT COALESCE(jsonb_agg(row_to_json(v)::jsonb), '[]'::jsonb) INTO v_vehicles
  FROM public.get_conflicts_vehicle(v_company_id, p_from, p_to) v
  WHERE v.job_id_1 = p_job_id OR v.job_id_2 = p_job_id;

  SELECT COALESCE(jsonb_agg(row_to_json(e)::jsonb), '[]'::jsonb) INTO v_equipment
  FROM public.get_conflicts_equipment(v_company_id, p_from, p_to) e
  WHERE p_job_id = ANY(e.job_ids);

  RETURN jsonb_build_object(
    'crew', v_crew,
    'vehicles', v_vehicles,
    'equipment', v_equipment
  );
END;
$$;

COMMENT ON FUNCTION public.get_job_booking_conflicts(uuid, timestamptz, timestamptz)
  IS 'Returns crew, vehicle, and equipment conflicts involving the given job';
