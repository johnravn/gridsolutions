#!/usr/bin/env node
/**
 * When local migrations include offer_bases but remote production has not been
 * migrated yet, Supabase data dumps still use offer_id on line-item tables and
 * omit offer_basis_id on job_offers. This module prepares the local schema for
 * import, backfills offer_bases from imported offers, then restores constraints.
 */

const LEGACY_OFFER_LINE_ITEM_HEADER =
  'INSERT INTO "public"."offer_equipment_groups" ("id", "offer_id",'

/**
 * @param {string} dumpSql
 */
export function remoteDumpUsesLegacyOfferSchema(dumpSql) {
  return dumpSql.includes(LEGACY_OFFER_LINE_ITEM_HEADER)
}

/** Run before restoring a legacy remote dump into a migrated local schema. */
export function buildOfferBasisSchemaPrepSql() {
  return `-- Temporarily accept legacy offer_id columns from remote dumps
ALTER TABLE public.offer_equipment_groups ADD COLUMN IF NOT EXISTS offer_id UUID;
ALTER TABLE public.offer_crew_items ADD COLUMN IF NOT EXISTS offer_id UUID;
ALTER TABLE public.offer_transport_groups ADD COLUMN IF NOT EXISTS offer_id UUID;
ALTER TABLE public.offer_transport_items ADD COLUMN IF NOT EXISTS offer_id UUID;

ALTER TABLE public.job_offers ALTER COLUMN offer_basis_id DROP NOT NULL;
ALTER TABLE public.offer_equipment_groups ALTER COLUMN offer_basis_id DROP NOT NULL;
ALTER TABLE public.offer_crew_items ALTER COLUMN offer_basis_id DROP NOT NULL;
ALTER TABLE public.offer_transport_groups ALTER COLUMN offer_basis_id DROP NOT NULL;
ALTER TABLE public.offer_transport_items ALTER COLUMN offer_basis_id DROP NOT NULL;
`
}

/** Mirror of supabase/migrations/20260704202526_add_offer_bases.sql backfill. */
export function buildOfferBasisBackfillSql() {
  return `-- Backfill offer_bases from imported legacy job_offers + line items
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

UPDATE public.job_offers jo
SET offer_basis_id = m.basis_id
FROM _offer_basis_map m
WHERE jo.id = m.offer_id
  AND jo.offer_basis_id IS NULL;

UPDATE public.job_offers po
SET offer_basis_id = t.offer_basis_id
FROM public.job_offers t
WHERE po.source_technical_offer_id = t.id
  AND po.offer_type = 'pretty'
  AND t.offer_basis_id IS NOT NULL
  AND po.offer_basis_id IS DISTINCT FROM t.offer_basis_id;

DELETE FROM public.offer_bases ob
WHERE NOT EXISTS (
  SELECT 1 FROM public.job_offers jo WHERE jo.offer_basis_id = ob.id
);

UPDATE public.offer_equipment_groups g
SET offer_basis_id = m.basis_id
FROM _offer_basis_map m
WHERE g.offer_id = m.offer_id
  AND g.offer_basis_id IS NULL;

UPDATE public.offer_crew_items ci
SET offer_basis_id = m.basis_id
FROM _offer_basis_map m
WHERE ci.offer_id = m.offer_id
  AND ci.offer_basis_id IS NULL;

UPDATE public.offer_transport_groups tg
SET offer_basis_id = m.basis_id
FROM _offer_basis_map m
WHERE tg.offer_id = m.offer_id
  AND tg.offer_basis_id IS NULL;

UPDATE public.offer_transport_items ti
SET offer_basis_id = m.basis_id
FROM _offer_basis_map m
WHERE ti.offer_id = m.offer_id
  AND ti.offer_basis_id IS NULL;

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
`
}

/** Restore migrated schema after legacy import + backfill. */
export function buildOfferBasisSchemaFinalizeSql() {
  return `-- Drop temporary legacy columns and enforce offer_basis_id
ALTER TABLE public.offer_equipment_groups DROP COLUMN IF EXISTS offer_id;
ALTER TABLE public.offer_crew_items DROP COLUMN IF EXISTS offer_id;
ALTER TABLE public.offer_transport_groups DROP COLUMN IF EXISTS offer_id;
ALTER TABLE public.offer_transport_items DROP COLUMN IF EXISTS offer_id;

ALTER TABLE public.offer_equipment_groups ALTER COLUMN offer_basis_id SET NOT NULL;
ALTER TABLE public.offer_crew_items ALTER COLUMN offer_basis_id SET NOT NULL;
ALTER TABLE public.offer_transport_groups ALTER COLUMN offer_basis_id SET NOT NULL;
ALTER TABLE public.offer_transport_items ALTER COLUMN offer_basis_id SET NOT NULL;
ALTER TABLE public.job_offers ALTER COLUMN offer_basis_id SET NOT NULL;
`
}
