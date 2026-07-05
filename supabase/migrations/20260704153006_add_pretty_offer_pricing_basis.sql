-- Pretty offer pricing basis refactor: centralized basises with splittable costs

-- ---------------------------------------------------------------------------
-- 1. New enum
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.pretty_pricing_basis_type AS ENUM ('technical', 'subcontractor', 'custom');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Job-scoped subcontractor quote versions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.job_subcontractor_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  job_subcontractor_id UUID NOT NULL REFERENCES public.job_subcontractors(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  note TEXT,
  pdf_path TEXT,
  pdf_filename TEXT,
  mime_type TEXT,
  size_bytes BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_job_subcontractor_quotes_version UNIQUE (job_subcontractor_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_job_subcontractor_quotes_job_id
  ON public.job_subcontractor_quotes(job_id);

CREATE INDEX IF NOT EXISTS idx_job_subcontractor_quotes_job_subcontractor_id
  ON public.job_subcontractor_quotes(job_subcontractor_id);

-- ---------------------------------------------------------------------------
-- 3. Pretty offer pricing basises + splits
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pretty_offer_pricing_bases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id UUID NOT NULL REFERENCES public.job_offers(id) ON DELETE CASCADE,
  basis_type public.pretty_pricing_basis_type NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  source_technical_offer_id UUID REFERENCES public.job_offers(id) ON DELETE SET NULL,
  job_subcontractor_quote_id UUID REFERENCES public.job_subcontractor_quotes(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pretty_offer_pricing_bases_offer_id
  ON public.pretty_offer_pricing_bases(offer_id);

CREATE INDEX IF NOT EXISTS idx_pretty_offer_pricing_bases_source_technical
  ON public.pretty_offer_pricing_bases(source_technical_offer_id);

CREATE INDEX IF NOT EXISTS idx_pretty_offer_pricing_bases_job_sub_quote
  ON public.pretty_offer_pricing_bases(job_subcontractor_quote_id);

CREATE TABLE IF NOT EXISTS public.pretty_offer_pricing_basis_splits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  basis_id UUID NOT NULL REFERENCES public.pretty_offer_pricing_bases(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES public.pretty_offer_modules(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  category_type public.pretty_category_type,
  category_key TEXT
);

CREATE INDEX IF NOT EXISTS idx_pretty_offer_pricing_basis_splits_basis_id
  ON public.pretty_offer_pricing_basis_splits(basis_id);

CREATE INDEX IF NOT EXISTS idx_pretty_offer_pricing_basis_splits_module_id
  ON public.pretty_offer_pricing_basis_splits(module_id);

-- ---------------------------------------------------------------------------
-- 4. Data migration from legacy model
-- ---------------------------------------------------------------------------

-- 4a. Ensure job_subcontractors exist for offer-scoped quotes with customer_id
INSERT INTO public.job_subcontractors (job_id, customer_id, notes)
SELECT DISTINCT o.job_id, q.customer_id, 'Migrated from pretty offer quote'
FROM public.pretty_offer_subcontractor_quotes q
JOIN public.job_offers o ON o.id = q.offer_id
WHERE q.customer_id IS NOT NULL
ON CONFLICT (job_id, customer_id) DO NOTHING;

-- 4b. Migrate offer-scoped subcontractor quotes to job_subcontractor_quotes
INSERT INTO public.job_subcontractor_quotes (
  id,
  job_id,
  job_subcontractor_id,
  version_number,
  total_amount,
  note,
  pdf_path,
  pdf_filename,
  mime_type,
  size_bytes,
  created_at
)
SELECT
  q.id,
  o.job_id,
  js.id,
  ROW_NUMBER() OVER (
    PARTITION BY js.id
    ORDER BY q.created_at, q.sort_order, q.id
  )::INTEGER,
  q.total_amount,
  COALESCE(q.note, q.vendor_name),
  q.pdf_path,
  q.pdf_filename,
  q.mime_type,
  q.size_bytes,
  COALESCE(q.created_at, NOW())
FROM public.pretty_offer_subcontractor_quotes q
JOIN public.job_offers o ON o.id = q.offer_id
JOIN public.job_subcontractors js
  ON js.job_id = o.job_id
 AND js.customer_id = q.customer_id
WHERE q.customer_id IS NOT NULL
ON CONFLICT (id) DO NOTHING;

-- 4c. Technical pricing basises from category mappings
INSERT INTO public.pretty_offer_pricing_bases (
  id,
  offer_id,
  basis_type,
  title,
  sort_order,
  source_technical_offer_id
)
SELECT
  gen_random_uuid(),
  o.id,
  'technical'::public.pretty_pricing_basis_type,
  'Technical offer',
  0,
  o.source_technical_offer_id
FROM public.job_offers o
WHERE o.offer_type = 'pretty'
  AND EXISTS (
    SELECT 1
    FROM public.pretty_offer_modules m
    JOIN public.pretty_offer_module_category_mappings cm ON cm.module_id = m.id
    WHERE m.offer_id = o.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.pretty_offer_pricing_bases pb WHERE pb.offer_id = o.id
  );

INSERT INTO public.pretty_offer_pricing_basis_splits (
  basis_id,
  module_id,
  title,
  amount,
  sort_order,
  category_type,
  category_key
)
SELECT
  pb.id,
  cm.module_id,
  CASE cm.category_type
    WHEN 'equipment_group' THEN 'Equipment: ' || cm.category_key
    WHEN 'crew_category' THEN 'Crew: ' || cm.category_key
    WHEN 'transport_group' THEN 'Transport: ' || cm.category_key
    ELSE cm.category_key
  END,
  0,
  ROW_NUMBER() OVER (PARTITION BY pb.id ORDER BY cm.id)::INTEGER - 1,
  cm.category_type,
  cm.category_key
FROM public.pretty_offer_module_category_mappings cm
JOIN public.pretty_offer_modules m ON m.id = cm.module_id
JOIN public.pretty_offer_pricing_bases pb
  ON pb.offer_id = m.offer_id
 AND pb.basis_type = 'technical'
WHERE NOT EXISTS (
  SELECT 1 FROM public.pretty_offer_pricing_basis_splits s
  WHERE s.basis_id = pb.id AND s.module_id = cm.module_id
    AND s.category_type = cm.category_type
    AND s.category_key = cm.category_key
);

-- 4d. Custom pricing basises from manual fields
INSERT INTO public.pretty_offer_pricing_bases (
  offer_id,
  basis_type,
  title,
  sort_order
)
SELECT
  m.offer_id,
  'custom'::public.pretty_pricing_basis_type,
  COALESCE(NULLIF(m.title, ''), 'Custom'),
  m.sort_order + 100
FROM public.pretty_offer_modules m
WHERE EXISTS (
  SELECT 1 FROM public.pretty_offer_module_manual_fields f WHERE f.module_id = m.id
)
AND NOT EXISTS (
  SELECT 1
  FROM public.pretty_offer_pricing_bases pb
  WHERE pb.offer_id = m.offer_id
    AND pb.basis_type = 'custom'
    AND pb.title = COALESCE(NULLIF(m.title, ''), 'Custom')
);

INSERT INTO public.pretty_offer_pricing_basis_splits (
  basis_id,
  module_id,
  title,
  amount,
  sort_order
)
SELECT
  pb.id,
  f.module_id,
  COALESCE(NULLIF(f.label, ''), 'Line'),
  CASE
    WHEN NULLIF(TRIM(f.value), '') IS NULL THEN 0
    ELSE COALESCE(
      NULLIF(
        regexp_replace(TRIM(f.value), '[^0-9.,-]', '', 'g'),
        ''
      )::NUMERIC,
      0
    )
  END,
  f.sort_order
FROM public.pretty_offer_module_manual_fields f
JOIN public.pretty_offer_modules m ON m.id = f.module_id
JOIN public.pretty_offer_pricing_bases pb
  ON pb.offer_id = m.offer_id
 AND pb.basis_type = 'custom'
 AND pb.title = COALESCE(NULLIF(m.title, ''), 'Custom')
WHERE NOT EXISTS (
  SELECT 1 FROM public.pretty_offer_pricing_basis_splits s
  WHERE s.basis_id = pb.id AND s.module_id = f.module_id AND s.sort_order = f.sort_order
);

-- 4e. Subcontractor pricing basises from migrated quotes
INSERT INTO public.pretty_offer_pricing_bases (
  offer_id,
  basis_type,
  title,
  sort_order,
  job_subcontractor_quote_id
)
SELECT
  q.offer_id,
  'subcontractor'::public.pretty_pricing_basis_type,
  COALESCE(NULLIF(q.vendor_name, ''), 'Subcontractor quote'),
  q.sort_order,
  jsq.id
FROM public.pretty_offer_subcontractor_quotes q
JOIN public.job_subcontractor_quotes jsq ON jsq.id = q.id
WHERE NOT EXISTS (
  SELECT 1
  FROM public.pretty_offer_pricing_bases pb
  WHERE pb.offer_id = q.offer_id
    AND pb.job_subcontractor_quote_id = jsq.id
);

INSERT INTO public.pretty_offer_pricing_basis_splits (
  basis_id,
  module_id,
  title,
  amount,
  sort_order
)
SELECT
  pb.id,
  a.module_id,
  COALESCE(NULLIF(m.title, ''), 'Allocation'),
  CASE
    WHEN a.allocation_mode = 'amount' THEN a.allocation_value
    ELSE (q.total_amount * a.allocation_value / 100.0)
  END,
  ROW_NUMBER() OVER (PARTITION BY pb.id ORDER BY a.id)::INTEGER - 1
FROM public.pretty_offer_subcontractor_allocations a
JOIN public.pretty_offer_subcontractor_quotes q ON q.id = a.quote_id
JOIN public.pretty_offer_pricing_bases pb
  ON pb.offer_id = q.offer_id
 AND pb.job_subcontractor_quote_id = q.id
JOIN public.pretty_offer_modules m ON m.id = a.module_id
WHERE a.allocation_value > 0
AND NOT EXISTS (
  SELECT 1 FROM public.pretty_offer_pricing_basis_splits s
  WHERE s.basis_id = pb.id AND s.module_id = a.module_id
);

-- ---------------------------------------------------------------------------
-- 5. Drop legacy tables and columns
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS public.pretty_offer_subcontractor_allocations CASCADE;
DROP TABLE IF EXISTS public.pretty_offer_subcontractor_quotes CASCADE;
DROP TABLE IF EXISTS public.pretty_offer_module_category_mappings CASCADE;
DROP TABLE IF EXISTS public.pretty_offer_module_manual_fields CASCADE;

ALTER TABLE public.pretty_offer_modules
  DROP COLUMN IF EXISTS basis_type;

DROP TYPE IF EXISTS public.pretty_module_basis_type;
DROP TYPE IF EXISTS public.pretty_allocation_mode;

-- ---------------------------------------------------------------------------
-- 6. RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.job_subcontractor_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pretty_offer_pricing_bases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pretty_offer_pricing_basis_splits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Company members can manage job subcontractor quotes" ON public.job_subcontractor_quotes;
CREATE POLICY "Company members can manage job subcontractor quotes"
ON public.job_subcontractor_quotes
FOR ALL
USING (
  job_id IN (
    SELECT j.id FROM public.jobs j
    JOIN public.company_users cu ON j.company_id = cu.company_id
    WHERE cu.user_id = auth.uid()
  )
)
WITH CHECK (
  job_id IN (
    SELECT j.id FROM public.jobs j
    JOIN public.company_users cu ON j.company_id = cu.company_id
    WHERE cu.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Company members can manage pretty offer pricing bases" ON public.pretty_offer_pricing_bases;
CREATE POLICY "Company members can manage pretty offer pricing bases"
ON public.pretty_offer_pricing_bases
FOR ALL
USING (
  offer_id IN (
    SELECT o.id FROM public.job_offers o
    JOIN public.company_users cu ON o.company_id = cu.company_id
    WHERE cu.user_id = auth.uid()
  )
)
WITH CHECK (
  offer_id IN (
    SELECT o.id FROM public.job_offers o
    JOIN public.company_users cu ON o.company_id = cu.company_id
    WHERE cu.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Company members can manage pretty offer pricing basis splits" ON public.pretty_offer_pricing_basis_splits;
CREATE POLICY "Company members can manage pretty offer pricing basis splits"
ON public.pretty_offer_pricing_basis_splits
FOR ALL
USING (
  basis_id IN (
    SELECT pb.id FROM public.pretty_offer_pricing_bases pb
    JOIN public.job_offers o ON pb.offer_id = o.id
    JOIN public.company_users cu ON o.company_id = cu.company_id
    WHERE cu.user_id = auth.uid()
  )
)
WITH CHECK (
  basis_id IN (
    SELECT pb.id FROM public.pretty_offer_pricing_bases pb
    JOIN public.job_offers o ON pb.offer_id = o.id
    JOIN public.company_users cu ON o.company_id = cu.company_id
    WHERE cu.user_id = auth.uid()
  )
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_subcontractor_quotes TO authenticated;
GRANT ALL ON public.job_subcontractor_quotes TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pretty_offer_pricing_bases TO authenticated;
GRANT ALL ON public.pretty_offer_pricing_bases TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pretty_offer_pricing_basis_splits TO authenticated;
GRANT ALL ON public.pretty_offer_pricing_basis_splits TO service_role;

-- ---------------------------------------------------------------------------
-- 7. Demo company mode restrictive policies for new tables
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['job_subcontractor_quotes']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS demo_company_no_insert ON public.%I', tbl);
    EXECUTE format(
      'CREATE POLICY demo_company_no_insert ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (NOT public.demo_company_blocks_job_mutation(job_id))',
      tbl
    );
    EXECUTE format('DROP POLICY IF EXISTS demo_company_no_update ON public.%I', tbl);
    EXECUTE format(
      'CREATE POLICY demo_company_no_update ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING (NOT public.demo_company_blocks_job_mutation(job_id)) WITH CHECK (NOT public.demo_company_blocks_job_mutation(job_id))',
      tbl
    );
    EXECUTE format('DROP POLICY IF EXISTS demo_company_no_delete ON public.%I', tbl);
    EXECUTE format(
      'CREATE POLICY demo_company_no_delete ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING (NOT public.demo_company_blocks_job_mutation(job_id))',
      tbl
    );
  END LOOP;
END $$;

DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['pretty_offer_pricing_bases']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS demo_company_no_insert ON public.%I', tbl);
    EXECUTE format(
      'CREATE POLICY demo_company_no_insert ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (NOT public.demo_company_blocks_offer_mutation(offer_id))',
      tbl
    );
    EXECUTE format('DROP POLICY IF EXISTS demo_company_no_update ON public.%I', tbl);
    EXECUTE format(
      'CREATE POLICY demo_company_no_update ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING (NOT public.demo_company_blocks_offer_mutation(offer_id)) WITH CHECK (NOT public.demo_company_blocks_offer_mutation(offer_id))',
      tbl
    );
    EXECUTE format('DROP POLICY IF EXISTS demo_company_no_delete ON public.%I', tbl);
    EXECUTE format(
      'CREATE POLICY demo_company_no_delete ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING (NOT public.demo_company_blocks_offer_mutation(offer_id))',
      tbl
    );
  END LOOP;
END $$;

DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['pretty_offer_pricing_basis_splits']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS demo_company_no_insert ON public.%I', tbl);
    EXECUTE format(
      'CREATE POLICY demo_company_no_insert ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (NOT public.demo_company_blocks_module_mutation(module_id))',
      tbl
    );
    EXECUTE format('DROP POLICY IF EXISTS demo_company_no_update ON public.%I', tbl);
    EXECUTE format(
      'CREATE POLICY demo_company_no_update ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING (NOT public.demo_company_blocks_module_mutation(module_id)) WITH CHECK (NOT public.demo_company_blocks_module_mutation(module_id))',
      tbl
    );
    EXECUTE format('DROP POLICY IF EXISTS demo_company_no_delete ON public.%I', tbl);
    EXECUTE format(
      'CREATE POLICY demo_company_no_delete ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING (NOT public.demo_company_blocks_module_mutation(module_id))',
      tbl
    );
  END LOOP;
END $$;
