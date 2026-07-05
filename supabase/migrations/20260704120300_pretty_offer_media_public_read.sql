-- Public read for pretty offer media (paths are scoped to company/offer; used on public offer page)

UPDATE storage.buckets
SET public = true
WHERE id = 'pretty_offer_media';

DROP POLICY IF EXISTS "Public read pretty offer media" ON storage.objects;
CREATE POLICY "Public read pretty offer media"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'pretty_offer_media');
