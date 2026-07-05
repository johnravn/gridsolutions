-- File upload block for pretty offer modules (PDFs and documents)

DO $$ BEGIN
  ALTER TYPE public.pretty_module_block_type ADD VALUE 'file_upload';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Allow PDF uploads in pretty offer media bucket
UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/mp4',
  'video/webm',
  'application/pdf'
]
WHERE id = 'pretty_offer_media';
