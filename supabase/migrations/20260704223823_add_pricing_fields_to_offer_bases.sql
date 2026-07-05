-- Move shared pricing settings from offers to offer bases.

ALTER TABLE public.offer_bases
  ADD COLUMN IF NOT EXISTS days_of_use INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS discount_percent NUMERIC(5, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vat_percent INTEGER NOT NULL DEFAULT 25;

ALTER TABLE public.offer_bases
  DROP CONSTRAINT IF EXISTS offer_bases_days_of_use_check;

ALTER TABLE public.offer_bases
  ADD CONSTRAINT offer_bases_days_of_use_check CHECK (days_of_use >= 1);

ALTER TABLE public.offer_bases
  DROP CONSTRAINT IF EXISTS offer_bases_discount_percent_check;

ALTER TABLE public.offer_bases
  ADD CONSTRAINT offer_bases_discount_percent_check CHECK (
    discount_percent >= 0::numeric AND discount_percent <= 100::numeric
  );

ALTER TABLE public.offer_bases
  DROP CONSTRAINT IF EXISTS offer_bases_vat_percent_check;

ALTER TABLE public.offer_bases
  ADD CONSTRAINT offer_bases_vat_percent_check CHECK (vat_percent = ANY (ARRAY[0, 25]));

-- Backfill from the latest linked offer per basis.
UPDATE public.offer_bases ob
SET
  days_of_use = sub.days_of_use,
  discount_percent = sub.discount_percent,
  vat_percent = sub.vat_percent
FROM (
  SELECT DISTINCT ON (jo.offer_basis_id)
    jo.offer_basis_id,
    jo.days_of_use,
    jo.discount_percent,
    jo.vat_percent
  FROM public.job_offers jo
  WHERE jo.offer_basis_id IS NOT NULL
  ORDER BY jo.offer_basis_id, jo.version_number DESC, jo.created_at DESC
) sub
WHERE ob.id = sub.offer_basis_id;

-- Bases without offers: derive days from the job schedule.
UPDATE public.offer_bases ob
SET days_of_use = GREATEST(
  1,
  CEIL(
    EXTRACT(EPOCH FROM (j.end_at - j.start_at)) / 86400.0
  )::integer
)
FROM public.jobs j
WHERE j.id = ob.job_id
  AND j.start_at IS NOT NULL
  AND j.end_at IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.job_offers jo
    WHERE jo.offer_basis_id = ob.id
  );

COMMENT ON COLUMN public.offer_bases.days_of_use IS
  'Days of use for equipment rental pricing on this basis.';
COMMENT ON COLUMN public.offer_bases.discount_percent IS
  'Equipment discount percentage shared by offers on this basis.';
COMMENT ON COLUMN public.offer_bases.vat_percent IS
  'VAT percentage shared by offers on this basis.';
