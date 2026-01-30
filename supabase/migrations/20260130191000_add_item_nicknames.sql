-- Add nicknames to items for search
ALTER TABLE public.items
ADD COLUMN IF NOT EXISTS nicknames text;

-- Update create_item_with_price to accept nicknames
DROP FUNCTION IF EXISTS public.create_item_with_price(
  uuid,
  text,
  uuid,
  uuid,
  text,
  boolean,
  integer,
  boolean,
  text,
  numeric,
  timestamptz
);

CREATE OR REPLACE FUNCTION public.create_item_with_price(
  p_company_id uuid,
  p_name text,
  p_category_id uuid DEFAULT NULL,
  p_brand_id uuid DEFAULT NULL,
  p_model text DEFAULT NULL,
  p_allow_individual_booking boolean DEFAULT true,
  p_total_quantity integer DEFAULT 0,
  p_active boolean DEFAULT true,
  p_notes text DEFAULT NULL,
  p_price numeric DEFAULT NULL,
  p_effective_from timestamptz DEFAULT NULL,
  p_nicknames text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
  v_item_id uuid;
begin
  insert into public.items (
    company_id,
    name,
    category_id,
    brand_id,
    model,
    allow_individual_booking,
    total_quantity,
    active,
    notes,
    nicknames
  ) values (
    p_company_id,
    p_name,
    p_category_id,
    p_brand_id,
    p_model,
    p_allow_individual_booking,
    coalesce(p_total_quantity, 0),
    p_active,
    p_notes,
    p_nicknames
  )
  returning id into v_item_id;

  if p_price is not null then
    insert into public.item_price_history (
      company_id,
      item_id,
      amount,
      effective_from,
      set_by
    ) values (
      p_company_id,
      v_item_id,
      p_price,
      coalesce(p_effective_from, now()),
      auth.uid()
    );
  end if;

  return v_item_id;
end;
$$;

GRANT ALL ON FUNCTION public.create_item_with_price(
  uuid,
  text,
  uuid,
  uuid,
  text,
  boolean,
  integer,
  boolean,
  text,
  numeric,
  timestamptz,
  text
) TO anon;

GRANT ALL ON FUNCTION public.create_item_with_price(
  uuid,
  text,
  uuid,
  uuid,
  text,
  boolean,
  integer,
  boolean,
  text,
  numeric,
  timestamptz,
  text
) TO authenticated;

GRANT ALL ON FUNCTION public.create_item_with_price(
  uuid,
  text,
  uuid,
  uuid,
  text,
  boolean,
  integer,
  boolean,
  text,
  numeric,
  timestamptz,
  text
) TO service_role;

-- Recreate inventory_index with nicknames
DROP VIEW IF EXISTS public.inventory_index CASCADE;

CREATE VIEW public.inventory_index WITH (security_invoker='on') AS
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
  i.internally_owned,
  i.external_owner_id,
  co.name AS external_owner_name,
  i.nicknames
FROM items i
LEFT JOIN item_categories ic ON ic.id = i.category_id
LEFT JOIN item_brands ib ON ib.id = i.brand_id
LEFT JOIN item_current_price icp ON icp.item_id = i.id
LEFT JOIN customers co ON co.id = i.external_owner_id

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
  g.internally_owned,
  g.external_owner_id,
  co2.name AS external_owner_name,
  NULL::text AS nicknames
FROM item_groups g
LEFT JOIN item_categories ic2 ON ic2.id = g.category_id
LEFT JOIN groups_with_rollups gr ON gr.id = g.id
LEFT JOIN group_current_price gcp ON gcp.group_id = g.id
LEFT JOIN customers co2 ON co2.id = g.external_owner_id;
