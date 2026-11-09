-- Public offer links resolve to an offer basis. Multiple active pretty offers
-- on that basis are returned as alternatives. Accepting one supersedes siblings.

-- ---------------------------------------------------------------------------
-- Helper: build the existing single-offer public JSON for one job_offers row
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.public_offer_build_detail(p_offer_id uuid)
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
  WHERE id = p_offer_id
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
                  END,
                'group_contents',
                  CASE
                    WHEN oei.group_id IS NULL THEN NULL
                    ELSE public.get_group_contents_for_display(oei.group_id)
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

REVOKE ALL ON FUNCTION public.public_offer_build_detail(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_offer_build_detail(uuid) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Helper: resolve a specific offer from basis/offer token + optional offer id
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.public_offer_resolve_target(
  p_access_token text,
  p_offer_id uuid DEFAULT NULL
)
RETURNS public.job_offers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_basis_id uuid;
  v_offer public.job_offers%ROWTYPE;
BEGIN
  IF p_access_token IS NULL OR btrim(p_access_token) = '' THEN
    RAISE EXCEPTION 'Offer not found';
  END IF;

  SELECT ob.id
  INTO v_basis_id
  FROM public.offer_bases ob
  WHERE ob.access_token = p_access_token
  LIMIT 1;

  IF v_basis_id IS NULL THEN
    SELECT jo.offer_basis_id
    INTO v_basis_id
    FROM public.job_offers jo
    WHERE jo.access_token = p_access_token
    LIMIT 1;
  END IF;

  IF v_basis_id IS NULL THEN
    RAISE EXCEPTION 'Offer not found';
  END IF;

  IF p_offer_id IS NOT NULL THEN
    SELECT *
    INTO v_offer
    FROM public.job_offers
    WHERE id = p_offer_id
      AND offer_basis_id = v_basis_id
    LIMIT 1;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Offer not found';
    END IF;

    RETURN v_offer;
  END IF;

  -- Legacy / single: prefer exact offer token match, else sole non-draft on basis.
  SELECT *
  INTO v_offer
  FROM public.job_offers
  WHERE access_token = p_access_token
  LIMIT 1;

  IF FOUND THEN
    RETURN v_offer;
  END IF;

  SELECT *
  INTO v_offer
  FROM public.job_offers
  WHERE offer_basis_id = v_basis_id
    AND status <> 'draft'
  ORDER BY version_number DESC, created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Offer not found';
  END IF;

  RETURN v_offer;
END;
$$;

REVOKE ALL ON FUNCTION public.public_offer_resolve_target(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_offer_resolve_target(text, uuid) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- public_offer_get: single offer OR multi pretty alternatives on a basis
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.public_offer_get(p_access_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_basis public.offer_bases%ROWTYPE;
  v_token_offer public.job_offers%ROWTYPE;
  v_alternatives jsonb := '[]'::jsonb;
  v_alt_count int := 0;
  v_default_offer_id uuid;
  v_detail jsonb;
  v_single_offer_id uuid;
BEGIN
  SELECT *
  INTO v_basis
  FROM public.offer_bases
  WHERE access_token = p_access_token
  LIMIT 1;

  IF NOT FOUND THEN
    SELECT *
    INTO v_token_offer
    FROM public.job_offers
    WHERE access_token = p_access_token
      AND status <> 'draft'
    LIMIT 1;

    IF NOT FOUND THEN
      RETURN NULL;
    END IF;

    SELECT *
    INTO v_basis
    FROM public.offer_bases
    WHERE id = v_token_offer.offer_basis_id
    LIMIT 1;

    IF NOT FOUND THEN
      RETURN NULL;
    END IF;
  END IF;

  -- Sub-versions match buildOfferSubVersionById (all offers on basis).
  WITH ordered AS (
    SELECT
      jo.id,
      jo.status,
      jo.offer_type,
      row_number() OVER (
        ORDER BY jo.version_number ASC, jo.created_at ASC
      ) AS sub_version
    FROM public.job_offers jo
    WHERE jo.offer_basis_id = v_basis.id
  )
  SELECT
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'sub_version', o.sub_version,
          'offer_id', o.id,
          'status', o.status
        )
        ORDER BY o.sub_version
      ),
      '[]'::jsonb
    ),
    count(*)::int
  INTO v_alternatives, v_alt_count
  FROM ordered o
  WHERE o.offer_type = 'pretty'
    AND o.status IN ('sent', 'viewed', 'accepted', 'superseded');

  IF v_alt_count >= 2 THEN
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'sub_version', (alt->>'sub_version')::int,
          'status', alt->>'status',
          'offer', public.public_offer_build_detail((alt->>'offer_id')::uuid)
        )
        ORDER BY (alt->>'sub_version')::int
      ),
      '[]'::jsonb
    )
    INTO v_alternatives
    FROM jsonb_array_elements(v_alternatives) alt;

    SELECT (alt->'offer'->>'id')::uuid
    INTO v_default_offer_id
    FROM jsonb_array_elements(v_alternatives) alt
    WHERE alt->>'status' = 'accepted'
    ORDER BY (alt->>'sub_version')::int DESC
    LIMIT 1;

    IF v_default_offer_id IS NULL THEN
      SELECT (alt->'offer'->>'id')::uuid
      INTO v_default_offer_id
      FROM jsonb_array_elements(v_alternatives) alt
      WHERE alt->>'status' IN ('sent', 'viewed')
      ORDER BY (alt->>'sub_version')::int DESC
      LIMIT 1;
    END IF;

    IF v_default_offer_id IS NULL THEN
      SELECT (alt->'offer'->>'id')::uuid
      INTO v_default_offer_id
      FROM jsonb_array_elements(v_alternatives) alt
      ORDER BY (alt->>'sub_version')::int DESC
      LIMIT 1;
    END IF;

    RETURN jsonb_build_object(
      'mode', 'alternatives',
      'basis', jsonb_build_object(
        'id', v_basis.id,
        'title', v_basis.title,
        'access_token', v_basis.access_token,
        'job_id', v_basis.job_id,
        'company_id', v_basis.company_id
      ),
      'alternatives', v_alternatives,
      'default_offer_id', v_default_offer_id
    );
  END IF;

  -- Single-offer path (technical, or one pretty, or legacy offer token).
  IF v_token_offer.id IS NOT NULL THEN
    v_single_offer_id := v_token_offer.id;
  ELSIF v_alt_count = 1 THEN
    SELECT (alt->>'offer_id')::uuid
    INTO v_single_offer_id
    FROM jsonb_array_elements(v_alternatives) alt
    LIMIT 1;
  ELSE
    SELECT jo.id
    INTO v_single_offer_id
    FROM public.job_offers jo
    WHERE jo.offer_basis_id = v_basis.id
      AND jo.status <> 'draft'
    ORDER BY jo.version_number DESC, jo.created_at DESC
    LIMIT 1;
  END IF;

  IF v_single_offer_id IS NULL THEN
    RETURN NULL;
  END IF;

  v_detail := public.public_offer_build_detail(v_single_offer_id);
  IF v_detail IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN v_detail || jsonb_build_object('mode', 'single');
