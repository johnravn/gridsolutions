-- Gallery block item URLs, image migration, and media storage bucket

ALTER TABLE public.pretty_offer_module_block_items
  ADD COLUMN IF NOT EXISTS url TEXT;

-- Migrate existing single-image blocks to gallery blocks with one item
INSERT INTO public.pretty_offer_module_block_items (block_id, sort_order, label, summary, url)
SELECT
  b.id,
  0,
  '',
  b.caption,
  b.url
FROM public.pretty_offer_module_blocks b
WHERE b.block_type = 'image'
  AND b.url IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.pretty_offer_module_block_items bi WHERE bi.block_id = b.id
  );

UPDATE public.pretty_offer_module_blocks
SET block_type = 'gallery', url = NULL, caption = NULL
WHERE block_type = 'image';

-- Storage bucket for pretty offer images and videos (private, company-scoped paths)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'pretty_offer_media',
  'pretty_offer_media',
  false,
  26214400,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Company members can manage pretty offer media" ON storage.objects;
CREATE POLICY "Company members can manage pretty offer media"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'pretty_offer_media' AND
  EXISTS (
    SELECT 1
    FROM public.company_users cu
    WHERE cu.user_id = auth.uid()
      AND cu.company_id = (storage.foldername(name))[1]::uuid
  )
)
WITH CHECK (
  bucket_id = 'pretty_offer_media' AND
  EXISTS (
    SELECT 1
    FROM public.company_users cu
    WHERE cu.user_id = auth.uid()
      AND cu.company_id = (storage.foldername(name))[1]::uuid
  )
);

-- Public read via signed URLs only (no anon policy); authenticated company members manage files.
