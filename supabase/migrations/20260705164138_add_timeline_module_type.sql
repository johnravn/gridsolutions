-- Program timeline as a dedicated pretty offer module type (not a content block).

DO $$ BEGIN
  CREATE TYPE public.pretty_module_type AS ENUM ('standard', 'timeline');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE public.pretty_offer_modules
  ADD COLUMN IF NOT EXISTS module_type public.pretty_module_type NOT NULL DEFAULT 'standard';

CREATE TABLE IF NOT EXISTS public.pretty_offer_module_timeline_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID NOT NULL REFERENCES public.pretty_offer_modules(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  label TEXT NOT NULL DEFAULT '',
  summary TEXT,
  detail TEXT,
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_pretty_offer_module_timeline_items_module_id
  ON public.pretty_offer_module_timeline_items(module_id);

ALTER TABLE public.pretty_offer_module_timeline_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Company members can manage pretty offer module timeline items"
  ON public.pretty_offer_module_timeline_items;
CREATE POLICY "Company members can manage pretty offer module timeline items"
ON public.pretty_offer_module_timeline_items
FOR ALL
USING (
  module_id IN (
    SELECT mod.id FROM public.pretty_offer_modules mod
    JOIN public.job_offers o ON mod.offer_id = o.id
    JOIN public.company_users cu ON o.company_id = cu.company_id
    WHERE cu.user_id = auth.uid()
  )
)
WITH CHECK (
  module_id IN (
    SELECT mod.id FROM public.pretty_offer_modules mod
    JOIN public.job_offers o ON mod.offer_id = o.id
    JOIN public.company_users cu ON o.company_id = cu.company_id
    WHERE cu.user_id = auth.uid()
  )
);

-- Migrate existing timeline blocks into timeline modules.
INSERT INTO public.pretty_offer_module_timeline_items (
  module_id,
  sort_order,
  label,
  summary,
  detail,
  start_at,
  end_at
)
SELECT
  pob.module_id,
  bi.sort_order,
  bi.label,
  bi.summary,
  bi.detail,
  bi.start_at,
  bi.end_at
FROM public.pretty_offer_module_blocks pob
JOIN public.pretty_offer_module_block_items bi ON bi.block_id = pob.id
WHERE pob.block_type = 'timeline'
ON CONFLICT DO NOTHING;

UPDATE public.pretty_offer_modules pom
SET module_type = 'timeline'
WHERE EXISTS (
  SELECT 1
  FROM public.pretty_offer_module_blocks pob
  WHERE pob.module_id = pom.id
    AND pob.block_type = 'timeline'
);

DELETE FROM public.pretty_offer_module_blocks
WHERE block_type = 'timeline';

-- Demo company restrictive policies for timeline items.
DROP POLICY IF EXISTS demo_company_no_insert ON public.pretty_offer_module_timeline_items;
CREATE POLICY demo_company_no_insert ON public.pretty_offer_module_timeline_items
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (NOT public.demo_company_blocks_module_mutation(module_id));

DROP POLICY IF EXISTS demo_company_no_update ON public.pretty_offer_module_timeline_items;
CREATE POLICY demo_company_no_update ON public.pretty_offer_module_timeline_items
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (NOT public.demo_company_blocks_module_mutation(module_id))
  WITH CHECK (NOT public.demo_company_blocks_module_mutation(module_id));

DROP POLICY IF EXISTS demo_company_no_delete ON public.pretty_offer_module_timeline_items;
CREATE POLICY demo_company_no_delete ON public.pretty_offer_module_timeline_items
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (NOT public.demo_company_blocks_module_mutation(module_id));

-- Extend demo timeline advance to shift module-level timeline snapshots.
CREATE OR REPLACE FUNCTION public.advance_demo_company_timeline(
  p_interval interval DEFAULT interval '7 days'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_started_at timestamptz := now();
  v_trigger text;
  v_demo_company_ids uuid[];
  v_jobs_updated integer := 0;
  v_time_periods_updated integer := 0;
  v_reserved_items_updated integer := 0;
  v_reserved_vehicles_updated integer := 0;
  v_offer_crew_updated integer := 0;
  v_offer_transport_updated integer := 0;
  v_offer_block_items_updated integer := 0;
  v_offer_timeline_items_updated integer := 0;
  v_time_entries_updated integer := 0;
  v_details jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    v_trigger := 'pg_cron';
  ELSIF public.is_superuser(auth.uid()) THEN
    v_trigger := 'superuser_manual';
  ELSE
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT array_agg(c.id ORDER BY c.created_at)
  INTO v_demo_company_ids
  FROM public.companies c
  WHERE c.is_demo = true;

  IF v_demo_company_ids IS NULL OR cardinality(v_demo_company_ids) = 0 THEN
    v_details := jsonb_build_object(
      'intervalDays', EXTRACT(epoch FROM p_interval) / 86400,
      'jobsUpdated', 0,
      'timePeriodsUpdated', 0,
      'reservedItemsUpdated', 0,
      'reservedVehiclesUpdated', 0,
      'offerCrewItemsUpdated', 0,
      'offerTransportItemsUpdated', 0,
      'offerBlockItemsUpdated', 0,
      'offerTimelineItemsUpdated', 0,
      'timeEntriesUpdated', 0,
      'message', 'No demo companies configured'
    );

    INSERT INTO public.scheduled_job_runs (
      job_key,
      started_at,
      finished_at,
      status,
      trigger_source,
      details
    ) VALUES (
      'demo_timeline_advance',
      v_started_at,
      now(),
      'success',
      v_trigger,
      v_details
    );

    RETURN v_details;
  END IF;

  UPDATE public.jobs j
  SET
    start_at = CASE WHEN j.start_at IS NOT NULL THEN j.start_at + p_interval ELSE NULL END,
    end_at = CASE WHEN j.end_at IS NOT NULL THEN j.end_at + p_interval ELSE NULL END
  WHERE j.company_id = ANY (v_demo_company_ids)
    AND j.archived = false
    AND (j.start_at IS NOT NULL OR j.end_at IS NOT NULL);
  GET DIAGNOSTICS v_jobs_updated = ROW_COUNT;

  UPDATE public.time_periods tp
  SET
    start_at = tp.start_at + p_interval,
    end_at = tp.end_at + p_interval
  WHERE tp.company_id = ANY (v_demo_company_ids)
    AND tp.deleted = false
    AND tp.job_id IN (
      SELECT j.id
      FROM public.jobs j
      WHERE j.company_id = ANY (v_demo_company_ids)
        AND j.archived = false
    );
  GET DIAGNOSTICS v_time_periods_updated = ROW_COUNT;

  UPDATE public.reserved_items ri
  SET
    start_at = CASE WHEN ri.start_at IS NOT NULL THEN ri.start_at + p_interval ELSE NULL END,
    end_at = CASE WHEN ri.end_at IS NOT NULL THEN ri.end_at + p_interval ELSE NULL END
  WHERE ri.time_period_id IN (
      SELECT tp.id
      FROM public.time_periods tp
      WHERE tp.company_id = ANY (v_demo_company_ids)
        AND tp.deleted = false
    )
    AND (ri.start_at IS NOT NULL OR ri.end_at IS NOT NULL);
  GET DIAGNOSTICS v_reserved_items_updated = ROW_COUNT;

  UPDATE public.reserved_vehicles rv
  SET
    start_at = CASE WHEN rv.start_at IS NOT NULL THEN rv.start_at + p_interval ELSE NULL END,
    end_at = CASE WHEN rv.end_at IS NOT NULL THEN rv.end_at + p_interval ELSE NULL END
  WHERE rv.time_period_id IN (
      SELECT tp.id
      FROM public.time_periods tp
      WHERE tp.company_id = ANY (v_demo_company_ids)
        AND tp.deleted = false
    )
    AND (rv.start_at IS NOT NULL OR rv.end_at IS NOT NULL);
  GET DIAGNOSTICS v_reserved_vehicles_updated = ROW_COUNT;

  UPDATE public.offer_crew_items oci
  SET
    start_date = oci.start_date + p_interval,
    end_date = oci.end_date + p_interval
  FROM public.job_offers jo
  JOIN public.jobs j ON j.id = jo.job_id
  WHERE oci.offer_id = jo.id
    AND j.company_id = ANY (v_demo_company_ids)
    AND j.archived = false;
  GET DIAGNOSTICS v_offer_crew_updated = ROW_COUNT;

  UPDATE public.offer_transport_items oti
  SET
    start_date = oti.start_date + p_interval,
    end_date = oti.end_date + p_interval
  FROM public.job_offers jo
  JOIN public.jobs j ON j.id = jo.job_id
  WHERE oti.offer_id = jo.id
    AND j.company_id = ANY (v_demo_company_ids)
    AND j.archived = false;
  GET DIAGNOSTICS v_offer_transport_updated = ROW_COUNT;

  UPDATE public.pretty_offer_module_block_items pobi
  SET
    start_at = CASE WHEN pobi.start_at IS NOT NULL THEN pobi.start_at + p_interval ELSE NULL END,
    end_at = CASE WHEN pobi.end_at IS NOT NULL THEN pobi.end_at + p_interval ELSE NULL END
  FROM public.pretty_offer_module_blocks pob
  JOIN public.pretty_offer_modules pom ON pom.id = pob.module_id
  JOIN public.job_offers jo ON jo.id = pom.offer_id
  JOIN public.jobs j ON j.id = jo.job_id
  WHERE pobi.block_id = pob.id
    AND j.company_id = ANY (v_demo_company_ids)
    AND j.archived = false
    AND (pobi.start_at IS NOT NULL OR pobi.end_at IS NOT NULL);
  GET DIAGNOSTICS v_offer_block_items_updated = ROW_COUNT;

  UPDATE public.pretty_offer_module_timeline_items poti
  SET
    start_at = CASE WHEN poti.start_at IS NOT NULL THEN poti.start_at + p_interval ELSE NULL END,
    end_at = CASE WHEN poti.end_at IS NOT NULL THEN poti.end_at + p_interval ELSE NULL END
  FROM public.pretty_offer_modules pom
  JOIN public.job_offers jo ON jo.id = pom.offer_id
  JOIN public.jobs j ON j.id = jo.job_id
  WHERE poti.module_id = pom.id
    AND j.company_id = ANY (v_demo_company_ids)
    AND j.archived = false
    AND (poti.start_at IS NOT NULL OR poti.end_at IS NOT NULL);
  GET DIAGNOSTICS v_offer_timeline_items_updated = ROW_COUNT;

  UPDATE public.time_entries te
  SET
    start_at = te.start_at + p_interval,
    end_at = te.end_at + p_interval
  WHERE te.company_id = ANY (v_demo_company_ids);
  GET DIAGNOSTICS v_time_entries_updated = ROW_COUNT;

  v_details := jsonb_build_object(
    'intervalDays', EXTRACT(epoch FROM p_interval) / 86400,
    'jobsUpdated', v_jobs_updated,
    'timePeriodsUpdated', v_time_periods_updated,
    'reservedItemsUpdated', v_reserved_items_updated,
    'reservedVehiclesUpdated', v_reserved_vehicles_updated,
    'offerCrewItemsUpdated', v_offer_crew_updated,
    'offerTransportItemsUpdated', v_offer_transport_updated,
    'offerBlockItemsUpdated', v_offer_block_items_updated,
    'offerTimelineItemsUpdated', v_offer_timeline_items_updated,
    'timeEntriesUpdated', v_time_entries_updated
  );

  INSERT INTO public.scheduled_job_runs (
    job_key,
    started_at,
    finished_at,
    status,
    trigger_source,
    details
  ) VALUES (
    'demo_timeline_advance',
    v_started_at,
    now(),
    'success',
    v_trigger,
    v_details
  );

  RETURN v_details;
EXCEPTION
  WHEN OTHERS THEN
    INSERT INTO public.scheduled_job_runs (
      job_key,
      started_at,
      finished_at,
      status,
      trigger_source,
      details
    ) VALUES (
      'demo_timeline_advance',
      v_started_at,
      now(),
      'failed',
      v_trigger,
      jsonb_build_object('error', SQLERRM)
    );
    RAISE;
END;
$$;

-- Extend public_offer_get with module_type and timeline_items.
CREATE OR REPLACE FUNCTION public.public_offer_get(p_access_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offer public.job_offers%ROWTYPE;
  v_job RECORD;
  v_job_address_text text := NULL;
  v_company RECORD;
  v_customer RECORD;
  v_customer_contact RECORD;
  v_project_lead RECORD;
  v_expansion RECORD;
  v_groups jsonb;
  v_crew_items jsonb;
  v_transport_groups jsonb;
  v_transport_items jsonb;
  v_pretty_sections jsonb;
  v_pretty_modules jsonb;
BEGIN
  SELECT *
  INTO v_offer
  FROM public.job_offers
  WHERE access_token = p_access_token
    AND status <> 'draft'
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT
    j.id,
    j.title,
    j.start_at,
    j.end_at,
    j.job_address_id,
    j.customer_id,
    j.customer_contact_id,
    j.project_lead_user_id
  INTO v_job
  FROM public.jobs j
  WHERE j.id = v_offer.job_id
  LIMIT 1;

  IF v_job.job_address_id IS NOT NULL THEN
    SELECT trim(concat_ws(', ',
      nullif(trim(a.address_line), ''),
      nullif(trim(concat_ws(' ', nullif(trim(a.zip_code), ''), nullif(trim(a.city), ''))), ''),
      nullif(trim(a.country), '')
    ))
    INTO v_job_address_text
    FROM public.addresses a
    WHERE a.id = v_job.job_address_id
    LIMIT 1;
  END IF;

  IF v_job.customer_id IS NOT NULL THEN
    SELECT
      c.id,
      c.name,
      c.email,
      c.phone,
      c.address,
      c.logo_path,
      c.accent_color,
      c.accent_color_custom
    INTO v_customer
    FROM public.customers c
    WHERE c.id = v_job.customer_id
    LIMIT 1;
  END IF;

  IF v_job.customer_contact_id IS NOT NULL THEN
    SELECT ct.id, ct.name, ct.email, ct.phone
    INTO v_customer_contact
    FROM public.contacts ct
    WHERE ct.id = v_job.customer_contact_id
    LIMIT 1;
  END IF;

  IF v_job.project_lead_user_id IS NOT NULL THEN
    SELECT p.user_id, p.display_name, p.email, p.phone
    INTO v_project_lead
    FROM public.profiles p
    WHERE p.user_id = v_job.project_lead_user_id
    LIMIT 1;
  END IF;

  SELECT
    co.id,
    co.name,
    co.address,
    co.logo_light_path,
    co.logo_dark_path,
    co.accent_color,
    co.terms_and_conditions_type,
    co.terms_and_conditions_text,
    co.terms_and_conditions_pdf_path
  INTO v_company
  FROM public.companies co
  WHERE co.id = v_offer.company_id
  LIMIT 1;

  SELECT
    ce.vehicle_daily_rate,
    ce.vehicle_distance_rate,
    ce.vehicle_distance_increment
  INTO v_expansion
  FROM public.company_expansions ce
  WHERE ce.company_id = v_offer.company_id
  LIMIT 1;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', og.id,
        'offer_basis_id', og.offer_basis_id,
        'group_name', og.group_name,
        'sort_order', og.sort_order,
        'created_at', og.created_at,
        'items',
          COALESCE((
            SELECT jsonb_agg(
              to_jsonb(oei) ||
              jsonb_build_object(
                'item',
                  CASE
                    WHEN oei.item_id IS NULL THEN NULL
                    ELSE (
                      SELECT jsonb_build_object(
                        'id', i.id,
                        'name', i.name,
                        'item_kind', i.item_kind,
                        'model', i.model,
                        'brand',
                          CASE
                            WHEN b.id IS NULL THEN NULL
                            ELSE jsonb_build_object('id', b.id, 'name', b.name)
                          END
                      )
                      FROM public.items i
                      LEFT JOIN public.item_brands b ON b.id = i.brand_id
                      WHERE i.id = oei.item_id
                      LIMIT 1
                    )
                  END,
                'group',
                  CASE
                    WHEN oei.group_id IS NULL THEN NULL
                    ELSE (
                      SELECT jsonb_build_object(
                        'id', g.id,
                        'name', g.name,
                        'item_kind', g.item_kind
                      )
                      FROM public.item_groups g
                      WHERE g.id = oei.group_id
                      LIMIT 1
                    )
                  END
              )
              ORDER BY oei.sort_order
            )
            FROM public.offer_equipment_items oei
            WHERE oei.offer_group_id = og.id
          ), '[]'::jsonb)
      )
      ORDER BY og.sort_order
    ),
    '[]'::jsonb
  )
  INTO v_groups
  FROM public.offer_equipment_groups og
  WHERE og.offer_basis_id = v_offer.offer_basis_id;

  SELECT COALESCE(
    jsonb_agg(to_jsonb(ci) ORDER BY ci.sort_order),
    '[]'::jsonb
  )
  INTO v_crew_items
  FROM public.offer_crew_items ci
  WHERE ci.offer_basis_id = v_offer.offer_basis_id;

  SELECT COALESCE(
    jsonb_agg(to_jsonb(tg) ORDER BY tg.sort_order),
    '[]'::jsonb
  )
  INTO v_transport_groups
  FROM public.offer_transport_groups tg
  WHERE tg.offer_basis_id = v_offer.offer_basis_id;

  SELECT COALESCE(
    jsonb_agg(to_jsonb(ti) ORDER BY ti.sort_order),
    '[]'::jsonb
  )
  INTO v_transport_items
  FROM public.offer_transport_items ti
  JOIN public.offer_transport_groups tg ON tg.id = ti.transport_group_id
  WHERE tg.offer_basis_id = v_offer.offer_basis_id;

  SELECT COALESCE(
    jsonb_agg(to_jsonb(ps) ORDER BY ps.sort_order),
    '[]'::jsonb
  )
  INTO v_pretty_sections
  FROM public.offer_pretty_sections ps
  WHERE ps.offer_id = v_offer.id;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', m.id,
        'title', m.title,
        'module_type', m.module_type,
        'tagline', m.tagline,
        'story_heading_1', m.story_heading_1,
        'story_body_1', m.story_body_1,
        'story_heading_2', m.story_heading_2,
        'story_body_2', m.story_body_2,
        'hero_media_type', m.hero_media_type,
        'hero_media_url', m.hero_media_url,
        'hero_media_caption', m.hero_media_caption,
        'sort_order', m.sort_order,
        'display_price', m.display_price,
        'computed_cost', m.computed_cost,
        'show_price', m.show_price,
        'timeline_items',
          COALESCE((
            SELECT jsonb_agg(to_jsonb(ti) ORDER BY ti.sort_order)
            FROM public.pretty_offer_module_timeline_items ti
            WHERE ti.module_id = m.id
          ), '[]'::jsonb),
        'blocks',
          COALESCE((
            SELECT jsonb_agg(
              jsonb_build_object(
                'id', b.id,
                'module_id', b.module_id,
                'block_type', b.block_type,
                'sort_order', b.sort_order,
                'text_content', b.text_content,
                'url', b.url,
                'link_title', b.link_title,
                'caption', b.caption,
                'items',
                  COALESCE((
                    SELECT jsonb_agg(to_jsonb(bi) ORDER BY bi.sort_order)
                    FROM public.pretty_offer_module_block_items bi
                    WHERE bi.block_id = b.id
                  ), '[]'::jsonb)
              )
              ORDER BY b.sort_order
            )
            FROM public.pretty_offer_module_blocks b
            WHERE b.module_id = m.id
          ), '[]'::jsonb)
      )
      ORDER BY m.sort_order
    ),
    '[]'::jsonb
  )
  INTO v_pretty_modules
  FROM public.pretty_offer_modules m
  WHERE m.offer_id = v_offer.id;

  RETURN
    to_jsonb(v_offer) ||
    jsonb_build_object(
      'job_title', COALESCE(v_job.title, NULL),
      'job_start_at', v_job.start_at,
      'job_end_at', v_job.end_at,
      'job_address', v_job_address_text,
      'customer', CASE WHEN v_customer IS NULL THEN NULL ELSE to_jsonb(v_customer) END,
      'customer_contact', CASE WHEN v_customer_contact IS NULL THEN NULL ELSE to_jsonb(v_customer_contact) END,
      'project_lead', CASE WHEN v_project_lead IS NULL THEN NULL ELSE to_jsonb(v_project_lead) END,
      'company', CASE
        WHEN v_company IS NULL THEN NULL
        ELSE jsonb_build_object(
          'id', v_company.id,
          'name', v_company.name,
          'address', v_company.address,
          'logo_light_path', v_company.logo_light_path,
          'logo_dark_path', v_company.logo_dark_path,
          'accent_color', v_company.accent_color
        )
      END,
      'company_terms', CASE
        WHEN v_company IS NULL THEN NULL
        ELSE jsonb_build_object(
          'type', v_company.terms_and_conditions_type,
          'text', v_company.terms_and_conditions_text,
          'pdf_path', v_company.terms_and_conditions_pdf_path
        )
      END,
      'company_expansion', CASE
        WHEN v_expansion IS NULL THEN NULL
        ELSE jsonb_build_object(
          'vehicle_daily_rate', v_expansion.vehicle_daily_rate,
          'vehicle_distance_rate', v_expansion.vehicle_distance_rate,
          'vehicle_distance_increment', v_expansion.vehicle_distance_increment
        )
      END,
      'groups', v_groups,
      'crew_items', v_crew_items,
      'transport_groups', v_transport_groups,
      'transport_items', v_transport_items,
      'pretty_sections', v_pretty_sections,
      'modules', v_pretty_modules
    );
END;
$$;
