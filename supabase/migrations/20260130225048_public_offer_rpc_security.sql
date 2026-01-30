-- Public offer access should be gated by an unguessable access token.
-- PostgREST/RLS cannot safely enforce "only rows matching the query param token",
-- so we remove overly-broad public RLS policies and replace them with
-- SECURITY DEFINER RPC functions that validate the token in SQL.

-- ============================================================================
-- 1) Remove overly-broad public RLS policies
-- ============================================================================

-- Offers (these policies previously allowed anon to read/update *any* non-draft/sent offer)
DROP POLICY IF EXISTS "Public can view non-draft offers via access token" ON public.job_offers;
DROP POLICY IF EXISTS "Public can accept sent offers" ON public.job_offers;

DROP POLICY IF EXISTS "Public can view equipment groups from accessible offers" ON public.offer_equipment_groups;
DROP POLICY IF EXISTS "Public can view equipment items from accessible offers" ON public.offer_equipment_items;
DROP POLICY IF EXISTS "Public can view crew items from accessible offers" ON public.offer_crew_items;
DROP POLICY IF EXISTS "Public can view transport items from accessible offers" ON public.offer_transport_items;
DROP POLICY IF EXISTS "Public can view pretty sections from accessible offers" ON public.offer_pretty_sections;

-- Item detail helpers for public offers (we'll fetch needed data via RPC instead)
DROP POLICY IF EXISTS "Public can view items from accessible offers" ON public.items;
DROP POLICY IF EXISTS "Public can view item groups from accessible offers" ON public.item_groups;
DROP POLICY IF EXISTS "Public can view item brands from accessible offers" ON public.item_brands;

-- ============================================================================
-- 2) Public RPC: fetch complete offer payload by token
-- ============================================================================

CREATE OR REPLACE FUNCTION public.public_offer_get(p_access_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offer public.job_offers%ROWTYPE;
  v_job RECORD;
  v_company RECORD;
  v_customer RECORD;
  v_customer_contact RECORD;
  v_project_lead RECORD;
  v_expansion RECORD;
  v_groups jsonb;
  v_crew_items jsonb;
  v_transport_items jsonb;
  v_pretty_sections jsonb;
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

  -- Job and related entities
  SELECT
    j.id,
    j.title,
    j.customer_id,
    j.customer_contact_id,
    j.project_lead_user_id
  INTO v_job
  FROM public.jobs j
  WHERE j.id = v_offer.job_id
  LIMIT 1;

  IF v_job.customer_id IS NOT NULL THEN
    SELECT c.id, c.name, c.email, c.phone, c.address, c.logo_path
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

  -- Company (also includes terms)
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

  -- Company expansions (for transport defaults)
  SELECT
    ce.vehicle_daily_rate,
    ce.vehicle_distance_rate,
    ce.vehicle_distance_increment
  INTO v_expansion
  FROM public.company_expansions ce
  WHERE ce.company_id = v_offer.company_id
  LIMIT 1;

  -- Equipment groups + items (with item/group details for display)
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', og.id,
        'offer_id', og.offer_id,
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
                        'internally_owned', i.internally_owned,
                        'external_owner_id', i.external_owner_id,
                        'external_owner_name', ext_owner.name,
                        'model', i.model,
                        'brand',
                          CASE
                            WHEN b.id IS NULL THEN NULL
                            ELSE jsonb_build_object('id', b.id, 'name', b.name)
                          END
                      )
                      FROM public.items i
                      LEFT JOIN public.customers ext_owner ON ext_owner.id = i.external_owner_id
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
                        'internally_owned', g.internally_owned,
                        'external_owner_id', g.external_owner_id,
                        'external_owner_name', ext_owner2.name
                      )
                      FROM public.item_groups g
                      LEFT JOIN public.customers ext_owner2 ON ext_owner2.id = g.external_owner_id
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
  WHERE og.offer_id = v_offer.id;

  -- Crew items
  SELECT COALESCE(
    jsonb_agg(to_jsonb(ci) ORDER BY ci.sort_order),
    '[]'::jsonb
  )
  INTO v_crew_items
  FROM public.offer_crew_items ci
  WHERE ci.offer_id = v_offer.id;

  -- Transport items (attach minimal vehicle info when present)
  SELECT COALESCE(
    jsonb_agg(
      to_jsonb(ti) ||
      jsonb_build_object(
        'vehicle',
          CASE
            WHEN ti.vehicle_id IS NULL THEN NULL
            ELSE (
              SELECT jsonb_build_object(
                'id', v.id,
                'name', v.name,
                'external_owner_id', v.external_owner_id
              )
              FROM public.vehicles v
              WHERE v.id = ti.vehicle_id
              LIMIT 1
            )
          END
      )
      ORDER BY ti.sort_order
    ),
    '[]'::jsonb
  )
  INTO v_transport_items
  FROM public.offer_transport_items ti
  WHERE ti.offer_id = v_offer.id;

  -- Pretty sections (if any)
  SELECT COALESCE(
    jsonb_agg(to_jsonb(ps) ORDER BY ps.sort_order),
    '[]'::jsonb
  )
  INTO v_pretty_sections
  FROM public.offer_pretty_sections ps
  WHERE ps.offer_id = v_offer.id;

  RETURN
    to_jsonb(v_offer) ||
    jsonb_build_object(
      'job_title', COALESCE(v_job.title, NULL),
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
      'transport_items', v_transport_items,
      'pretty_sections', v_pretty_sections
    );
