-- Phase B: rewrite get_job_booking_conflicts to resolve conflicts for one job
-- without running four company-wide get_conflicts_* scanners.
-- Overlap only entities booked on the given job (plus their overlapping peers).

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

  -- -------------------------------------------------------------------------
  -- Crew: pairs involving this job's crew bookings (same user, overlapping)
  -- -------------------------------------------------------------------------
  WITH job_crew AS (
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
    WHERE tp.job_id = p_job_id
      AND tp.company_id = v_company_id
      AND COALESCE(tp.deleted, false) = false
      AND rc.status != 'canceled'
      AND rc.user_id IS NOT NULL
      AND (p_from IS NULL OR tp.end_at >= p_from)
      AND (p_to IS NULL OR tp.start_at <= p_to)
  ),
  peer_crew AS (
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
    WHERE tp.company_id = v_company_id
      AND COALESCE(tp.deleted, false) = false
      AND rc.status != 'canceled'
      AND rc.user_id IS NOT NULL
      AND rc.user_id IN (SELECT DISTINCT jc.user_id FROM job_crew jc)
      AND (p_from IS NULL OR tp.end_at >= p_from)
      AND (p_to IS NULL OR tp.start_at <= p_to)
  ),
  crew_pairs AS (
    SELECT
      a.user_id,
      (SELECT pr.display_name FROM public.profiles pr WHERE pr.user_id = a.user_id)
        AS user_display_name,
      CASE
        WHEN a.time_period_id < b.time_period_id THEN a.time_period_id
        ELSE b.time_period_id
      END AS period_id_1,
      CASE
        WHEN a.time_period_id < b.time_period_id THEN b.time_period_id
        ELSE a.time_period_id
      END AS period_id_2,
      CASE
        WHEN a.time_period_id < b.time_period_id THEN a.job_id
        ELSE b.job_id
      END AS job_id_1,
      CASE
        WHEN a.time_period_id < b.time_period_id THEN b.job_id
        ELSE a.job_id
      END AS job_id_2,
      CASE
        WHEN a.time_period_id < b.time_period_id THEN a.job_title
        ELSE b.job_title
      END AS job_title_1,
      CASE
        WHEN a.time_period_id < b.time_period_id THEN b.job_title
        ELSE a.job_title
      END AS job_title_2,
      CASE
        WHEN a.time_period_id < b.time_period_id THEN a.start_at
        ELSE b.start_at
      END AS start_1,
      CASE
        WHEN a.time_period_id < b.time_period_id THEN a.end_at
        ELSE b.end_at
      END AS end_1,
      CASE
        WHEN a.time_period_id < b.time_period_id THEN b.start_at
        ELSE a.start_at
      END AS start_2,
      CASE
        WHEN a.time_period_id < b.time_period_id THEN b.end_at
        ELSE a.end_at
      END AS end_2,
      CASE
        WHEN a.time_period_id < b.time_period_id THEN a.forced
        ELSE b.forced
      END AS forced_1,
      CASE
        WHEN a.time_period_id < b.time_period_id THEN b.forced
        ELSE a.forced
      END AS forced_2
    FROM job_crew a
    JOIN peer_crew b
      ON a.user_id = b.user_id
      AND a.time_period_id IS DISTINCT FROM b.time_period_id
      AND tstzrange(a.start_at, a.end_at, '[)') && tstzrange(b.start_at, b.end_at, '[)')
    WHERE b.job_id IS DISTINCT FROM p_job_id
       OR a.time_period_id < b.time_period_id
  )
  SELECT COALESCE(jsonb_agg(row_to_json(c)::jsonb), '[]'::jsonb)
  INTO v_crew
  FROM crew_pairs c;

  -- -------------------------------------------------------------------------
  -- Vehicles: effective windows (custom start/end or time period)
  -- -------------------------------------------------------------------------
  WITH job_vehicles AS (
    SELECT
      rv.vehicle_id,
      rv.time_period_id,
      rv.forced,
      tp.job_id,
      j.title AS job_title,
      COALESCE(rv.start_at, tp.start_at) AS eff_start,
      COALESCE(rv.end_at, tp.end_at) AS eff_end
    FROM public.reserved_vehicles rv
    JOIN public.time_periods tp ON tp.id = rv.time_period_id
    LEFT JOIN public.jobs j ON j.id = tp.job_id
    LEFT JOIN public.vehicles veh ON veh.id = rv.vehicle_id
    WHERE tp.job_id = p_job_id
      AND tp.company_id = v_company_id
      AND COALESCE(tp.deleted, false) = false
      AND COALESCE(veh.deleted, false) = false
      AND (p_from IS NULL OR COALESCE(rv.end_at, tp.end_at) >= p_from)
      AND (p_to IS NULL OR COALESCE(rv.start_at, tp.start_at) <= p_to)
  ),
  peer_vehicles AS (
    SELECT
      rv.vehicle_id,
      rv.time_period_id,
      rv.forced,
      tp.job_id,
      j.title AS job_title,
      COALESCE(rv.start_at, tp.start_at) AS eff_start,
      COALESCE(rv.end_at, tp.end_at) AS eff_end
    FROM public.reserved_vehicles rv
    JOIN public.time_periods tp ON tp.id = rv.time_period_id
    LEFT JOIN public.jobs j ON j.id = tp.job_id
    LEFT JOIN public.vehicles veh ON veh.id = rv.vehicle_id
    WHERE tp.company_id = v_company_id
      AND COALESCE(tp.deleted, false) = false
      AND COALESCE(veh.deleted, false) = false
      AND rv.vehicle_id IN (SELECT DISTINCT jv.vehicle_id FROM job_vehicles jv)
      AND (p_from IS NULL OR COALESCE(rv.end_at, tp.end_at) >= p_from)
      AND (p_to IS NULL OR COALESCE(rv.start_at, tp.start_at) <= p_to)
  ),
  vehicle_pairs AS (
    SELECT
      a.vehicle_id,
      (SELECT v.name FROM public.vehicles v WHERE v.id = a.vehicle_id) AS vehicle_name,
      CASE
        WHEN a.time_period_id < b.time_period_id THEN a.time_period_id
        ELSE b.time_period_id
      END AS period_id_1,
      CASE
        WHEN a.time_period_id < b.time_period_id THEN b.time_period_id
        ELSE a.time_period_id
      END AS period_id_2,
      CASE
        WHEN a.time_period_id < b.time_period_id THEN a.job_id
        ELSE b.job_id
      END AS job_id_1,
      CASE
        WHEN a.time_period_id < b.time_period_id THEN b.job_id
        ELSE a.job_id
      END AS job_id_2,
      CASE
        WHEN a.time_period_id < b.time_period_id THEN a.job_title
        ELSE b.job_title
      END AS job_title_1,
      CASE
        WHEN a.time_period_id < b.time_period_id THEN b.job_title
        ELSE a.job_title
      END AS job_title_2,
      CASE
        WHEN a.time_period_id < b.time_period_id THEN a.eff_start
        ELSE b.eff_start
      END AS start_1,
      CASE
        WHEN a.time_period_id < b.time_period_id THEN a.eff_end
        ELSE b.eff_end
      END AS end_1,
      CASE
        WHEN a.time_period_id < b.time_period_id THEN b.eff_start
        ELSE a.eff_start
      END AS start_2,
      CASE
        WHEN a.time_period_id < b.time_period_id THEN b.eff_end
        ELSE a.eff_end
      END AS end_2,
      CASE
        WHEN a.time_period_id < b.time_period_id THEN a.forced
        ELSE b.forced
      END AS forced_1,
      CASE
        WHEN a.time_period_id < b.time_period_id THEN b.forced
        ELSE a.forced
      END AS forced_2
    FROM job_vehicles a
    JOIN peer_vehicles b
      ON a.vehicle_id = b.vehicle_id
      AND a.time_period_id IS DISTINCT FROM b.time_period_id
      AND tstzrange(a.eff_start, a.eff_end, '[)')
        && tstzrange(b.eff_start, b.eff_end, '[)')
    WHERE b.job_id IS DISTINCT FROM p_job_id
       OR a.time_period_id < b.time_period_id
  )
  SELECT COALESCE(jsonb_agg(row_to_json(v)::jsonb), '[]'::jsonb)
  INTO v_vehicles
  FROM vehicle_pairs v;

  -- -------------------------------------------------------------------------
  -- Equipment: seed windows from this job's segments; count all overlapping
  -- reservations for those items (capacity involves peers).
  -- -------------------------------------------------------------------------
  WITH job_item_ids AS (
    SELECT DISTINCT ri.item_id
    FROM public.reserved_items ri
    JOIN public.time_periods tp ON tp.id = ri.time_period_id
    WHERE tp.job_id = p_job_id
      AND tp.company_id = v_company_id
      AND COALESCE(tp.deleted, false) = false
      AND ri.item_id IS NOT NULL
  ),
  segments AS (
    SELECT
      ri.id,
      ri.item_id,
      ri.quantity,
      ri.forced,
      tp.job_id,
      COALESCE(ri.start_at, tp.start_at) AS eff_start,
      COALESCE(ri.end_at, tp.end_at) AS eff_end
    FROM public.reserved_items ri
    JOIN public.time_periods tp ON tp.id = ri.time_period_id
    WHERE tp.company_id = v_company_id
      AND COALESCE(tp.deleted, false) = false
      AND ri.item_id IN (SELECT jii.item_id FROM job_item_ids jii)
      AND (p_from IS NULL OR tp.end_at >= p_from)
      AND (p_to IS NULL OR tp.start_at <= p_to)
  ),
  job_seeds AS (
    SELECT s.*
    FROM segments s
    WHERE s.job_id = p_job_id
  ),
  overlap_groups AS (
    SELECT
      a.item_id,
      a.eff_start,
      a.eff_end,
      SUM(b.quantity)::integer AS total_reserved,
      BOOL_OR(b.forced) AS has_forced,
      array_agg(DISTINCT b.job_id) FILTER (WHERE b.job_id IS NOT NULL) AS job_ids
    FROM job_seeds a
    JOIN segments b
      ON a.item_id = b.item_id
      AND tstzrange(a.eff_start, a.eff_end, '[)')
        && tstzrange(b.eff_start, b.eff_end, '[)')
    GROUP BY a.item_id, a.eff_start, a.eff_end
  ),
  over_capacity AS (
    SELECT
      o.item_id,
      o.eff_start,
      o.eff_end,
      o.total_reserved,
      o.has_forced,
      o.job_ids,
      (
        SELECT array_agg(j.id ORDER BY j.id)
        FROM unnest(o.job_ids) AS jid
        JOIN public.jobs j ON j.id = jid
      ) AS sorted_job_ids,
      (
        SELECT array_agg(j.title ORDER BY j.id)
        FROM unnest(o.job_ids) AS jid
        JOIN public.jobs j ON j.id = jid
      ) AS sorted_job_titles,
      (
        SELECT string_agg(jid::text, ',' ORDER BY jid::text)
        FROM unnest(o.job_ids) AS jid
      ) AS job_ids_key
    FROM overlap_groups o
    JOIN public.items i ON i.id = o.item_id
    WHERE o.total_reserved > i.total_quantity
      AND p_job_id = ANY (o.job_ids)
  ),
  merged AS (
    SELECT
      oc.item_id,
      MIN(oc.eff_start) AS start_at,
      MAX(oc.eff_end) AS end_at,
      MAX(oc.total_reserved)::integer AS total_reserved,
      BOOL_OR(oc.has_forced) AS has_forced,
      (
        SELECT oc2.sorted_job_ids
        FROM over_capacity oc2
        WHERE oc2.item_id = oc.item_id
          AND oc2.job_ids_key = oc.job_ids_key
        ORDER BY oc2.eff_start
        LIMIT 1
      ) AS job_ids,
      (
        SELECT oc2.sorted_job_titles
        FROM over_capacity oc2
        WHERE oc2.item_id = oc.item_id
          AND oc2.job_ids_key = oc.job_ids_key
        ORDER BY oc2.eff_start
        LIMIT 1
      ) AS job_titles
    FROM over_capacity oc
    GROUP BY oc.item_id, oc.job_ids_key
  ),
  equipment_rows AS (
    SELECT
      m.item_id,
      i.name AS item_name,
      i.total_quantity AS capacity,
      m.total_reserved,
      m.start_at,
      m.end_at,
      m.job_ids,
      m.job_titles,
      m.has_forced
    FROM merged m
    JOIN public.items i ON i.id = m.item_id
  )
  SELECT COALESCE(jsonb_agg(row_to_json(e)::jsonb), '[]'::jsonb)
  INTO v_equipment
  FROM equipment_rows e;

  -- -------------------------------------------------------------------------
  -- Groups: overlapping exclusive-kit lineage involving this job's bookings
  -- -------------------------------------------------------------------------
  WITH job_grouped AS (
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
    WHERE tp.job_id = p_job_id
      AND tp.company_id = v_company_id
      AND COALESCE(tp.deleted, false) = false
      AND ri.source_kind = 'group'
      AND ri.source_group_id IS NOT NULL
      AND (p_from IS NULL OR tp.end_at >= p_from)
      AND (p_to IS NULL OR tp.start_at <= p_to)
    GROUP BY ri.source_group_id, ri.time_period_id, tp.job_id, j.title
  ),
  job_bookings AS (
    SELECT
      g.source_group_id,
      g.time_period_id,
      g.job_id,
      g.job_title,
      g.start_at,
      g.end_at,
      g.forced,
      public.group_lineage_ids(g.source_group_id) AS lineage
    FROM job_grouped g
  ),
  -- Date-bounded company group bookings (not self-joined company×company).
  -- Join only against job_bookings so sibling/ancestor lineage overlaps still match.
  peer_grouped AS (
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
    WHERE tp.company_id = v_company_id
      AND COALESCE(tp.deleted, false) = false
      AND ri.source_kind = 'group'
      AND ri.source_group_id IS NOT NULL
      AND (p_from IS NULL OR tp.end_at >= p_from)
      AND (p_to IS NULL OR tp.start_at <= p_to)
    GROUP BY ri.source_group_id, ri.time_period_id, tp.job_id, j.title
  ),
  peer_bookings AS (
    SELECT
      g.source_group_id,
      g.time_period_id,
      g.job_id,
      g.job_title,
      g.start_at,
      g.end_at,
      g.forced,
      public.group_lineage_ids(g.source_group_id) AS lineage
    FROM peer_grouped g
  ),
  group_pairs AS (
    SELECT
      CASE
        WHEN a.time_period_id < b.time_period_id THEN a.source_group_id
        ELSE b.source_group_id
      END AS group_id_1,
      CASE
        WHEN a.time_period_id < b.time_period_id THEN b.source_group_id
        ELSE a.source_group_id
      END AS group_id_2,
      (
        SELECT ig.name
        FROM public.item_groups ig
        WHERE ig.id = CASE
          WHEN a.time_period_id < b.time_period_id THEN a.source_group_id
          ELSE b.source_group_id
        END
      ) AS group_name_1,
      (
        SELECT ig.name
        FROM public.item_groups ig
        WHERE ig.id = CASE
          WHEN a.time_period_id < b.time_period_id THEN b.source_group_id
          ELSE a.source_group_id
        END
      ) AS group_name_2,
      CASE
        WHEN a.time_period_id < b.time_period_id THEN a.time_period_id
        ELSE b.time_period_id
      END AS period_id_1,
      CASE
        WHEN a.time_period_id < b.time_period_id THEN b.time_period_id
        ELSE a.time_period_id
      END AS period_id_2,
      CASE
        WHEN a.time_period_id < b.time_period_id THEN a.job_id
        ELSE b.job_id
      END AS job_id_1,
      CASE
        WHEN a.time_period_id < b.time_period_id THEN b.job_id
        ELSE a.job_id
      END AS job_id_2,
      CASE
        WHEN a.time_period_id < b.time_period_id THEN a.job_title
        ELSE b.job_title
      END AS job_title_1,
      CASE
        WHEN a.time_period_id < b.time_period_id THEN b.job_title
        ELSE a.job_title
      END AS job_title_2,
      CASE
        WHEN a.time_period_id < b.time_period_id THEN a.start_at
        ELSE b.start_at
      END AS start_1,
      CASE
        WHEN a.time_period_id < b.time_period_id THEN a.end_at
        ELSE b.end_at
      END AS end_1,
      CASE
        WHEN a.time_period_id < b.time_period_id THEN b.start_at
        ELSE a.start_at
      END AS start_2,
      CASE
        WHEN a.time_period_id < b.time_period_id THEN b.end_at
        ELSE a.end_at
      END AS end_2,
      CASE
        WHEN a.time_period_id < b.time_period_id THEN a.forced
        ELSE b.forced
      END AS forced_1,
      CASE
        WHEN a.time_period_id < b.time_period_id THEN b.forced
        ELSE a.forced
      END AS forced_2
    FROM job_bookings a
    JOIN peer_bookings b
      ON a.time_period_id IS DISTINCT FROM b.time_period_id
      AND a.lineage && b.lineage
      AND tstzrange(a.start_at, a.end_at, '[)') && tstzrange(b.start_at, b.end_at, '[)')
    WHERE b.job_id IS DISTINCT FROM p_job_id
       OR a.time_period_id < b.time_period_id
  )
  SELECT COALESCE(jsonb_agg(row_to_json(g)::jsonb), '[]'::jsonb)
  INTO v_groups
  FROM group_pairs g;

  RETURN jsonb_build_object(
    'crew', COALESCE(v_crew, '[]'::jsonb),
    'vehicles', COALESCE(v_vehicles, '[]'::jsonb),
    'equipment', COALESCE(v_equipment, '[]'::jsonb),
    'groups', COALESCE(v_groups, '[]'::jsonb)
  );
END;
$$;

COMMENT ON FUNCTION public.get_job_booking_conflicts(uuid, timestamptz, timestamptz)
  IS 'Returns crew, vehicle, equipment, and group conflicts involving the given job by scanning only entities booked on that job (optional date window)';
