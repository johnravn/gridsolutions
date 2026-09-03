-- Link offer basis lines to job time_periods so equipment/crew/transport
-- windows are shared between bookings and offers (#79).

-- ---------------------------------------------------------------------------
-- 1. Columns + FKs (RESTRICT so deletes must reassign offer lines first)
-- ---------------------------------------------------------------------------

ALTER TABLE public.offer_equipment_items
  ADD COLUMN IF NOT EXISTS time_period_id uuid;

ALTER TABLE public.offer_crew_items
  ADD COLUMN IF NOT EXISTS time_period_id uuid;

ALTER TABLE public.offer_transport_items
  ADD COLUMN IF NOT EXISTS time_period_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'offer_equipment_items_time_period_id_fkey'
  ) THEN
    ALTER TABLE public.offer_equipment_items
      ADD CONSTRAINT offer_equipment_items_time_period_id_fkey
      FOREIGN KEY (time_period_id)
      REFERENCES public.time_periods(id)
      ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'offer_crew_items_time_period_id_fkey'
  ) THEN
    ALTER TABLE public.offer_crew_items
      ADD CONSTRAINT offer_crew_items_time_period_id_fkey
      FOREIGN KEY (time_period_id)
      REFERENCES public.time_periods(id)
      ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'offer_transport_items_time_period_id_fkey'
  ) THEN
    ALTER TABLE public.offer_transport_items
      ADD CONSTRAINT offer_transport_items_time_period_id_fkey
      FOREIGN KEY (time_period_id)
      REFERENCES public.time_periods(id)
      ON DELETE RESTRICT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_offer_equipment_items_time_period_id
  ON public.offer_equipment_items(time_period_id);

CREATE INDEX IF NOT EXISTS idx_offer_crew_items_time_period_id
  ON public.offer_crew_items(time_period_id);

CREATE INDEX IF NOT EXISTS idx_offer_transport_items_time_period_id
  ON public.offer_transport_items(time_period_id);

COMMENT ON COLUMN public.offer_equipment_items.time_period_id IS
  'Job equipment time period this offer line is booked against.';
COMMENT ON COLUMN public.offer_crew_items.time_period_id IS
  'Job crew time period (role) this offer line is tied to.';
COMMENT ON COLUMN public.offer_transport_items.time_period_id IS
  'Job transport time period this offer line is tied to.';

-- ---------------------------------------------------------------------------
-- 2. Backfill equipment → job "Equipment period" when present
-- ---------------------------------------------------------------------------

UPDATE public.offer_equipment_items oei
SET time_period_id = ep.id
FROM public.offer_equipment_groups oeg
JOIN public.offer_bases ob ON ob.id = oeg.offer_basis_id
JOIN LATERAL (
  SELECT tp.id
  FROM public.time_periods tp
  WHERE tp.job_id = ob.job_id
    AND tp.deleted = false
    AND tp.category = 'equipment'
    AND tp.title = 'Equipment period'
  ORDER BY tp.start_at ASC
  LIMIT 1
) ep ON true
WHERE oei.offer_group_id = oeg.id
  AND oei.time_period_id IS NULL;

-- Prefer any single equipment period on the job if the canonical title is missing
UPDATE public.offer_equipment_items oei
SET time_period_id = ep.id
FROM public.offer_equipment_groups oeg
JOIN public.offer_bases ob ON ob.id = oeg.offer_basis_id
JOIN LATERAL (
  SELECT tp.id
  FROM public.time_periods tp
  WHERE tp.job_id = ob.job_id
    AND tp.deleted = false
    AND tp.category = 'equipment'
  ORDER BY
    CASE WHEN tp.title = 'Equipment period' THEN 0 ELSE 1 END,
    tp.start_at ASC
  LIMIT 1
) ep ON true
WHERE oei.offer_group_id = oeg.id
  AND oei.time_period_id IS NULL;

-- ---------------------------------------------------------------------------
-- 3. Backfill crew: match existing period by title+dates, else create one
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  r RECORD;
  v_tp_id uuid;
