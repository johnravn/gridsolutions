-- Equipment and vehicle bookings no longer have planned/confirmed/canceled.
-- If a row exists, it is booked. Canceling a job deletes those bookings so they
-- no longer occupy inventory. Crew keeps booking_status.

DELETE FROM public.reserved_items WHERE status = 'canceled';
DELETE FROM public.reserved_vehicles WHERE status = 'canceled';

CREATE OR REPLACE FUNCTION public.handle_job_status_booking_cascade()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
    AND NEW.status IN ('draft', 'planned', 'confirmed', 'canceled') THEN

    IF NEW.status = 'canceled' THEN
      DELETE FROM public.reserved_items ri
      USING public.time_periods tp
      WHERE tp.id = ri.time_period_id
        AND tp.job_id = NEW.id;

      DELETE FROM public.reserved_vehicles rv
      USING public.time_periods tp
      WHERE tp.id = rv.time_period_id
        AND tp.job_id = NEW.id;
    END IF;

    UPDATE public.reserved_crew rc
    SET status = CASE
      WHEN NEW.status = 'draft' THEN 'planned'::public.booking_status
      ELSE NEW.status::text::public.booking_status
    END
    FROM public.time_periods tp
    WHERE tp.id = rc.time_period_id
      AND tp.job_id = NEW.id;

    UPDATE public.reserved_items ri
    SET external_status = CASE
      WHEN NEW.status = 'draft' THEN 'planned'::public.external_request_status
      ELSE NEW.status::text::public.external_request_status
    END
    FROM public.time_periods tp
    WHERE tp.id = ri.time_period_id
      AND tp.job_id = NEW.id
      AND ri.external_status IS NOT NULL
      AND NEW.status <> 'canceled';

    UPDATE public.reserved_vehicles rv
    SET external_status = CASE
      WHEN NEW.status = 'draft' THEN 'planned'::public.external_request_status
      ELSE NEW.status::text::public.external_request_status
    END
    FROM public.time_periods tp
    WHERE tp.id = rv.time_period_id
      AND tp.job_id = NEW.id
      AND rv.external_status IS NOT NULL
      AND NEW.status <> 'canceled';
  END IF;

  RETURN NEW;
END;
$$;

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
  v_item_kind public.inventory_item_kind;
BEGIN
  IF NEW.forced THEN
    RETURN NEW;
  END IF;

  SELECT i.item_kind, i.total_quantity
  INTO v_item_kind, capacity
  FROM public.items i
  WHERE i.id = NEW.item_id;

  IF v_item_kind IS NULL THEN
    RAISE EXCEPTION 'Item % does not exist', NEW.item_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  IF v_item_kind = 'subrental' THEN
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

  SELECT COALESCE(SUM(ri.quantity), 0) INTO overlap_sum
  FROM public.reserved_items ri
  JOIN public.time_periods r2 ON r2.id = ri.time_period_id
  WHERE ri.item_id = NEW.item_id
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
  BEFORE INSERT OR UPDATE OF item_id, quantity, start_at, end_at, time_period_id, forced
  ON public.reserved_items
  FOR EACH ROW
  EXECUTE FUNCTION public.check_item_quantity();

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

  IF NEW.during IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.reserved_vehicles rv
    WHERE rv.vehicle_id = NEW.vehicle_id
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
  BEFORE INSERT OR UPDATE OF vehicle_id, time_period_id, start_at, end_at, forced
  ON public.reserved_vehicles
  FOR EACH ROW
  EXECUTE FUNCTION public.check_no_overlapping_vehicle_booking();

COMMENT ON FUNCTION public.check_no_overlapping_vehicle_booking()
  IS 'Prevent overlapping vehicle bookings unless forced=true';

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
      COALESCE(ri.start_at, tp.start_at) AS eff_start,
      COALESCE(ri.end_at, tp.end_at) AS eff_end
    FROM public.reserved_items ri
    JOIN public.time_periods tp ON tp.id = ri.time_period_id
    WHERE tp.company_id = p_company_id
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

