-- Standard subcontractor markup for pretty offer pricing (company default + per-offer override)

ALTER TABLE public.company_expansions
  ADD COLUMN IF NOT EXISTS subcontractor_markup_percent NUMERIC(5, 2);

COMMENT ON COLUMN public.company_expansions.subcontractor_markup_percent IS
  'Default markup percentage applied on top of subcontractor and custom pretty-offer pricing basises when enabled.';

ALTER TABLE public.job_offers
  ADD COLUMN IF NOT EXISTS pretty_subcontractor_markup_percent NUMERIC(5, 2);

COMMENT ON COLUMN public.job_offers.pretty_subcontractor_markup_percent IS
  'Optional per-offer override of company subcontractor_markup_percent for pretty offers. NULL uses company default.';

ALTER TABLE public.pretty_offer_pricing_bases
  ADD COLUMN IF NOT EXISTS apply_subcontractor_markup BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.pretty_offer_pricing_bases.apply_subcontractor_markup IS
  'When true, applies the effective subcontractor markup on top of split amounts for subcontractor and custom basises.';