BEGIN
  FOR r IN
    SELECT
      oci.id AS line_id,
      oci.role_title,
      oci.role_category,
      oci.crew_count,
      oci.start_date,
      oci.end_date,
      ob.job_id,
      ob.company_id
    FROM public.offer_crew_items oci
    JOIN public.offer_bases ob ON ob.id = oci.offer_basis_id
    WHERE oci.time_period_id IS NULL
  LOOP
    SELECT tp.id
    INTO v_tp_id
    FROM public.time_periods tp
    WHERE tp.job_id = r.job_id
      AND tp.deleted = false
      AND tp.category = 'crew'
      AND tp.title IS NOT DISTINCT FROM r.role_title
      AND tp.start_at = r.start_date
      AND tp.end_at = r.end_date
    ORDER BY tp.created_at ASC
    LIMIT 1;

    IF v_tp_id IS NULL THEN
      SELECT tp.id
      INTO v_tp_id
      FROM public.time_periods tp
      WHERE tp.job_id = r.job_id
        AND tp.deleted = false
        AND tp.category = 'crew'
        AND tp.title IS NOT DISTINCT FROM r.role_title
        AND tp.start_at < r.end_date
        AND tp.end_at > r.start_date
      ORDER BY tp.start_at ASC
      LIMIT 1;
    END IF;

    IF v_tp_id IS NULL THEN
      INSERT INTO public.time_periods (
        job_id,
        company_id,
        title,
        start_at,
        end_at,
        category,
        needed_count,
        role_category,
        deleted
      )
      VALUES (
        r.job_id,
        r.company_id,
        r.role_title,
        r.start_date,
        r.end_date,
        'crew',
        GREATEST(r.crew_count, 1),
        r.role_category,
        false
      )
      RETURNING id INTO v_tp_id;
    END IF;

    UPDATE public.offer_crew_items
    SET time_period_id = v_tp_id
    WHERE id = r.line_id;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 4. Backfill transport: match by dates, else create period from line
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  r RECORD;
  v_tp_id uuid;
  v_title text;
BEGIN
  FOR r IN
    SELECT
      oti.id AS line_id,
      oti.vehicle_name,
      oti.start_date,
      oti.end_date,
      ob.job_id,
      ob.company_id
    FROM public.offer_transport_items oti
    JOIN public.offer_bases ob ON ob.id = oti.offer_basis_id
    WHERE oti.time_period_id IS NULL
  LOOP
    SELECT tp.id
    INTO v_tp_id
    FROM public.time_periods tp
    WHERE tp.job_id = r.job_id
      AND tp.deleted = false
      AND tp.category = 'transport'
      AND tp.start_at = r.start_date
      AND tp.end_at = r.end_date
    ORDER BY tp.created_at ASC
    LIMIT 1;

    IF v_tp_id IS NULL THEN
      SELECT tp.id
      INTO v_tp_id
      FROM public.time_periods tp
      WHERE tp.job_id = r.job_id
        AND tp.deleted = false
        AND tp.category = 'transport'
        AND tp.start_at < r.end_date
        AND tp.end_at > r.start_date
      ORDER BY tp.start_at ASC
      LIMIT 1;
    END IF;

    IF v_tp_id IS NULL THEN
      v_title := 'Transport - ' || COALESCE(NULLIF(btrim(r.vehicle_name), ''), 'Vehicle')
        || ' (' || to_char(r.start_date AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') || ')';

      INSERT INTO public.time_periods (
        job_id,
        company_id,
        title,
        start_at,
        end_at,
        category,
        deleted
      )
      VALUES (
        r.job_id,
        r.company_id,
        v_title,
        r.start_date,
        r.end_date,
        'transport',
        false
      )
      RETURNING id INTO v_tp_id;
    END IF;

    UPDATE public.offer_transport_items
    SET time_period_id = v_tp_id
    WHERE id = r.line_id;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 5. Update job_copy to remap offer line time_period_id via tp_map
-- ---------------------------------------------------------------------------

-- Copy job from a new start time only. Job end and every booking keep their
-- original duration/offset from the source start.

