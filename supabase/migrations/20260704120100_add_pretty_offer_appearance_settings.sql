-- Pretty offer appearance toggles for customer brand colors

ALTER TABLE public.job_offers
  ADD COLUMN IF NOT EXISTS pretty_use_customer_accent BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pretty_use_customer_background BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.job_offers.pretty_use_customer_accent IS 'When true, pretty offers use the customer brand accent color on the public page.';
COMMENT ON COLUMN public.job_offers.pretty_use_customer_background IS 'When true, pretty offers use the customer brand color for background tints on the public page.';
