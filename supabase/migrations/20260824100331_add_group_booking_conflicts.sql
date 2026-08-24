-- Treat item groups as unique resources: overlapping bookings of the same
-- group (or a nested parent/child) are conflicts, like vehicles.
-- Nested expansion for capacity stays on the client; this migration adds
-- lineage lookup, an insert/update trigger, and dashboard RPCs.

-- =============================================================================
-- 1. Lineage: self + ancestors + descendants (depth cap 10)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.group_lineage_ids(p_group_id uuid)
RETURNS uuid[]
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_ids uuid[] := ARRAY[]::uuid[];
  v_frontier uuid[];
  v_next uuid[];
  v_depth integer;
BEGIN
  IF p_group_id IS NULL THEN
    RETURN ARRAY[]::uuid[];
  END IF;

  v_ids := ARRAY[p_group_id];

  -- Descendants
  v_frontier := ARRAY[p_group_id];
  v_depth := 0;
  WHILE cardinality(v_frontier) > 0 AND v_depth < 10 LOOP
    SELECT COALESCE(
      array_agg(DISTINCT gi.child_group_id) FILTER (
        WHERE gi.child_group_id IS NOT NULL
          AND NOT gi.child_group_id = ANY (v_ids)
      ),
      ARRAY[]::uuid[]
    )
    INTO v_next
    FROM public.group_items gi
    WHERE gi.group_id = ANY (v_frontier);

    EXIT WHEN cardinality(v_next) = 0;

    v_ids := v_ids || v_next;
    v_frontier := v_next;
    v_depth := v_depth + 1;
  END LOOP;

  -- Ancestors
  v_frontier := ARRAY[p_group_id];
  v_depth := 0;
  WHILE cardinality(v_frontier) > 0 AND v_depth < 10 LOOP
    SELECT COALESCE(
      array_agg(DISTINCT gi.group_id) FILTER (
        WHERE NOT gi.group_id = ANY (v_ids)
      ),
      ARRAY[]::uuid[]
    )
    INTO v_next
    FROM public.group_items gi
    WHERE gi.child_group_id = ANY (v_frontier);

    EXIT WHEN cardinality(v_next) = 0;

    v_ids := v_ids || v_next;
    v_frontier := v_next;
    v_depth := v_depth + 1;
  END LOOP;

  RETURN v_ids;
END;
$$;

COMMENT ON FUNCTION public.group_lineage_ids(uuid)
  IS 'Returns the group id plus ancestor and descendant group ids (depth cap 10)';


-- =============================================================================
-- 2. Trigger: block overlapping group bookings unless forced
-- =============================================================================

CREATE OR REPLACE FUNCTION public.check_no_overlapping_group_booking()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_exists boolean;
  v_start timestamptz;
  v_end timestamptz;
  v_lineage uuid[];
BEGIN
  IF NEW.forced THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'canceled' THEN
    RETURN NEW;
  END IF;

  IF NEW.source_kind IS DISTINCT FROM 'group' OR NEW.source_group_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(NEW.start_at, tp.start_at), COALESCE(NEW.end_at, tp.end_at)
  INTO v_start, v_end
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
      AND ri.source_group_id IS NOT NULL
      AND ri.status IS DISTINCT FROM 'canceled'
      AND ri.time_period_id IS DISTINCT FROM NEW.time_period_id
      AND (TG_OP = 'INSERT' OR ri.id != NEW.id)
      AND public.group_lineage_ids(ri.source_group_id) && v_lineage
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

DROP TRIGGER IF EXISTS trg_check_no_overlapping_group_booking ON public.reserved_items;
CREATE TRIGGER trg_check_no_overlapping_group_booking
  BEFORE INSERT OR UPDATE OF
    source_kind,
    source_group_id,
    time_period_id,
    start_at,
    end_at,
    status,
    forced
  ON public.reserved_items
  FOR EACH ROW
  EXECUTE FUNCTION public.check_no_overlapping_group_booking();

COMMENT ON FUNCTION public.check_no_overlapping_group_booking()
  IS 'Prevent overlapping group bookings (including nested relatives) unless forced=true; same time_period_id sibling rows are excluded';


-- =============================================================================
-- 3. Dashboard RPC: overlapping group bookings
-- =============================================================================

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
    LEFT JOIN public.jobs j ON j.id = tp.job_id
    WHERE tp.company_id = p_company_id
      AND ri.source_kind = 'group'
      AND ri.source_group_id IS NOT NULL
      AND ri.status IS DISTINCT FROM 'canceled'
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
    AND a.lineage && b.lineage
    AND tstzrange(a.start_at, a.end_at, '[)') && tstzrange(b.start_at, b.end_at, '[)');
END;
$$;

COMMENT ON FUNCTION public.get_conflicts_groups(uuid, timestamptz, timestamptz)
  IS 'Returns overlapping group bookings (including nested relatives) in the company within the optional date range';


-- =============================================================================
-- 4. Job-scoped booking conflicts: include groups
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
  v_groups jsonb;
BEGIN
  SELECT j.company_id INTO v_company_id
  FROM public.jobs j
  WHERE j.id = p_job_id;

  IF v_company_id IS NULL THEN
    RETURN jsonb_build_object(
      'crew', '[]'::jsonb,
      'vehicles', '[]'::jsonb,
      'equipment', '[]'::jsonb,
      'groups', '[]'::jsonb
    );
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

  SELECT COALESCE(jsonb_agg(row_to_json(g)::jsonb), '[]'::jsonb) INTO v_groups
  FROM public.get_conflicts_groups(v_company_id, p_from, p_to) g
  WHERE g.job_id_1 = p_job_id OR g.job_id_2 = p_job_id;

  RETURN jsonb_build_object(
    'crew', v_crew,
    'vehicles', v_vehicles,
    'equipment', v_equipment,
    'groups', v_groups
  );
END;
$$;

COMMENT ON FUNCTION public.get_job_booking_conflicts(uuid, timestamptz, timestamptz)
  IS 'Returns crew, vehicle, equipment, and group conflicts involving the given job';
