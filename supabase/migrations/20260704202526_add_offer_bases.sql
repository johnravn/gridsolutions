-- Offer bases: shared equipment/crew/transport line items for technical and pretty offers.

-- ---------------------------------------------------------------------------
-- 1. offer_bases table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.offer_bases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  bookings_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_offer_bases_job FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE CASCADE,
  CONSTRAINT fk_offer_bases_company FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_offer_bases_job_id ON public.offer_bases(job_id);
CREATE INDEX IF NOT EXISTS idx_offer_bases_company_id ON public.offer_bases(company_id);

COMMENT ON TABLE public.offer_bases IS
  'Shared equipment/crew/transport content for one or more job_offers (technical/pretty).';

CREATE OR REPLACE FUNCTION public.update_offer_bases_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_offer_bases_updated_at ON public.offer_bases;
CREATE TRIGGER trigger_update_offer_bases_updated_at
BEFORE UPDATE ON public.offer_bases
FOR EACH ROW
EXECUTE FUNCTION public.update_offer_bases_updated_at();

ALTER TABLE public.offer_bases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Company members can manage their company's offer bases" ON public.offer_bases;
CREATE POLICY "Company members can manage their company's offer bases"
ON public.offer_bases
FOR ALL
USING (
  company_id IN (
    SELECT company_id FROM public.company_users
    WHERE user_id = auth.uid()
  )
);

-- ---------------------------------------------------------------------------
-- 2. Backfill: one basis per existing offer
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE _offer_basis_map (
  offer_id UUID PRIMARY KEY,
  basis_id UUID NOT NULL
);

DO $$
DECLARE
  r RECORD;
  v_basis_id uuid;
BEGIN
  FOR r IN
    SELECT * FROM public.job_offers ORDER BY created_at ASC
  LOOP
    INSERT INTO public.offer_bases (
      job_id,
      company_id,
      title,
      bookings_synced_at,
      created_at,
      updated_at
    )
    VALUES (
      r.job_id,
      r.company_id,
      COALESCE(NULLIF(trim(r.title), ''), 'Offer basis'),
      r.bookings_synced_at,
      r.created_at,
      r.updated_at
    )
    RETURNING id INTO v_basis_id;

    INSERT INTO _offer_basis_map (offer_id, basis_id)
    VALUES (r.id, v_basis_id);
  END LOOP;
END $$;

ALTER TABLE public.job_offers
  ADD COLUMN IF NOT EXISTS offer_basis_id UUID REFERENCES public.offer_bases(id) ON DELETE RESTRICT;

UPDATE public.job_offers jo
SET offer_basis_id = m.basis_id
FROM _offer_basis_map m
WHERE jo.id = m.offer_id
  AND jo.offer_basis_id IS NULL;

-- Pretty offers linked to a technical offer share that technical offer's basis
UPDATE public.job_offers po
SET offer_basis_id = t.offer_basis_id
FROM public.job_offers t
WHERE po.source_technical_offer_id = t.id
  AND po.offer_type = 'pretty'
  AND t.offer_basis_id IS NOT NULL
  AND po.offer_basis_id IS DISTINCT FROM t.offer_basis_id;

-- Remove orphaned empty bases (e.g. pretty offers that now share a technical basis)
DELETE FROM public.offer_bases ob
WHERE NOT EXISTS (
  SELECT 1 FROM public.job_offers jo WHERE jo.offer_basis_id = ob.id
);

-- ---------------------------------------------------------------------------
-- 3. Repoint line-item tables from offer_id -> offer_basis_id
-- ---------------------------------------------------------------------------
ALTER TABLE public.offer_equipment_groups
  ADD COLUMN IF NOT EXISTS offer_basis_id UUID REFERENCES public.offer_bases(id) ON DELETE CASCADE;

UPDATE public.offer_equipment_groups g
SET offer_basis_id = m.basis_id
FROM _offer_basis_map m
WHERE g.offer_id = m.offer_id
  AND g.offer_basis_id IS NULL;

ALTER TABLE public.offer_crew_items
  ADD COLUMN IF NOT EXISTS offer_basis_id UUID REFERENCES public.offer_bases(id) ON DELETE CASCADE;

