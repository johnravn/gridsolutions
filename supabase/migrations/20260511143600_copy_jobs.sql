-- Copy job feature
-- - Adds copied-from markers to job_offers
-- - Adds RPC to copy a job with new dates
--   * Copies bookings (equipment/transport) and roles (crew time periods)
--   * Does NOT copy crew assignments (reserved_crew)
--   * Copies offers and all offer line items, marked as copied from source job/offer

-- 1) Offer copied-from markers
ALTER TABLE public.job_offers
  ADD COLUMN IF NOT EXISTS copied_from_job_id uuid REFERENCES public.jobs(id) ON DELETE SET NULL;

ALTER TABLE public.job_offers
  ADD COLUMN IF NOT EXISTS copied_from_offer_id uuid REFERENCES public.job_offers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_job_offers_copied_from_job_id
  ON public.job_offers(copied_from_job_id);

CREATE INDEX IF NOT EXISTS idx_job_offers_copied_from_offer_id
  ON public.job_offers(copied_from_offer_id);

-- 2) RPC: copy job with related data (except crew assignments)
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
  -- Load source job
  SELECT * INTO v_old_job
  FROM public.jobs
  WHERE id = p_job_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job not found';
  END IF;

  -- Basic validation
  IF p_start_at IS NULL OR p_end_at IS NULL THEN
    RAISE EXCEPTION 'Start and end must be set';
  END IF;
  IF p_end_at < p_start_at THEN
    RAISE EXCEPTION 'End must be after start';
  END IF;

  -- AuthZ: must be an employee/owner/super_user in the job company
  IF NOT EXISTS (
    SELECT 1
    FROM public.company_users cu
    WHERE cu.company_id = v_old_job.company_id
      AND cu.user_id = auth.uid()
      AND cu.role IN ('owner', 'employee', 'super_user')
  ) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  -- Delta used to shift time periods relative to old job start (if set)
  IF v_old_job.start_at IS NOT NULL THEN
    v_delta := p_start_at - v_old_job.start_at;
  END IF;

  -- Create new job (jobnr is assigned by server-side job numbering, so omit it)
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

  -- Map time periods old -> new
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

  -- Copy equipment bookings (reserved_items) for all copied time periods
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

  -- Copy vehicle bookings (reserved_vehicles) for all copied time periods
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

  -- Intentionally NOT copying reserved_crew: new job has roles (time_periods) but no assigned crew.

  -- Copy offers and line items
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
      equipment_subtotal,
      crew_subtotal,
      transport_subtotal,
      total_before_discount,
      total_after_discount,
      total_with_vat,
      based_on_offer_id,
      locked,
      sent_at,
      viewed_at,
      accepted_at,
      accepted_by_name,
      accepted_by_email,
      accepted_by_phone,
      rejected_at,
      rejected_by_name,
      rejected_by_phone,
      rejection_comment,
      revision_requested_at,
      revision_requested_by_name,
      revision_requested_by_phone,
      revision_comment,
      show_price_per_line,
      bookings_synced_at,
      copied_from_job_id,
      copied_from_offer_id
    )
    VALUES (
      v_new_job_id,
      v_old_offer.company_id,
      v_old_offer.offer_type,
      v_offer_version,
      'draft',
      encode(gen_random_bytes(32), 'hex'),
      v_old_offer.title,
      v_old_offer.days_of_use,
      v_old_offer.discount_percent,
      v_old_offer.vat_percent,
      v_old_offer.equipment_subtotal,
      v_old_offer.crew_subtotal,
      v_old_offer.transport_subtotal,
      v_old_offer.total_before_discount,
      v_old_offer.total_after_discount,
      v_old_offer.total_with_vat,
      NULL,
      false,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      v_old_offer.show_price_per_line,
      NULL,
      p_job_id,
      v_old_offer.id
    )
    RETURNING id INTO v_new_offer_id;

    INSERT INTO offer_map(old_id, new_id) VALUES (v_old_offer.id, v_new_offer_id);

    -- Map equipment groups old -> new for this offer
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

      INSERT INTO offer_group_map(old_id, new_id) VALUES (v_old_group.id, v_new_group_id);
    END LOOP;

    -- Copy equipment items (remap group id)
    INSERT INTO public.offer_equipment_items (
      offer_group_id,
      item_id,
      group_id,
      custom_line_description,
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
      i.quantity,
      i.unit_price,
      i.total_price,
      i.is_internal,
      i.sort_order
    FROM public.offer_equipment_items i
    JOIN offer_group_map ogm ON ogm.old_id = i.offer_group_id;

    -- Copy crew items
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

    -- Copy transport items
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

    -- Copy pretty sections (if any)
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

    -- Drop per-offer temp mapping
    DROP TABLE IF EXISTS offer_group_map;
  END LOOP;

  RETURN v_new_job_id;
END;
$$;