END;
$$;

COMMENT ON FUNCTION public.public_offer_get(text) IS
  'Returns a public offer by basis or offer access_token. Multiple active pretty offers on a basis are returned as alternatives.';

REVOKE ALL ON FUNCTION public.public_offer_get(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_offer_get(text) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Mutations: accept / reject / revision / mark_viewed with optional p_offer_id
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.public_offer_accept(text, text, text, text, jsonb);

CREATE OR REPLACE FUNCTION public.public_offer_accept(
  p_access_token text,
  p_first_name text,
  p_last_name text,
  p_phone text,
  p_selected_option_ids jsonb DEFAULT '[]'::jsonb,
  p_offer_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offer public.job_offers%ROWTYPE;
  v_full_name text;
  v_updated int;
  v_option_id text;
  v_options_subtotal numeric(12,2) := 0;
  v_selections jsonb := '[]'::jsonb;
  v_known record;
  v_adjusted_before_discount numeric(12,2);
  v_discount_amount numeric(12,2);
  v_after_discount numeric(12,2);
  v_with_vat numeric(12,2);
  v_vat_percent numeric(5,2);
  v_discount_percent numeric(5,2);
BEGIN
  v_offer := public.public_offer_resolve_target(p_access_token, p_offer_id);

  IF v_offer.status = 'superseded' THEN
    RAISE EXCEPTION 'This offer can no longer be accepted because a newer version has been sent.';
  END IF;

  IF v_offer.status <> 'sent' THEN
    RAISE EXCEPTION 'This offer can no longer be accepted.';
  END IF;

  IF p_selected_option_ids IS NOT NULL
     AND jsonb_typeof(p_selected_option_ids) = 'array'
     AND jsonb_array_length(p_selected_option_ids) > 0 THEN
    FOR v_option_id IN
      SELECT jsonb_array_elements_text(p_selected_option_ids)
    LOOP
      SELECT *
      INTO v_known
      FROM public.collect_offer_options(v_offer.id) o
      WHERE o.option_id = v_option_id
      LIMIT 1;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid option selection';
      END IF;

      v_options_subtotal := v_options_subtotal + COALESCE(v_known.price, 0);
      v_selections := v_selections || jsonb_build_array(
        jsonb_build_object(
          'option_id', v_known.option_id,
          'block_id', v_known.block_id,
          'module_id', v_known.module_id,
          'label', v_known.label,
          'price', v_known.price
        )
      );
    END LOOP;
  END IF;

  v_vat_percent := COALESCE(v_offer.vat_percent, 25);
  v_discount_percent := COALESCE(v_offer.discount_percent, 0);
  v_adjusted_before_discount :=
    COALESCE(v_offer.total_before_discount, 0) + v_options_subtotal;

  IF v_offer.offer_type = 'technical' AND v_options_subtotal = 0 THEN
    v_after_discount := COALESCE(v_offer.total_after_discount, 0);
    v_with_vat := COALESCE(v_offer.total_with_vat, 0);
  ELSIF v_offer.offer_type = 'technical' THEN
    v_discount_amount := round(
      COALESCE(v_offer.equipment_subtotal, 0) * v_discount_percent / 100,
      2
    );
    v_after_discount := round(v_adjusted_before_discount - v_discount_amount, 2);
    v_with_vat := round(v_after_discount * (1 + v_vat_percent / 100), 2);
  ELSE
    v_discount_amount := round(
      v_adjusted_before_discount * v_discount_percent / 100,
      2
    );
    v_after_discount := round(v_adjusted_before_discount - v_discount_amount, 2);
    v_with_vat := round(v_after_discount * (1 + v_vat_percent / 100), 2);
  END IF;

  v_full_name := btrim(concat_ws(' ', nullif(btrim(p_first_name), ''), nullif(btrim(p_last_name), '')));

  UPDATE public.job_offers
  SET
    status = 'accepted',
    accepted_at = NOW(),
    accepted_by_name = NULLIF(v_full_name, ''),
    accepted_by_phone = NULLIF(btrim(p_phone), ''),
    accepted_option_selections = CASE
      WHEN jsonb_array_length(v_selections) > 0 THEN v_selections
      ELSE NULL
    END,
    accepted_options_subtotal = CASE
      WHEN v_options_subtotal > 0 THEN v_options_subtotal
      ELSE NULL
    END,
    total_before_discount = v_adjusted_before_discount,
    total_after_discount = v_after_discount,
    total_with_vat = v_with_vat
  WHERE id = v_offer.id
    AND status = 'sent';

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN
    RAISE EXCEPTION 'This offer can no longer be accepted.';
  END IF;

  -- Accepting one pretty alternative supersedes other active alts on the basis.
  IF v_offer.offer_type = 'pretty' AND v_offer.offer_basis_id IS NOT NULL THEN
    UPDATE public.job_offers
    SET
      status = 'superseded',
      locked = true
    WHERE offer_basis_id = v_offer.offer_basis_id
      AND id <> v_offer.id
      AND offer_type = 'pretty'
      AND status IN ('sent', 'viewed');
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.public_offer_accept(text, text, text, text, jsonb, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_offer_accept(text, text, text, text, jsonb, uuid) TO anon, authenticated;

DROP FUNCTION IF EXISTS public.public_offer_reject(text, text, text, text, text);

CREATE OR REPLACE FUNCTION public.public_offer_reject(
  p_access_token text,
  p_first_name text,
  p_last_name text,
  p_phone text,
  p_comment text,
  p_offer_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offer public.job_offers%ROWTYPE;
  v_full_name text;
  v_updated int;
BEGIN
  v_offer := public.public_offer_resolve_target(p_access_token, p_offer_id);

  IF v_offer.status <> 'sent' THEN
    RAISE EXCEPTION 'This offer can no longer be rejected.';
  END IF;

  v_full_name := btrim(concat_ws(' ', nullif(btrim(p_first_name), ''), nullif(btrim(p_last_name), '')));

  UPDATE public.job_offers
  SET
    status = 'rejected',
    rejected_at = NOW(),
    rejected_by_name = NULLIF(v_full_name, ''),
    rejected_by_phone = NULLIF(btrim(p_phone), ''),
    rejection_comment = NULLIF(btrim(p_comment), '')
  WHERE id = v_offer.id
    AND status = 'sent';

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN
    RAISE EXCEPTION 'This offer can no longer be rejected.';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.public_offer_reject(text, text, text, text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_offer_reject(text, text, text, text, text, uuid) TO anon, authenticated;

DROP FUNCTION IF EXISTS public.public_offer_request_revision(text, text, text, text, text);

CREATE OR REPLACE FUNCTION public.public_offer_request_revision(
  p_access_token text,
  p_first_name text,
  p_last_name text,
  p_phone text,
  p_comment text,
  p_offer_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offer public.job_offers%ROWTYPE;
  v_full_name text;
  v_updated int;
BEGIN
  v_offer := public.public_offer_resolve_target(p_access_token, p_offer_id);

  IF v_offer.status <> 'sent' THEN
    RAISE EXCEPTION 'This offer can no longer be revised.';
  END IF;

  v_full_name := btrim(concat_ws(' ', nullif(btrim(p_first_name), ''), nullif(btrim(p_last_name), '')));

  UPDATE public.job_offers
  SET
    revision_requested_at = NOW(),
    revision_requested_by_name = NULLIF(v_full_name, ''),
    revision_requested_by_phone = NULLIF(btrim(p_phone), ''),
    revision_comment = NULLIF(btrim(p_comment), ''),
    status = 'viewed'
  WHERE id = v_offer.id
    AND status = 'sent';

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN
    RAISE EXCEPTION 'This offer can no longer be revised.';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.public_offer_request_revision(text, text, text, text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_offer_request_revision(text, text, text, text, text, uuid) TO anon, authenticated;

DROP FUNCTION IF EXISTS public.public_offer_mark_viewed(text);

CREATE OR REPLACE FUNCTION public.public_offer_mark_viewed(
  p_access_token text,
  p_offer_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offer public.job_offers%ROWTYPE;
BEGIN
  v_offer := public.public_offer_resolve_target(p_access_token, p_offer_id);

  UPDATE public.job_offers
  SET viewed_at = COALESCE(viewed_at, NOW())
  WHERE id = v_offer.id
    AND status <> 'draft';
END;
$$;

REVOKE ALL ON FUNCTION public.public_offer_mark_viewed(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_offer_mark_viewed(text, uuid) TO anon, authenticated;