UPDATE public.offer_crew_items ci
SET offer_basis_id = m.basis_id
FROM _offer_basis_map m
WHERE ci.offer_id = m.offer_id
  AND ci.offer_basis_id IS NULL;

ALTER TABLE public.offer_transport_groups
  ADD COLUMN IF NOT EXISTS offer_basis_id UUID REFERENCES public.offer_bases(id) ON DELETE CASCADE;

UPDATE public.offer_transport_groups tg
SET offer_basis_id = m.basis_id
FROM _offer_basis_map m
WHERE tg.offer_id = m.offer_id
  AND tg.offer_basis_id IS NULL;

ALTER TABLE public.offer_transport_items
  ADD COLUMN IF NOT EXISTS offer_basis_id UUID REFERENCES public.offer_bases(id) ON DELETE CASCADE;

UPDATE public.offer_transport_items ti
SET offer_basis_id = m.basis_id
FROM _offer_basis_map m
WHERE ti.offer_id = m.offer_id
  AND ti.offer_basis_id IS NULL;

-- Drop policies that depend on offer_id before dropping the column
DROP POLICY IF EXISTS "Company members can manage their company's equipment groups" ON public.offer_equipment_groups;
DROP POLICY IF EXISTS "Public can view equipment groups from accessible offers" ON public.offer_equipment_groups;
DROP POLICY IF EXISTS "Company members can manage their company's equipment items" ON public.offer_equipment_items;
DROP POLICY IF EXISTS "Public can view equipment items from accessible offers" ON public.offer_equipment_items;
DROP POLICY IF EXISTS "Company members can manage their company's crew items" ON public.offer_crew_items;
DROP POLICY IF EXISTS "Public can view crew items from accessible offers" ON public.offer_crew_items;
DROP POLICY IF EXISTS "Company members can manage their company's transport items" ON public.offer_transport_items;
DROP POLICY IF EXISTS "Public can view transport items from accessible offers" ON public.offer_transport_items;
DROP POLICY IF EXISTS "Company members can manage their company's transport groups" ON public.offer_transport_groups;

DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'offer_crew_items',
    'offer_equipment_groups',
    'offer_transport_items',
    'offer_transport_groups'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS demo_company_no_insert ON public.%I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS demo_company_no_update ON public.%I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS demo_company_no_delete ON public.%I', tbl);
  END LOOP;
END $$;

-- Drop legacy offer_id FKs and columns
ALTER TABLE public.offer_equipment_groups DROP CONSTRAINT IF EXISTS fk_offer_equipment_groups_offer;
ALTER TABLE public.offer_equipment_groups DROP CONSTRAINT IF EXISTS offer_equipment_groups_offer_id_fkey;
DROP INDEX IF EXISTS idx_offer_equipment_groups_offer_id;
ALTER TABLE public.offer_equipment_groups DROP COLUMN IF EXISTS offer_id;
ALTER TABLE public.offer_equipment_groups ALTER COLUMN offer_basis_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_offer_equipment_groups_offer_basis_id
  ON public.offer_equipment_groups(offer_basis_id);

ALTER TABLE public.offer_crew_items DROP CONSTRAINT IF EXISTS fk_offer_crew_items_offer;
ALTER TABLE public.offer_crew_items DROP CONSTRAINT IF EXISTS offer_crew_items_offer_id_fkey;
DROP INDEX IF EXISTS idx_offer_crew_items_offer_id;
ALTER TABLE public.offer_crew_items DROP COLUMN IF EXISTS offer_id;
ALTER TABLE public.offer_crew_items ALTER COLUMN offer_basis_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_offer_crew_items_offer_basis_id
  ON public.offer_crew_items(offer_basis_id);

ALTER TABLE public.offer_transport_groups DROP CONSTRAINT IF EXISTS offer_transport_groups_offer_id_fkey;
DROP INDEX IF EXISTS idx_offer_transport_groups_offer_id;
ALTER TABLE public.offer_transport_groups DROP COLUMN IF EXISTS offer_id;
ALTER TABLE public.offer_transport_groups ALTER COLUMN offer_basis_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_offer_transport_groups_offer_basis_id
  ON public.offer_transport_groups(offer_basis_id);

