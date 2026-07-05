-- Composable content blocks for pretty offer modules

DO $$ BEGIN
  CREATE TYPE pretty_module_block_type AS ENUM (
    'subtitle',
    'description',
    'simple_list',
    'interactive_list',
    'image',
    'video',
    'link'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS public.pretty_offer_module_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID NOT NULL REFERENCES public.pretty_offer_modules(id) ON DELETE CASCADE,
  block_type public.pretty_module_block_type NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  text_content TEXT,
  url TEXT,
  link_title TEXT,
  caption TEXT
);

CREATE INDEX IF NOT EXISTS idx_pretty_offer_module_blocks_module_id
  ON public.pretty_offer_module_blocks(module_id);

CREATE TABLE IF NOT EXISTS public.pretty_offer_module_block_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  block_id UUID NOT NULL REFERENCES public.pretty_offer_module_blocks(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  label TEXT NOT NULL DEFAULT '',
  summary TEXT,
  detail TEXT
);

CREATE INDEX IF NOT EXISTS idx_pretty_offer_module_block_items_block_id
  ON public.pretty_offer_module_block_items(block_id);

ALTER TABLE public.pretty_offer_module_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pretty_offer_module_block_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Company members can manage pretty offer module blocks" ON public.pretty_offer_module_blocks;
CREATE POLICY "Company members can manage pretty offer module blocks"
ON public.pretty_offer_module_blocks
FOR ALL
USING (
  module_id IN (
    SELECT mod.id FROM public.pretty_offer_modules mod
    JOIN public.job_offers o ON mod.offer_id = o.id
    JOIN public.company_users cu ON o.company_id = cu.company_id
    WHERE cu.user_id = auth.uid()
  )
)
WITH CHECK (
  module_id IN (
    SELECT mod.id FROM public.pretty_offer_modules mod
    JOIN public.job_offers o ON mod.offer_id = o.id
    JOIN public.company_users cu ON o.company_id = cu.company_id
    WHERE cu.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Company members can manage pretty offer module block items" ON public.pretty_offer_module_block_items;
CREATE POLICY "Company members can manage pretty offer module block items"
ON public.pretty_offer_module_block_items
FOR ALL
USING (
  block_id IN (
    SELECT b.id FROM public.pretty_offer_module_blocks b
    JOIN public.pretty_offer_modules mod ON b.module_id = mod.id
    JOIN public.job_offers o ON mod.offer_id = o.id
    JOIN public.company_users cu ON o.company_id = cu.company_id
    WHERE cu.user_id = auth.uid()
  )
)
WITH CHECK (
  block_id IN (
    SELECT b.id FROM public.pretty_offer_module_blocks b
    JOIN public.pretty_offer_modules mod ON b.module_id = mod.id
    JOIN public.job_offers o ON mod.offer_id = o.id
    JOIN public.company_users cu ON o.company_id = cu.company_id
    WHERE cu.user_id = auth.uid()
  )
);

-- Backfill subtitle column into subtitle blocks
INSERT INTO public.pretty_offer_module_blocks (module_id, block_type, sort_order, text_content)
SELECT m.id, 'subtitle'::public.pretty_module_block_type, 0, m.subtitle
FROM public.pretty_offer_modules m
WHERE m.subtitle IS NOT NULL AND trim(m.subtitle) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM public.pretty_offer_module_blocks b
    WHERE b.module_id = m.id AND b.block_type = 'subtitle'
  );

-- Backfill media rows into image/video/link blocks
INSERT INTO public.pretty_offer_module_blocks (
  module_id,
  block_type,
  sort_order,
  url,
  link_title,
  caption
)
SELECT
  media.module_id,
  media.media_type::text::public.pretty_module_block_type,
  media.sort_order + CASE
    WHEN m.subtitle IS NOT NULL AND trim(m.subtitle) <> '' THEN 1
    ELSE 0
  END,
  media.url,
  media.title,
  media.caption
FROM public.pretty_offer_module_media media
JOIN public.pretty_offer_modules m ON m.id = media.module_id
WHERE NOT EXISTS (
  SELECT 1 FROM public.pretty_offer_module_blocks b
  WHERE b.module_id = media.module_id
    AND b.block_type = media.media_type::text::public.pretty_module_block_type
    AND b.url IS NOT DISTINCT FROM media.url
    AND b.sort_order = media.sort_order + CASE
      WHEN m.subtitle IS NOT NULL AND trim(m.subtitle) <> '' THEN 1
      ELSE 0
    END
);
