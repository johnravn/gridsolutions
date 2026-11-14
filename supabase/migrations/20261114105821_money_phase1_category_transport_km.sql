-- Money Phase 1: ledger categories, transport cost rate, job km driven.
-- Ledger amounts are ex VAT (application convention; see job-money-tab-plan).

-- Confirmed money line category (optional; income often null/other)
ALTER TABLE job_money_items
  ADD COLUMN IF NOT EXISTS category TEXT;

ALTER TABLE job_money_items
  DROP CONSTRAINT IF EXISTS job_money_items_category_check;

ALTER TABLE job_money_items
  ADD CONSTRAINT job_money_items_category_check
  CHECK (
    category IS NULL
    OR category IN ('crew', 'equipment', 'conta', 'transport', 'other')
  );

COMMENT ON COLUMN job_money_items.category IS
  'Optional cost/income category: crew, equipment, conta, transport, other. Null allowed for legacy rows.';

-- Company operational transport cost (NOK per km). Separate from sell-side vehicle_distance_rate.
ALTER TABLE company_expansions
  ADD COLUMN IF NOT EXISTS transport_cost_per_km NUMERIC(12, 2) NOT NULL DEFAULT 5;

ALTER TABLE company_expansions
  DROP CONSTRAINT IF EXISTS company_expansions_transport_cost_per_km_check;

ALTER TABLE company_expansions
  ADD CONSTRAINT company_expansions_transport_cost_per_km_check
  CHECK (transport_cost_per_km >= 0);

COMMENT ON COLUMN company_expansions.transport_cost_per_km IS
  'Operational transport cost in NOK per km for Money tab (default 5). Not the offer sell-side distance rate.';

-- Actual km driven on the job (nullable until entered; Phase 2 UX)
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS transport_km_driven NUMERIC(12, 2);

ALTER TABLE jobs
  DROP CONSTRAINT IF EXISTS jobs_transport_km_driven_check;

ALTER TABLE jobs
  ADD CONSTRAINT jobs_transport_km_driven_check
  CHECK (transport_km_driven IS NULL OR transport_km_driven >= 0);

COMMENT ON COLUMN jobs.transport_km_driven IS
  'Km driven for the job; Money transport cost = km × company_expansions.transport_cost_per_km.';