ALTER TABLE public.offer_transport_items DROP CONSTRAINT IF EXISTS fk_offer_transport_items_offer;
ALTER TABLE public.offer_transport_items DROP CONSTRAINT IF EXISTS offer_transport_items_offer_id_fkey;
DROP INDEX IF EXISTS idx_offer_transport_items_offer_id;
ALTER TABLE public.offer_transport_items DROP COLUMN IF EXISTS offer_id;
ALTER TABLE public.offer_transport_items ALTER COLUMN offer_basis_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_offer_transport_items_offer_basis_id
  ON public.offer_transport_items(offer_basis_id);

ALTER TABLE public.job_offers ALTER COLUMN offer_basis_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_job_offers_offer_basis_id ON public.job_offers(offer_basis_id);

-- ---------------------------------------------------------------------------
-- 4. RLS updates for repointed child tables
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Company members can manage their company's equipment groups" ON public.offer_equipment_groups;
CREATE POLICY "Company members can manage their company's equipment groups"
ON public.offer_equipment_groups
FOR ALL
USING (
  offer_basis_id IN (
    SELECT ob.id FROM public.offer_bases ob
    JOIN public.company_users cu ON ob.company_id = cu.company_id
    WHERE cu.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Public can view equipment groups from accessible offers" ON public.offer_equipment_groups;
CREATE POLICY "Public can view equipment groups from accessible offers"
ON public.offer_equipment_groups
FOR SELECT TO authenticated, anon
USING (
  offer_basis_id IN (
    SELECT jo.offer_basis_id FROM public.job_offers jo
    WHERE jo.status <> 'draft'
  )
);

DROP POLICY IF EXISTS "Company members can manage their company's equipment items" ON public.offer_equipment_items;
CREATE POLICY "Company members can manage their company's equipment items"
ON public.offer_equipment_items
FOR ALL
USING (
  offer_group_id IN (
    SELECT og.id FROM public.offer_equipment_groups og
    JOIN public.offer_bases ob ON og.offer_basis_id = ob.id
    JOIN public.company_users cu ON ob.company_id = cu.company_id
    WHERE cu.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Public can view equipment items from accessible offers" ON public.offer_equipment_items;
CREATE POLICY "Public can view equipment items from accessible offers"
ON public.offer_equipment_items
FOR SELECT TO authenticated, anon
USING (
  offer_group_id IN (
    SELECT og.id FROM public.offer_equipment_groups og
    JOIN public.job_offers jo ON jo.offer_basis_id = og.offer_basis_id
    WHERE jo.status <> 'draft'
  )
);

DROP POLICY IF EXISTS "Public can view crew items from accessible offers" ON public.offer_crew_items;
CREATE POLICY "Public can view crew items from accessible offers"
ON public.offer_crew_items
FOR SELECT TO authenticated, anon
USING (
  offer_basis_id IN (
    SELECT jo.offer_basis_id FROM public.job_offers jo
    WHERE jo.status <> 'draft'
  )
);

DROP POLICY IF EXISTS "Public can view transport items from accessible offers" ON public.offer_transport_items;
CREATE POLICY "Public can view transport items from accessible offers"
ON public.offer_transport_items
FOR SELECT TO authenticated, anon
USING (
  offer_basis_id IN (
    SELECT jo.offer_basis_id FROM public.job_offers jo
    WHERE jo.status <> 'draft'
  )
);

DROP POLICY IF EXISTS "Company members can manage their company's crew items" ON public.offer_crew_items;
CREATE POLICY "Company members can manage their company's crew items"
ON public.offer_crew_items
FOR ALL
USING (
  offer_basis_id IN (
    SELECT ob.id FROM public.offer_bases ob
    JOIN public.company_users cu ON ob.company_id = cu.company_id
    WHERE cu.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Company members can manage their company's transport groups" ON public.offer_transport_groups;
CREATE POLICY "Company members can manage their company's transport groups"
ON public.offer_transport_groups
FOR ALL
USING (
  offer_basis_id IN (
    SELECT ob.id FROM public.offer_bases ob
    JOIN public.company_users cu ON ob.company_id = cu.company_id
    WHERE cu.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Company members can manage their company's transport items" ON public.offer_transport_items;
CREATE POLICY "Company members can manage their company's transport items"
ON public.offer_transport_items
FOR ALL
USING (
  offer_basis_id IN (
    SELECT ob.id FROM public.offer_bases ob
    JOIN public.company_users cu ON ob.company_id = cu.company_id
    WHERE cu.user_id = auth.uid()
  )
);

CREATE OR REPLACE FUNCTION public.demo_company_blocks_offer_basis_mutation(p_basis_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.demo_company_blocks_job_mutation(
    (SELECT ob.job_id FROM public.offer_bases ob WHERE ob.id = p_basis_id)
  );
$$;

DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'offer_crew_items',
    'offer_equipment_groups',
    'offer_transport_items',
    'offer_transport_groups'
  ]
  LOOP
    EXECUTE format(
      'CREATE POLICY demo_company_no_insert ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (NOT public.demo_company_blocks_offer_basis_mutation(offer_basis_id))',
      tbl
    );
    EXECUTE format(
      'CREATE POLICY demo_company_no_update ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING (NOT public.demo_company_blocks_offer_basis_mutation(offer_basis_id)) WITH CHECK (NOT public.demo_company_blocks_offer_basis_mutation(offer_basis_id))',
      tbl
    );
    EXECUTE format(
      'CREATE POLICY demo_company_no_delete ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING (NOT public.demo_company_blocks_offer_basis_mutation(offer_basis_id))',
      tbl
    );
  END LOOP;
END $$;

DROP POLICY IF EXISTS demo_company_no_insert ON public.offer_bases;
CREATE POLICY demo_company_no_insert ON public.offer_bases
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (NOT public.demo_company_blocks_job_mutation(job_id));

DROP POLICY IF EXISTS demo_company_no_update ON public.offer_bases;
CREATE POLICY demo_company_no_update ON public.offer_bases
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (NOT public.demo_company_blocks_job_mutation(job_id))
  WITH CHECK (NOT public.demo_company_blocks_job_mutation(job_id));

DROP POLICY IF EXISTS demo_company_no_delete ON public.offer_bases;
CREATE POLICY demo_company_no_delete ON public.offer_bases
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (NOT public.demo_company_blocks_job_mutation(job_id));

-- ---------------------------------------------------------------------------
-- 5. Pretty pricing: source_offer_basis_id
-- ---------------------------------------------------------------------------
ALTER TABLE public.pretty_offer_pricing_bases
  ADD COLUMN IF NOT EXISTS source_offer_basis_id UUID REFERENCES public.offer_bases(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pretty_offer_pricing_bases_source_offer_basis
  ON public.pretty_offer_pricing_bases(source_offer_basis_id);

UPDATE public.pretty_offer_pricing_bases pb
SET source_offer_basis_id = jo.offer_basis_id
FROM public.job_offers jo
WHERE pb.source_technical_offer_id = jo.id
  AND pb.source_offer_basis_id IS NULL;

UPDATE public.pretty_offer_pricing_bases pb
SET source_offer_basis_id = jo.offer_basis_id
FROM public.job_offers jo
WHERE pb.offer_id = jo.id
  AND pb.basis_type = 'technical'
  AND pb.source_offer_basis_id IS NULL;

-- ---------------------------------------------------------------------------
-- 6. Bookings sync marker on offer basis
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mark_offer_basis_bookings_synced(p_offer_basis_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.offer_bases
     SET bookings_synced_at = now()
   WHERE id = p_offer_basis_id;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_offer_basis_bookings_synced(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_offer_basis_bookings_synced(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_job_offer_bookings_synced(p_offer_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_basis_id uuid;
BEGIN
  SELECT offer_basis_id INTO v_basis_id
  FROM public.job_offers
  WHERE id = p_offer_id;

  IF v_basis_id IS NOT NULL THEN
    PERFORM public.mark_offer_basis_bookings_synced(v_basis_id);
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- 7. Demo helper: resolve offer via basis for equipment groups
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.demo_company_blocks_offer_group_mutation(p_group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.demo_company_blocks_offer_mutation(
    (
      SELECT jo.id
      FROM public.offer_equipment_groups g
      JOIN public.job_offers jo ON jo.offer_basis_id = g.offer_basis_id
      WHERE g.id = p_group_id
      LIMIT 1
    )
  );
$$;

-- ---------------------------------------------------------------------------
-- 8. public_offer_get: load line items from offer basis
-- ---------------------------------------------------------------------------
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
        'sort_order', m.sort_order,
        'display_price', m.display_price,
        'show_price', m.show_price,
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