CREATE OR REPLACE FUNCTION public.job_copy(
  p_job_id uuid,
  p_start_at timestamptz,
  p_end_at timestamptz
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_old_job public.jobs%ROWTYPE;
  v_new_job_id uuid;
  v_delta interval := interval '0';

  v_old_tp RECORD;
  v_new_tp_id uuid;

  v_old_basis RECORD;
  v_new_basis_id uuid;

  v_old_offer RECORD;
  v_new_offer_id uuid;
  v_offer_version int := 0;

  v_old_group RECORD;
  v_new_group_id uuid;

  v_old_transport_group RECORD;
  v_new_transport_group_id uuid;
BEGIN
  SELECT * INTO v_old_job
  FROM public.jobs
  WHERE id = p_job_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job not found';
  END IF;

  IF public.demo_company_blocks_mutation(v_old_job.company_id) THEN
    RAISE EXCEPTION 'Demo company is read-only';
  END IF;

  IF p_start_at IS NULL OR p_end_at IS NULL THEN
    RAISE EXCEPTION 'Start and end must be set';
  END IF;
  IF p_end_at < p_start_at THEN
    RAISE EXCEPTION 'End must be after start';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.company_users cu
    WHERE cu.company_id = v_old_job.company_id
      AND cu.user_id = auth.uid()
      AND cu.role IN ('owner', 'employee', 'super_user')
  ) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  IF v_old_job.start_at IS NOT NULL THEN
    v_delta := p_start_at - v_old_job.start_at;
  END IF;

  INSERT INTO public.jobs (
    company_id,
    title,
    description,
    status,
    start_at,
    end_at,
    customer_id,
    customer_user_id,
    customer_contact_id,
    project_lead_user_id,
    job_address_id,
    invoice_basis,
    archived
  )
  VALUES (
    v_old_job.company_id,
    v_old_job.title,
    v_old_job.description,
    'planned',
    p_start_at,
    p_end_at,
    v_old_job.customer_id,
    v_old_job.customer_user_id,
    v_old_job.customer_contact_id,
    v_old_job.project_lead_user_id,
    v_old_job.job_address_id,
    v_old_job.invoice_basis,
    false
  )
  RETURNING id INTO v_new_job_id;

  CREATE TEMP TABLE tp_map (
    old_id uuid PRIMARY KEY,
    new_id uuid NOT NULL
  ) ON COMMIT DROP;

  FOR v_old_tp IN
    SELECT *
    FROM public.time_periods
    WHERE job_id = p_job_id
      AND deleted = false
    ORDER BY start_at ASC
  LOOP
    INSERT INTO public.time_periods (
      job_id,
      company_id,
      title,
      start_at,
      end_at,
      category,
      program_group,
      needed_count,
      role_category,
      notes,
      reserved_by_user_id,
      deleted
    )
    VALUES (
      v_new_job_id,
      v_old_tp.company_id,
      v_old_tp.title,
      (v_old_tp.start_at + v_delta),
      (v_old_tp.end_at + v_delta),
      v_old_tp.category,
      v_old_tp.program_group,
      v_old_tp.needed_count,
      v_old_tp.role_category,
      v_old_tp.notes,
      NULL,
      false
    )
    RETURNING id INTO v_new_tp_id;

    INSERT INTO tp_map(old_id, new_id) VALUES (v_old_tp.id, v_new_tp_id);
  END LOOP;

  INSERT INTO public.reserved_items (
    time_period_id,
    item_id,
    quantity,
    external_status,
    external_note,
    forced,
    start_at,
    end_at,
    source_kind,
    source_group_id
  )
  SELECT
    m.new_id,
    ri.item_id,
    ri.quantity,
    ri.external_status,
    ri.external_note,
    ri.forced,
    ri.start_at,
    ri.end_at,
    ri.source_kind,
    ri.source_group_id
  FROM public.reserved_items ri
  JOIN tp_map m ON m.old_id = ri.time_period_id;

  INSERT INTO public.reserved_vehicles (
    time_period_id,
    vehicle_id,
    external_status,
    external_note,
    start_at,
    end_at
  )
  SELECT
    m.new_id,
    rv.vehicle_id,
    rv.external_status,
    rv.external_note,
    rv.start_at,
    rv.end_at
  FROM public.reserved_vehicles rv
  JOIN tp_map m ON m.old_id = rv.time_period_id;

  CREATE TEMP TABLE basis_map (
    old_id uuid PRIMARY KEY,
    new_id uuid NOT NULL
  ) ON COMMIT DROP;

  FOR v_old_basis IN
    SELECT *
    FROM public.offer_bases
    WHERE job_id = p_job_id
    ORDER BY created_at ASC
  LOOP
    INSERT INTO public.offer_bases (
      job_id,
      company_id,
      title,
      bookings_synced_at,
      days_of_use,
      discount_percent,
      vat_percent
    )
    VALUES (
      v_new_job_id,
      v_old_basis.company_id,
      v_old_basis.title,
      NULL,
      v_old_basis.days_of_use,
      v_old_basis.discount_percent,
      v_old_basis.vat_percent
    )
    RETURNING id INTO v_new_basis_id;

    INSERT INTO basis_map(old_id, new_id)
    VALUES (v_old_basis.id, v_new_basis_id);

    CREATE TEMP TABLE offer_group_map (
      old_id uuid PRIMARY KEY,
      new_id uuid NOT NULL
    ) ON COMMIT DROP;

    FOR v_old_group IN
      SELECT *
      FROM public.offer_equipment_groups
      WHERE offer_basis_id = v_old_basis.id
      ORDER BY sort_order ASC
    LOOP
      INSERT INTO public.offer_equipment_groups (
        offer_basis_id,
        group_name,
        sort_order
      )
      VALUES (
        v_new_basis_id,
        v_old_group.group_name,
        v_old_group.sort_order
      )
      RETURNING id INTO v_new_group_id;

      INSERT INTO offer_group_map(old_id, new_id)
      VALUES (v_old_group.id, v_new_group_id);
    END LOOP;

    INSERT INTO public.offer_equipment_items (
      offer_group_id,
      item_id,
      group_id,
      custom_line_description,
      custom_line_brand,
      custom_line_model,
      quantity,
      unit_price,
      total_price,
      is_internal,
      sort_order
    )
    SELECT
      ogm.new_id,
      i.item_id,
      i.group_id,
      i.custom_line_description,
      i.custom_line_brand,
      i.custom_line_model,
      i.quantity,
      i.unit_price,
      i.total_price,
      i.is_internal,
      i.sort_order
    FROM public.offer_equipment_items i
    JOIN offer_group_map ogm ON ogm.old_id = i.offer_group_id;

    INSERT INTO public.offer_crew_items (
      offer_basis_id,
      role_title,
      role_category,
      crew_count,
      start_date,
      end_date,
      daily_rate,
      hourly_rate,
      hours_per_day,
      billing_type,
      total_price,
      sort_order
    )
    SELECT
      v_new_basis_id,
      ci.role_title,
      ci.role_category,
      ci.crew_count,
      ci.start_date,
      ci.end_date,
      ci.daily_rate,
      ci.hourly_rate,
      ci.hours_per_day,
      ci.billing_type,
      ci.total_price,
      ci.sort_order
    FROM public.offer_crew_items ci
    WHERE ci.offer_basis_id = v_old_basis.id;

    CREATE TEMP TABLE transport_group_map (
      old_id uuid PRIMARY KEY,
      new_id uuid NOT NULL
    ) ON COMMIT DROP;

    FOR v_old_transport_group IN
      SELECT *
      FROM public.offer_transport_groups
      WHERE offer_basis_id = v_old_basis.id
      ORDER BY sort_order ASC
    LOOP
      INSERT INTO public.offer_transport_groups (
        offer_basis_id,
        group_name,
        sort_order
      )
      VALUES (
        v_new_basis_id,
        v_old_transport_group.group_name,
        v_old_transport_group.sort_order
      )
      RETURNING id INTO v_new_transport_group_id;

      INSERT INTO transport_group_map(old_id, new_id)
      VALUES (v_old_transport_group.id, v_new_transport_group_id);
    END LOOP;

    INSERT INTO public.offer_transport_items (
      offer_basis_id,
      transport_group_id,
      vehicle_name,
      vehicle_id,
      vehicle_category,
      distance_km,
      distance_rate,
      start_date,
      end_date,
      days_used,
      daily_rate_count,
      daily_rate,
      total_price,
      is_internal,
      sort_order
    )
    SELECT
      v_new_basis_id,
      tgm.new_id,
      ti.vehicle_name,
      ti.vehicle_id,
      ti.vehicle_category,
      ti.distance_km,
      ti.distance_rate,
      ti.start_date,
      ti.end_date,
      ti.days_used,
      ti.daily_rate_count,
      ti.daily_rate,
      ti.total_price,
      ti.is_internal,
      ti.sort_order
    FROM public.offer_transport_items ti
    JOIN transport_group_map tgm ON tgm.old_id = ti.transport_group_id;

    DROP TABLE IF EXISTS transport_group_map;
    DROP TABLE IF EXISTS offer_group_map;
  END LOOP;

  CREATE TEMP TABLE offer_map (
    old_id uuid PRIMARY KEY,
    new_id uuid NOT NULL
  ) ON COMMIT DROP;

  FOR v_old_offer IN
    SELECT *
    FROM public.job_offers
    WHERE job_id = p_job_id
    ORDER BY created_at ASC
  LOOP
    v_offer_version := v_offer_version + 1;

    INSERT INTO public.job_offers (
      job_id,
      company_id,
      offer_basis_id,
      offer_type,
      version_number,
      status,
      access_token,
      title,
      days_of_use,
      discount_percent,
      vat_percent,
      show_price_per_line,
      equipment_subtotal,
      crew_subtotal,
      transport_subtotal,
      total_before_discount,
      total_after_discount,
      total_with_vat,
      bookings_synced_at,
      locked,
      based_on_offer_id,
      copied_from_job_id,
      copied_from_offer_id,
      pretty_intro_text,
      pretty_use_customer_accent,
      pretty_use_customer_background
    )
    VALUES (
      v_new_job_id,
      v_old_offer.company_id,
      (SELECT bm.new_id FROM basis_map bm WHERE bm.old_id = v_old_offer.offer_basis_id),
      v_old_offer.offer_type,
      v_offer_version,
      'draft',
      md5(random()::text || clock_timestamp()::text || v_old_offer.id::text),
      v_old_offer.title,
      v_old_offer.days_of_use,
      v_old_offer.discount_percent,
      v_old_offer.vat_percent,
      v_old_offer.show_price_per_line,
      v_old_offer.equipment_subtotal,
      v_old_offer.crew_subtotal,
      v_old_offer.transport_subtotal,
      v_old_offer.total_before_discount,
      v_old_offer.total_after_discount,
      v_old_offer.total_with_vat,
      NULL,
      false,
      NULL,
      p_job_id,
      v_old_offer.id,
      v_old_offer.pretty_intro_text,
      v_old_offer.pretty_use_customer_accent,
      v_old_offer.pretty_use_customer_background
    )
    RETURNING id INTO v_new_offer_id;

    INSERT INTO offer_map(old_id, new_id) VALUES (v_old_offer.id, v_new_offer_id);

    INSERT INTO public.offer_pretty_sections (
      offer_id,
      section_type,
      title,
      content,
      image_url,
      sort_order
    )
    SELECT
      v_new_offer_id,
      ps.section_type,
      ps.title,
      ps.content,
      ps.image_url,
      ps.sort_order
    FROM public.offer_pretty_sections ps
    WHERE ps.offer_id = v_old_offer.id;
  END LOOP;

  UPDATE public.job_offers new_offer
  SET source_technical_offer_id = tech_map.new_id
  FROM offer_map new_map
  JOIN public.job_offers old_offer ON old_offer.id = new_map.old_id
  JOIN offer_map tech_map ON tech_map.old_id = old_offer.source_technical_offer_id
  WHERE new_offer.id = new_map.new_id
    AND old_offer.source_technical_offer_id IS NOT NULL;

  RETURN v_new_job_id;
END;
$$;


ALTER TABLE public.reserved_items DROP COLUMN IF EXISTS status;
ALTER TABLE public.reserved_vehicles DROP COLUMN IF EXISTS status;

COMMENT ON TYPE public.booking_status IS 'Crew booking status: planned, confirmed, or canceled';
