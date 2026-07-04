-- Replace inventory item/group ownership (internally_owned + external_owner_id)
-- with item_kind (stock | subrental). Subcontractor assignment moves to job level.

-- =============================================================================
-- 1. Enum + columns on items / item_groups
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'inventory_item_kind'
  ) THEN
    CREATE TYPE public.inventory_item_kind AS ENUM ('stock', 'subrental');
  END IF;
END $$;

ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS item_kind public.inventory_item_kind;

ALTER TABLE public.item_groups
  ADD COLUMN IF NOT EXISTS item_kind public.inventory_item_kind;

UPDATE public.items
SET item_kind = CASE
  WHEN internally_owned = false THEN 'subrental'::public.inventory_item_kind
  ELSE 'stock'::public.inventory_item_kind
END
WHERE item_kind IS NULL;

UPDATE public.item_groups
SET item_kind = CASE
  WHEN internally_owned = false THEN 'subrental'::public.inventory_item_kind
  ELSE 'stock'::public.inventory_item_kind
END
WHERE item_kind IS NULL;

ALTER TABLE public.items
  ALTER COLUMN item_kind SET DEFAULT 'stock'::public.inventory_item_kind,
  ALTER COLUMN item_kind SET NOT NULL;

ALTER TABLE public.item_groups
  ALTER COLUMN item_kind SET DEFAULT 'stock'::public.inventory_item_kind,
  ALTER COLUMN item_kind SET NOT NULL;

-- =============================================================================
-- 2. reserved_items.subcontractor_id + backfill from item owners
-- =============================================================================

ALTER TABLE public.reserved_items
  ADD COLUMN IF NOT EXISTS subcontractor_id uuid REFERENCES public.customers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS reserved_items_subcontractor_id_idx
  ON public.reserved_items (subcontractor_id)
  WHERE subcontractor_id IS NOT NULL;

UPDATE public.reserved_items ri
SET subcontractor_id = i.external_owner_id
FROM public.items i
WHERE ri.item_id = i.id
  AND ri.subcontractor_id IS NULL
  AND i.external_owner_id IS NOT NULL
  AND i.internally_owned = false;

-- =============================================================================
-- 3. job_subcontractors
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.job_subcontractors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_id, customer_id)
);

CREATE INDEX IF NOT EXISTS job_subcontractors_job_id_idx
  ON public.job_subcontractors (job_id);

CREATE INDEX IF NOT EXISTS job_subcontractors_customer_id_idx
  ON public.job_subcontractors (customer_id);

INSERT INTO public.job_subcontractors (job_id, customer_id, created_at)
SELECT DISTINCT tp.job_id, ri.subcontractor_id, now()
FROM public.reserved_items ri
JOIN public.time_periods tp ON tp.id = ri.time_period_id
WHERE ri.subcontractor_id IS NOT NULL
ON CONFLICT (job_id, customer_id) DO NOTHING;

-- =============================================================================
-- 4. Drop ownership columns from items / item_groups
-- =============================================================================

DROP VIEW IF EXISTS public.inventory_index CASCADE;
DROP VIEW IF EXISTS public.item_index_ext CASCADE;

ALTER TABLE public.items DROP CONSTRAINT IF EXISTS items_owner_chk;
ALTER TABLE public.items DROP CONSTRAINT IF EXISTS items_owner_oneof_chk;
ALTER TABLE public.item_groups DROP CONSTRAINT IF EXISTS item_groups_owner_chk;

DROP INDEX IF EXISTS public.items_external_owner_id_idx;
DROP INDEX IF EXISTS public.items_external_owner_idx;
DROP INDEX IF EXISTS public.items_internal_owner_idx;
DROP INDEX IF EXISTS public.item_groups_external_owner_id_idx;

ALTER TABLE public.items DROP CONSTRAINT IF EXISTS items_external_owner_id_fkey;
ALTER TABLE public.items DROP CONSTRAINT IF EXISTS items_internal_owner_company_id_fkey;
ALTER TABLE public.item_groups DROP CONSTRAINT IF EXISTS item_groups_external_owner_id_fkey;

ALTER TABLE public.items
  DROP COLUMN IF EXISTS internally_owned,
  DROP COLUMN IF EXISTS external_owner_id,
  DROP COLUMN IF EXISTS internal_owner_company_id;

ALTER TABLE public.item_groups
  DROP COLUMN IF EXISTS internally_owned,
  DROP COLUMN IF EXISTS external_owner_id;

-- =============================================================================
-- 5. Recreate inventory_index
-- =============================================================================

CREATE VIEW public.inventory_index WITH (security_invoker = 'on') AS
SELECT
  i.company_id,
  i.id,
  i.name,
  ic.name AS category_name,
  ib.name AS brand_name,
  i.model,
  i.total_quantity AS on_hand,
  icp.current_price,
  'NOK'::text AS currency,
  false AS is_group,
  NULL::boolean AS "unique",
  i.allow_individual_booking,
  i.active,
  i.deleted,
  i.item_kind,
  i.nicknames
