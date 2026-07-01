-- Pretty offer modular system: modules, subcontractor quotes, category mappings, media

-- Enums
DO $$ BEGIN
  CREATE TYPE pretty_module_basis_type AS ENUM ('manual', 'subcontractor', 'technical');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE pretty_allocation_mode AS ENUM ('percent', 'amount');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE pretty_category_type AS ENUM ('equipment_group', 'crew_category', 'transport_group');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE pretty_module_media_type AS ENUM ('image', 'video', 'link');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Link pretty offer to source technical offer for category auto-split
ALTER TABLE public.job_offers
  ADD COLUMN IF NOT EXISTS source_technical_offer_id UUID REFERENCES public.job_offers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_job_offers_source_technical_offer_id
  ON public.job_offers(source_technical_offer_id);

-- Modules
CREATE TABLE IF NOT EXISTS public.pretty_offer_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id UUID NOT NULL REFERENCES public.job_offers(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  subtitle TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  basis_type public.pretty_module_basis_type NOT NULL DEFAULT 'manual',
  display_price NUMERIC(12,2),
  show_price BOOLEAN NOT NULL DEFAULT false,
  computed_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pretty_offer_modules_offer_id
  ON public.pretty_offer_modules(offer_id);

DROP TRIGGER IF EXISTS trigger_update_pretty_offer_modules_updated_at ON public.pretty_offer_modules;
CREATE TRIGGER trigger_update_pretty_offer_modules_updated_at
BEFORE UPDATE ON public.pretty_offer_modules
FOR EACH ROW
EXECUTE FUNCTION public.update_job_offers_updated_at();

-- Manual input fields per module
CREATE TABLE IF NOT EXISTS public.pretty_offer_module_manual_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID NOT NULL REFERENCES public.pretty_offer_modules(id) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT '',
  value TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_pretty_offer_module_manual_fields_module_id
  ON public.pretty_offer_module_manual_fields(module_id);

-- Subcontractor quotes (offer-level)
CREATE TABLE IF NOT EXISTS public.pretty_offer_subcontractor_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id UUID NOT NULL REFERENCES public.job_offers(id) ON DELETE CASCADE,
  vendor_name TEXT NOT NULL DEFAULT '',
  note TEXT,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  pdf_path TEXT,
  pdf_filename TEXT,
  mime_type TEXT,
  size_bytes BIGINT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pretty_offer_subcontractor_quotes_offer_id
  ON public.pretty_offer_subcontractor_quotes(offer_id);

-- Allocations from subcontractor quotes to modules
CREATE TABLE IF NOT EXISTS public.pretty_offer_subcontractor_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES public.pretty_offer_subcontractor_quotes(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES public.pretty_offer_modules(id) ON DELETE CASCADE,
  allocation_mode public.pretty_allocation_mode NOT NULL DEFAULT 'percent',
  allocation_value NUMERIC(12,4) NOT NULL DEFAULT 0,
  CONSTRAINT uq_pretty_subcontractor_allocations_quote_module UNIQUE (quote_id, module_id)
);

CREATE INDEX IF NOT EXISTS idx_pretty_offer_subcontractor_allocations_quote_id
  ON public.pretty_offer_subcontractor_allocations(quote_id);

CREATE INDEX IF NOT EXISTS idx_pretty_offer_subcontractor_allocations_module_id
  ON public.pretty_offer_subcontractor_allocations(module_id);

-- Technical offer category mappings per module
CREATE TABLE IF NOT EXISTS public.pretty_offer_module_category_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID NOT NULL REFERENCES public.pretty_offer_modules(id) ON DELETE CASCADE,
  category_type public.pretty_category_type NOT NULL,
  category_key TEXT NOT NULL,
  CONSTRAINT uq_pretty_module_category_mapping UNIQUE (module_id, category_type, category_key)
);

CREATE INDEX IF NOT EXISTS idx_pretty_offer_module_category_mappings_module_id
  ON public.pretty_offer_module_category_mappings(module_id);

-- Customer-facing media per module
CREATE TABLE IF NOT EXISTS public.pretty_offer_module_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID NOT NULL REFERENCES public.pretty_offer_modules(id) ON DELETE CASCADE,
  media_type public.pretty_module_media_type NOT NULL DEFAULT 'image',
  url TEXT NOT NULL,
  title TEXT,
  caption TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_pretty_offer_module_media_module_id
  ON public.pretty_offer_module_media(module_id);

-- RLS
ALTER TABLE public.pretty_offer_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pretty_offer_module_manual_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pretty_offer_subcontractor_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pretty_offer_subcontractor_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pretty_offer_module_category_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pretty_offer_module_media ENABLE ROW LEVEL SECURITY;

