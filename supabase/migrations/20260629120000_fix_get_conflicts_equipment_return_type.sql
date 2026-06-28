-- Fix get_conflicts_equipment: array_agg(uuid[])[1] returned uuid, not uuid[].

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
      COALESCE(ri.start_at, tp.start_at) AS eff_start,
      COALESCE(ri.end_at, tp.end_at) AS eff_end
    FROM public.reserved_items ri
    JOIN public.time_periods tp ON tp.id = ri.time_period_id
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
      array_agg(DISTINCT b.job_id) FILTER (WHERE b.job_id IS NOT NULL) AS job_ids
    FROM segments a
    JOIN segments b
      ON a.item_id = b.item_id
      AND tstzrange(a.eff_start, a.eff_end, '[)') && tstzrange(b.eff_start, b.eff_end, '[)')
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
  )
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
  ORDER BY m.start_at, m.item_id;
END;
$$;

COMMENT ON FUNCTION public.get_conflicts_equipment(uuid, timestamptz, timestamptz)
  IS 'Returns equipment capacity overruns in the company within the optional date range (deduplicated per item and job set)';
