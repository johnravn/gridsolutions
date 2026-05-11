-- Brand and model text for custom (non-inventory) equipment lines on offers.
ALTER TABLE public.offer_equipment_items
  ADD COLUMN IF NOT EXISTS custom_line_brand TEXT,
  ADD COLUMN IF NOT EXISTS custom_line_model TEXT;

COMMENT ON COLUMN public.offer_equipment_items.custom_line_brand IS
  'Free-text brand for custom/one-off lines when item_id and group_id are null.';
COMMENT ON COLUMN public.offer_equipment_items.custom_line_model IS
  'Free-text model for custom/one-off lines when item_id and group_id are null.';

-- Keep job_copy() in sync so copied jobs preserve custom line brand/model.
DROP FUNCTION IF EXISTS public.job_copy(uuid, timestamptz, timestamptz);
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

  v_old_offer RECORD;
  v_new_offer_id uuid;
  v_offer_version int := 0;

  v_old_group RECORD;
  v_new_group_id uuid;
BEGIN
  SELECT * INTO v_old_job
  FROM public.jobs
  WHERE id = p_job_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job not found';
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
    status,
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
    ri.status,
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
    status,
    external_status,
    external_note,
    start_at,
    end_at
  )
  SELECT
    m.new_id,
    rv.vehicle_id,
    rv.status,
    rv.external_status,
    rv.external_note,
    rv.start_at,
    rv.end_at
  FROM public.reserved_vehicles rv
  JOIN tp_map m ON m.old_id = rv.time_period_id;

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
      copied_from_offer_id
    )
    VALUES (
      v_new_job_id,
      v_old_offer.company_id,
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
      v_old_offer.id
    )
    RETURNING id INTO v_new_offer_id;

    INSERT INTO offer_map(old_id, new_id) VALUES (v_old_offer.id, v_new_offer_id);

    CREATE TEMP TABLE offer_group_map (
      old_id uuid PRIMARY KEY,
      new_id uuid NOT NULL
    ) ON COMMIT DROP;

    FOR v_old_group IN
      SELECT *
      FROM public.offer_equipment_groups
      WHERE offer_id = v_old_offer.id
      ORDER BY sort_order ASC
    LOOP
      INSERT INTO public.offer_equipment_groups (
        offer_id,
        group_name,
        sort_order
      )
      VALUES (
        v_new_offer_id,
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
      offer_id,
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
      v_new_offer_id,
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
    WHERE ci.offer_id = v_old_offer.id;

    INSERT INTO public.offer_transport_items (
      offer_id,
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
      v_new_offer_id,
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
    WHERE ti.offer_id = v_old_offer.id;

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

    DROP TABLE IF EXISTS offer_group_map;
  END LOOP;

  RETURN v_new_job_id;
END;
$$;
