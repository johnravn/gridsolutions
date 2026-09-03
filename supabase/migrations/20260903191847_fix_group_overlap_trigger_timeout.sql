-- Group exclusive-overlap used to call group_lineage_ids() for every
-- existing group-sourced reserved_items row on each INSERT. Booking a kit
-- expands to many leaf rows, so one sync could run that scan hundreds of
-- times and hit statement_timeout.
--
-- Non-unique kits (the usual case) are capacity-checked by the item
-- quantity trigger. Exclusive overlap is only for unique groups.

CREATE OR REPLACE FUNCTION public.check_no_overlapping_group_booking()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_exists boolean;
  v_start timestamptz;
  v_end timestamptz;
  v_company_id uuid;
  v_lineage uuid[];
  v_unique boolean;
BEGIN
  IF NEW.forced THEN
    RETURN NEW;
  END IF;

  IF NEW.source_kind IS DISTINCT FROM 'group' OR NEW.source_group_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(ig.unique, false)
  INTO v_unique
  FROM public.item_groups ig
  WHERE ig.id = NEW.source_group_id;

  IF NOT COALESCE(v_unique, false) THEN
    RETURN NEW;
  END IF;

  SELECT
    COALESCE(NEW.start_at, tp.start_at),
    COALESCE(NEW.end_at, tp.end_at),
    tp.company_id
  INTO v_start, v_end, v_company_id
  FROM public.time_periods tp
  WHERE tp.id = NEW.time_period_id;

  IF v_start IS NULL OR v_end IS NULL THEN
    RETURN NEW;
  END IF;

  v_lineage := public.group_lineage_ids(NEW.source_group_id);

  SELECT EXISTS (
    SELECT 1
    FROM public.reserved_items ri
    JOIN public.time_periods tp ON tp.id = ri.time_period_id
    WHERE ri.source_kind = 'group'
      AND ri.source_group_id = ANY (v_lineage)
      AND tp.company_id IS NOT DISTINCT FROM v_company_id
      AND ri.time_period_id IS DISTINCT FROM NEW.time_period_id
      AND (TG_OP = 'INSERT' OR ri.id != NEW.id)
      AND tp.start_at < v_end
      AND tp.end_at > v_start
      AND tstzrange(
            COALESCE(ri.start_at, tp.start_at),
            COALESCE(ri.end_at, tp.end_at),
            '[)'
          ) && tstzrange(v_start, v_end, '[)')
  ) INTO v_exists;

  IF v_exists THEN
    RAISE EXCEPTION 'Group is already booked in an overlapping time period'
      USING ERRCODE = 'exclusion_violation';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.check_no_overlapping_group_booking()
  IS 'Prevent overlapping unique-group bookings (self/parent/child) unless forced=true; same time_period_id sibling rows are excluded';

CREATE OR REPLACE FUNCTION public.get_conflicts_groups(
  p_company_id uuid,
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL
)
RETURNS TABLE (
  group_id_1 uuid,
  group_id_2 uuid,
  group_name_1 text,
  group_name_2 text,
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
  WITH grouped AS (
    SELECT
      ri.source_group_id,
      ri.time_period_id,
      tp.job_id,
      j.title AS job_title,
      MIN(COALESCE(ri.start_at, tp.start_at)) AS start_at,
      MAX(COALESCE(ri.end_at, tp.end_at)) AS end_at,
      BOOL_OR(ri.forced) AS forced
    FROM public.reserved_items ri
    JOIN public.time_periods tp ON tp.id = ri.time_period_id
    JOIN public.item_groups ig ON ig.id = ri.source_group_id AND ig.unique
    LEFT JOIN public.jobs j ON j.id = tp.job_id
    WHERE tp.company_id = p_company_id
      AND ri.source_kind = 'group'
      AND ri.source_group_id IS NOT NULL
      AND (p_from IS NULL OR tp.end_at >= p_from)
      AND (p_to IS NULL OR tp.start_at <= p_to)
    GROUP BY ri.source_group_id, ri.time_period_id, tp.job_id, j.title
  ),
  bookings AS (
    SELECT
      g.source_group_id,
      g.time_period_id,
      g.job_id,
      g.job_title,
      g.start_at,
      g.end_at,
      g.forced,
      public.group_lineage_ids(g.source_group_id) AS lineage
    FROM grouped g
  )
  SELECT
    a.source_group_id AS group_id_1,
    b.source_group_id AS group_id_2,
    (SELECT ig.name FROM public.item_groups ig WHERE ig.id = a.source_group_id) AS group_name_1,
    (SELECT ig.name FROM public.item_groups ig WHERE ig.id = b.source_group_id) AS group_name_2,
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
  FROM bookings a
  JOIN bookings b
    ON a.time_period_id < b.time_period_id
    AND b.source_group_id = ANY (a.lineage)
    AND tstzrange(a.start_at, a.end_at, '[)') && tstzrange(b.start_at, b.end_at, '[)');
END;
$$;

COMMENT ON FUNCTION public.get_conflicts_groups(uuid, timestamptz, timestamptz)
  IS 'Returns overlapping unique-group bookings (self/parent/child) in the company within the optional date range';