END;
$$;

REVOKE ALL ON FUNCTION public.public_offer_get(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_offer_get(text) TO anon, authenticated;

-- ============================================================================
-- 3) Public RPCs: safe public mutations by token
-- ============================================================================

CREATE OR REPLACE FUNCTION public.public_offer_mark_viewed(p_access_token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.job_offers
  SET viewed_at = COALESCE(viewed_at, NOW())
  WHERE access_token = p_access_token
    AND status <> 'draft';
END;
$$;

REVOKE ALL ON FUNCTION public.public_offer_mark_viewed(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_offer_mark_viewed(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.public_offer_accept(
  p_access_token text,
  p_first_name text,
  p_last_name text,
  p_phone text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offer public.job_offers%ROWTYPE;
  v_newer_exists boolean;
  v_full_name text;
  v_updated int;
BEGIN
  SELECT *
  INTO v_offer
  FROM public.job_offers
  WHERE access_token = p_access_token
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Offer not found';
  END IF;

  IF v_offer.status = 'superseded' THEN
    RAISE EXCEPTION 'This offer can no longer be accepted because a newer version has been sent.';
  END IF;

  IF v_offer.status <> 'sent' THEN
    RAISE EXCEPTION 'This offer can no longer be accepted.';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.job_offers o2
    WHERE o2.job_id = v_offer.job_id
      AND o2.version_number > v_offer.version_number
      AND o2.status IN ('sent', 'viewed', 'accepted')
  )
  INTO v_newer_exists;

  IF v_newer_exists THEN
    RAISE EXCEPTION 'This offer can no longer be accepted because a newer version has been sent.';
  END IF;

  v_full_name := btrim(concat_ws(' ', nullif(btrim(p_first_name), ''), nullif(btrim(p_last_name), '')));

  UPDATE public.job_offers
  SET
    status = 'accepted',
    accepted_at = NOW(),
    accepted_by_name = NULLIF(v_full_name, ''),
    accepted_by_phone = NULLIF(btrim(p_phone), '')
  WHERE id = v_offer.id
    AND status = 'sent';

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN
    RAISE EXCEPTION 'This offer can no longer be accepted.';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.public_offer_accept(text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_offer_accept(text, text, text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.public_offer_reject(
  p_access_token text,
  p_first_name text,
  p_last_name text,
  p_phone text,
  p_comment text
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
  SELECT *
  INTO v_offer
  FROM public.job_offers
  WHERE access_token = p_access_token
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Offer not found';
  END IF;

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

REVOKE ALL ON FUNCTION public.public_offer_reject(text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_offer_reject(text, text, text, text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.public_offer_request_revision(
  p_access_token text,
  p_first_name text,
  p_last_name text,
  p_phone text,
  p_comment text
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
  SELECT *
  INTO v_offer
  FROM public.job_offers
  WHERE access_token = p_access_token
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Offer not found';
  END IF;

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

REVOKE ALL ON FUNCTION public.public_offer_request_revision(text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_offer_request_revision(text, text, text, text, text) TO anon, authenticated;

