-- Add group contents (items + nested groups) for public offer so customers can expand item groups.
-- Recursive helper returns JSON: [{ type: 'item', name, brand_name, model, quantity }, { type: 'group', name, quantity, items: [...] }].

CREATE OR REPLACE FUNCTION public.get_group_contents_for_display(p_group_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  result jsonb := '[]'::jsonb;
  child_items jsonb;
BEGIN
  FOR r IN
    SELECT gi.item_id, gi.child_group_id, gi.quantity,
           i.name AS item_name, i.model, b.name AS brand_name,
           g.name AS group_name
    FROM public.group_items gi
    LEFT JOIN public.items i ON i.id = gi.item_id
    LEFT JOIN public.item_brands b ON b.id = i.brand_id
    LEFT JOIN public.item_groups g ON g.id = gi.child_group_id
    WHERE gi.group_id = p_group_id
    ORDER BY gi.id
  LOOP
    IF r.item_id IS NOT NULL THEN
      result := result || jsonb_build_object(
        'type', 'item',
        'name', COALESCE(r.item_name, ''),
        'brand_name', r.brand_name,
        'model', r.model,
        'quantity', COALESCE(r.quantity, 1)
      );
    ELSIF r.child_group_id IS NOT NULL THEN
      child_items := public.get_group_contents_for_display(r.child_group_id);
      result := result || jsonb_build_object(
        'type', 'group',
        'name', COALESCE(r.group_name, ''),
        'quantity', COALESCE(r.quantity, 1),
        'items', child_items
      );
    END IF;
  END LOOP;
  RETURN result;
END;
$$;

COMMENT ON FUNCTION public.get_group_contents_for_display(uuid) IS
  'Returns nested contents of an item group (items and child groups) for display. Used by public_offer_get.';

-- Extend public_offer_get so each offer equipment item that is a group includes group_contents.
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

  -- Equipment groups + items (with item/group details and group_contents for groups)
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
  WHERE og.offer_id = v_offer.id;

  SELECT COALESCE(
    jsonb_agg(to_jsonb(ci) ORDER BY ci.sort_order),
    '[]'::jsonb
  )
  INTO v_crew_items
  FROM public.offer_crew_items ci
  WHERE ci.offer_id = v_offer.id;

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