-- Helper: company access via offer
DROP POLICY IF EXISTS "Company members can manage pretty offer modules" ON public.pretty_offer_modules;
CREATE POLICY "Company members can manage pretty offer modules"
ON public.pretty_offer_modules
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

DROP POLICY IF EXISTS "Company members can manage pretty offer module manual fields" ON public.pretty_offer_module_manual_fields;
CREATE POLICY "Company members can manage pretty offer module manual fields"
ON public.pretty_offer_module_manual_fields
FOR ALL
USING (
  module_id IN (
    SELECT m.id FROM public.pretty_offer_modules m
    JOIN public.job_offers o ON m.offer_id = o.id
    JOIN public.company_users cu ON o.company_id = cu.company_id
    WHERE cu.user_id = auth.uid()
  )
)
WITH CHECK (
  module_id IN (
    SELECT m.id FROM public.pretty_offer_modules m
    JOIN public.job_offers o ON m.offer_id = o.id
    JOIN public.company_users cu ON o.company_id = cu.company_id
    WHERE cu.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Company members can manage pretty offer subcontractor quotes" ON public.pretty_offer_subcontractor_quotes;
CREATE POLICY "Company members can manage pretty offer subcontractor quotes"
ON public.pretty_offer_subcontractor_quotes
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

DROP POLICY IF EXISTS "Company members can manage pretty offer subcontractor allocations" ON public.pretty_offer_subcontractor_allocations;
CREATE POLICY "Company members can manage pretty offer subcontractor allocations"
ON public.pretty_offer_subcontractor_allocations
FOR ALL
USING (
  quote_id IN (
    SELECT q.id FROM public.pretty_offer_subcontractor_quotes q
    JOIN public.job_offers o ON q.offer_id = o.id
    JOIN public.company_users cu ON o.company_id = cu.company_id
    WHERE cu.user_id = auth.uid()
  )
)
WITH CHECK (
  quote_id IN (
    SELECT q.id FROM public.pretty_offer_subcontractor_quotes q
    JOIN public.job_offers o ON q.offer_id = o.id
    JOIN public.company_users cu ON o.company_id = cu.company_id
    WHERE cu.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Company members can manage pretty offer module category mappings" ON public.pretty_offer_module_category_mappings;
CREATE POLICY "Company members can manage pretty offer module category mappings"
ON public.pretty_offer_module_category_mappings
FOR ALL
USING (
  module_id IN (
    SELECT m.id FROM public.pretty_offer_modules m
    JOIN public.job_offers o ON m.offer_id = o.id
    JOIN public.company_users cu ON o.company_id = cu.company_id
    WHERE cu.user_id = auth.uid()
  )
)
WITH CHECK (
  module_id IN (
    SELECT m.id FROM public.pretty_offer_modules m
    JOIN public.job_offers o ON m.offer_id = o.id
    JOIN public.company_users cu ON o.company_id = cu.company_id
    WHERE cu.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Company members can manage pretty offer module media" ON public.pretty_offer_module_media;
CREATE POLICY "Company members can manage pretty offer module media"
ON public.pretty_offer_module_media
FOR ALL
USING (
  module_id IN (
    SELECT m.id FROM public.pretty_offer_modules m
    JOIN public.job_offers o ON m.offer_id = o.id
    JOIN public.company_users cu ON o.company_id = cu.company_id
    WHERE cu.user_id = auth.uid()
  )
)
WITH CHECK (
  module_id IN (
    SELECT m.id FROM public.pretty_offer_modules m
    JOIN public.job_offers o ON m.offer_id = o.id
    JOIN public.company_users cu ON o.company_id = cu.company_id
    WHERE cu.user_id = auth.uid()
  )
);

-- Storage bucket for subcontractor quote PDFs (private, company-scoped paths: {company_id}/{offer_id}/{filename})
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'pretty_offer_quotes',
  'pretty_offer_quotes',
  false,
  52428800,
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Company members can manage pretty offer quote PDFs" ON storage.objects;
CREATE POLICY "Company members can manage pretty offer quote PDFs"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'pretty_offer_quotes' AND
  EXISTS (
    SELECT 1
    FROM public.company_users cu
    WHERE cu.user_id = auth.uid()
      AND cu.company_id = (storage.foldername(name))[1]::uuid
  )
)
WITH CHECK (
  bucket_id = 'pretty_offer_quotes' AND
  EXISTS (
    SELECT 1
    FROM public.company_users cu
    WHERE cu.user_id = auth.uid()
      AND cu.company_id = (storage.foldername(name))[1]::uuid
  )
);