DROP FUNCTION IF EXISTS public.job_copy(uuid, timestamptz, timestamptz, text);
DROP FUNCTION IF EXISTS public.job_copy(uuid, timestamptz, timestamptz);
DROP FUNCTION IF EXISTS public.job_copy(uuid, timestamptz, text);

CREATE OR REPLACE FUNCTION public.job_copy(
  p_job_id uuid,
  p_start_at timestamptz,
  p_title text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_old_job public.jobs%ROWTYPE;
  v_new_job_id uuid;
  v_delta interval := interval '0';
  v_kinds text[] := '{}';
  v_conflicts jsonb;
  v_anchor timestamptz;

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

  v_old_ri RECORD;
  v_old_rv RECORD;
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

  IF p_start_at IS NULL THEN
    RAISE EXCEPTION 'Start must be set';
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

  v_anchor := COALESCE(
    v_old_job.start_at,
    (
      SELECT MIN(tp.start_at)
      FROM public.time_periods tp
      WHERE tp.job_id = p_job_id
        AND tp.deleted = false
    )
  );
  IF v_anchor IS NOT NULL THEN
    v_delta := p_start_at - v_anchor;
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
    COALESCE(NULLIF(btrim(p_title), ''), v_old_job.title),
    v_old_job.description,
    'planned',
    p_start_at,
    CASE
      WHEN v_old_job.end_at IS NULL THEN NULL
      ELSE v_old_job.end_at + v_delta
    END,
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

  -- Copy bookings even when they overlap existing ones. Overlaps are stored as
  -- forced so the new job is created; the app toasts the conflict types.
  FOR v_old_ri IN
    SELECT ri.*, m.new_id AS new_time_period_id
    FROM public.reserved_items ri
    JOIN tp_map m ON m.old_id = ri.time_period_id
  LOOP
    BEGIN
      INSERT INTO public.reserved_items (
        time_period_id,
        item_id,
        quantity,
        external_status,
        external_note,
        forced,
        forced_at,
        forced_by_user_id,
        start_at,
        end_at,
        source_kind,
        source_group_id
      )
      VALUES (
        v_old_ri.new_time_period_id,
        v_old_ri.item_id,
        v_old_ri.quantity,
        v_old_ri.external_status,
        v_old_ri.external_note,
        v_old_ri.forced,
        v_old_ri.forced_at,
        v_old_ri.forced_by_user_id,
        v_old_ri.start_at + v_delta,
        v_old_ri.end_at + v_delta,
        v_old_ri.source_kind,
        v_old_ri.source_group_id
      );
    EXCEPTION
      WHEN check_violation OR exclusion_violation THEN
        IF v_old_ri.source_group_id IS NOT NULL THEN
          IF NOT ('groups' = ANY (v_kinds)) THEN
            v_kinds := array_append(v_kinds, 'groups');
          END IF;
        ELSIF NOT ('equipment' = ANY (v_kinds)) THEN
          v_kinds := array_append(v_kinds, 'equipment');
        END IF;
        INSERT INTO public.reserved_items (
          time_period_id,
          item_id,
          quantity,
          external_status,
          external_note,
          forced,
          forced_at,
          forced_by_user_id,
          start_at,
          end_at,
          source_kind,
          source_group_id
        )
        VALUES (
          v_old_ri.new_time_period_id,
          v_old_ri.item_id,
          v_old_ri.quantity,
          v_old_ri.external_status,
          v_old_ri.external_note,
          true,
          now(),
          auth.uid(),
          v_old_ri.start_at + v_delta,
          v_old_ri.end_at + v_delta,
          v_old_ri.source_kind,
          v_old_ri.source_group_id
        );
    END;
  END LOOP;

  FOR v_old_rv IN
    SELECT rv.*, m.new_id AS new_time_period_id
    FROM public.reserved_vehicles rv
    JOIN tp_map m ON m.old_id = rv.time_period_id
  LOOP
    BEGIN
      INSERT INTO public.reserved_vehicles (
        time_period_id,
        vehicle_id,
        external_status,
        external_note,
        start_at,
        end_at,
        forced,
        forced_at,
        forced_by_user_id
      )
      VALUES (
        v_old_rv.new_time_period_id,
        v_old_rv.vehicle_id,
        v_old_rv.external_status,
        v_old_rv.external_note,
        v_old_rv.start_at + v_delta,
        v_old_rv.end_at + v_delta,
        v_old_rv.forced,
        v_old_rv.forced_at,
        v_old_rv.forced_by_user_id
      );
    EXCEPTION
      WHEN check_violation OR exclusion_violation THEN
        IF NOT ('vehicles' = ANY (v_kinds)) THEN
          v_kinds := array_append(v_kinds, 'vehicles');
        END IF;
        INSERT INTO public.reserved_vehicles (
          time_period_id,
          vehicle_id,
          external_status,
          external_note,
          start_at,
          end_at,
          forced,
          forced_at,
          forced_by_user_id
        )
        VALUES (
          v_old_rv.new_time_period_id,
          v_old_rv.vehicle_id,
          v_old_rv.external_status,
          v_old_rv.external_note,
          v_old_rv.start_at + v_delta,
          v_old_rv.end_at + v_delta,
          true,
          now(),
          auth.uid()
        );
    END;
  END LOOP;

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
      sort_order,
      time_period_id
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
      i.sort_order,
      CASE
        WHEN i.time_period_id IS NULL THEN NULL
        ELSE (SELECT m.new_id FROM tp_map m WHERE m.old_id = i.time_period_id)
      END
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
      sort_order,
      time_period_id
    )
    SELECT
      v_new_basis_id,
      ci.role_title,
      ci.role_category,
      ci.crew_count,
      ci.start_date + v_delta,
      ci.end_date + v_delta,
      ci.daily_rate,
      ci.hourly_rate,
      ci.hours_per_day,
      ci.billing_type,
      ci.total_price,
      ci.sort_order,
      CASE
        WHEN ci.time_period_id IS NULL THEN NULL
        ELSE (SELECT m.new_id FROM tp_map m WHERE m.old_id = ci.time_period_id)
      END
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
      sort_order,
      time_period_id
    )
    SELECT
      v_new_basis_id,
      tgm.new_id,
      ti.vehicle_name,
      ti.vehicle_id,
      ti.vehicle_category,
      ti.distance_km,
      ti.distance_rate,
      ti.start_date + v_delta,
      ti.end_date + v_delta,
      ti.days_used,
      ti.daily_rate_count,
      ti.daily_rate,
      ti.total_price,
      ti.is_internal,
      ti.sort_order,
      CASE
        WHEN ti.time_period_id IS NULL THEN NULL
        ELSE (SELECT m.new_id FROM tp_map m WHERE m.old_id = ti.time_period_id)
      END
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

  SELECT public.get_job_booking_conflicts(v_new_job_id, NULL, NULL)
    INTO v_conflicts;

  IF COALESCE(jsonb_array_length(v_conflicts -> 'crew'), 0) > 0
     AND NOT ('crew' = ANY (v_kinds)) THEN
    v_kinds := array_append(v_kinds, 'crew');
  END IF;
  IF COALESCE(jsonb_array_length(v_conflicts -> 'equipment'), 0) > 0
     AND NOT ('equipment' = ANY (v_kinds)) THEN
    v_kinds := array_append(v_kinds, 'equipment');
  END IF;
  IF COALESCE(jsonb_array_length(v_conflicts -> 'groups'), 0) > 0
     AND NOT ('groups' = ANY (v_kinds)) THEN
    v_kinds := array_append(v_kinds, 'groups');
  END IF;
  IF COALESCE(jsonb_array_length(v_conflicts -> 'vehicles'), 0) > 0
     AND NOT ('vehicles' = ANY (v_kinds)) THEN
    v_kinds := array_append(v_kinds, 'vehicles');
  END IF;

  RETURN jsonb_build_object(
    'job_id', v_new_job_id,
    'conflicts', to_jsonb(v_kinds)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.job_copy(uuid, timestamptz, text)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.job_copy(uuid, timestamptz, text)
  IS 'Copies a job from a new start time, preserving original durations, and returns { job_id, conflicts }';