FROM public.items i
LEFT JOIN public.item_categories ic ON ic.id = i.category_id
LEFT JOIN public.item_brands ib ON ib.id = i.brand_id
LEFT JOIN public.item_current_price icp ON icp.item_id = i.id

UNION ALL

SELECT
  g.company_id,
  g.id,
  g.name,
  ic2.name AS category_name,
  NULL::text AS brand_name,
  NULL::text AS model,
  gr.on_hand,
  gcp.current_price,
  'NOK'::text AS currency,
  true AS is_group,
  g."unique",
  true AS allow_individual_booking,
  g.active,
  g.deleted,
  g.item_kind,
  NULL::text AS nicknames
FROM public.item_groups g
LEFT JOIN public.item_categories ic2 ON ic2.id = g.category_id
LEFT JOIN public.groups_with_rollups gr ON gr.id = g.id
LEFT JOIN public.group_current_price gcp ON gcp.group_id = g.id;

GRANT SELECT ON public.inventory_index TO anon, authenticated, service_role;

-- =============================================================================
-- 6. Recreate item_index_ext
-- =============================================================================

CREATE VIEW public.item_index_ext WITH (security_invoker = 'on') AS
SELECT
  i.id,
  i.company_id,
  i.name,
  i.category_id,
  i.brand_id,
  i.model,
  i.allow_individual_booking,
  i.total_quantity,
  i.active,
  i.notes,
  i.deleted,
  i.item_kind,
  (i.item_kind = 'subrental') AS is_subrental
FROM public.items i;

GRANT SELECT ON public.item_index_ext TO anon, authenticated, service_role;

-- =============================================================================
-- 7. Skip quantity checks for subrental items
-- =============================================================================

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

  IF NEW.status = 'canceled' THEN
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
    AND ri.status IS DISTINCT FROM 'canceled'
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

-- =============================================================================
-- 8. public_offer_get — item_kind instead of ownership on inventory
-- =============================================================================

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
  WHERE og.offer_id = v_offer.id;

  SELECT COALESCE(
    jsonb_agg(to_jsonb(ci) ORDER BY ci.sort_order),
    '[]'::jsonb
  )
  INTO v_crew_items
  FROM public.offer_crew_items ci
  WHERE ci.offer_id = v_offer.id;

  SELECT COALESCE(
    jsonb_agg(to_jsonb(tg) ORDER BY tg.sort_order),
    '[]'::jsonb
  )
  INTO v_transport_groups
  FROM public.offer_transport_groups tg
  WHERE tg.offer_id = v_offer.id;

  SELECT COALESCE(
    jsonb_agg(to_jsonb(ti) ORDER BY ti.sort_order),
    '[]'::jsonb
  )
  INTO v_transport_items
  FROM public.offer_transport_items ti
  JOIN public.offer_transport_groups tg ON tg.id = ti.transport_group_id
  WHERE tg.offer_id = v_offer.id;

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

-- =============================================================================
-- 9. RLS for job_subcontractors
-- =============================================================================

ALTER TABLE public.job_subcontractors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view job_subcontractors for their company jobs" ON public.job_subcontractors;
CREATE POLICY "Users can view job_subcontractors for their company jobs"
  ON public.job_subcontractors
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.jobs
      JOIN public.company_users ON company_users.company_id = jobs.company_id
      WHERE jobs.id = job_subcontractors.job_id
        AND company_users.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

DROP POLICY IF EXISTS "Users can create job_subcontractors for their company jobs" ON public.job_subcontractors;
CREATE POLICY "Users can create job_subcontractors for their company jobs"
  ON public.job_subcontractors
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.jobs
      JOIN public.company_users ON company_users.company_id = jobs.company_id
      WHERE jobs.id = job_subcontractors.job_id
        AND company_users.user_id = auth.uid()
        AND company_users.role IN ('owner', 'super_user', 'employee')
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

DROP POLICY IF EXISTS "Users can update job_subcontractors for their company jobs" ON public.job_subcontractors;
CREATE POLICY "Users can update job_subcontractors for their company jobs"
  ON public.job_subcontractors
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.jobs
      JOIN public.company_users ON company_users.company_id = jobs.company_id
      WHERE jobs.id = job_subcontractors.job_id
        AND company_users.user_id = auth.uid()
        AND company_users.role IN ('owner', 'super_user', 'employee')
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.jobs
      JOIN public.company_users ON company_users.company_id = jobs.company_id
      WHERE jobs.id = job_subcontractors.job_id
        AND company_users.user_id = auth.uid()
        AND company_users.role IN ('owner', 'super_user', 'employee')
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

DROP POLICY IF EXISTS "Users can delete job_subcontractors for their company jobs" ON public.job_subcontractors;
CREATE POLICY "Users can delete job_subcontractors for their company jobs"
  ON public.job_subcontractors
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.jobs
      JOIN public.company_users ON company_users.company_id = jobs.company_id
      WHERE jobs.id = job_subcontractors.job_id
        AND company_users.user_id = auth.uid()
        AND company_users.role IN ('owner', 'super_user', 'employee')
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_subcontractors TO authenticated;
GRANT ALL ON public.job_subcontractors TO service_role;
