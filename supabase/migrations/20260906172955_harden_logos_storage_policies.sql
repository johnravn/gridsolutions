-- Replace the logos bucket's "DEVELOPMENT ONLY" open-write policy with
-- company-scoped INSERT/UPDATE/DELETE. Public SELECT stays: offer pages,
-- emails, and the UI all use public logo URLs.
--
-- App path convention (see CompanyLogoUpload / LogoUpload):
--   companies/{company_id}/logo_{light|dark}.{png|svg}
--   customers/{company_id}/{customer_id}/logo.jpg
--
-- SVG remains allowed for company logos. They are only rendered as <img>
-- (never inlined), so script inside an SVG is not executed by the browser.

-- ---------------------------------------------------------------------------
-- Helper: company id encoded in a storage object path
-- ---------------------------------------------------------------------------
-- Other company-scoped buckets store files as {company_id}/...
-- Logos nest the company id in the second folder.
CREATE OR REPLACE FUNCTION public.storage_object_company_id(
  p_bucket_id text,
  p_name text
)
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_bucket_id = 'logos'
      AND (storage.foldername(p_name))[1] IN ('companies', 'customers')
      AND (storage.foldername(p_name))[2]
        ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    THEN (storage.foldername(p_name))[2]::uuid
    WHEN p_bucket_id IS DISTINCT FROM 'logos'
      AND (storage.foldername(p_name))[1]
        ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    THEN (storage.foldername(p_name))[1]::uuid
    ELSE NULL
  END;
$$;

COMMENT ON FUNCTION public.storage_object_company_id(text, text) IS
  'Extracts company_id from a storage object path. Logos use companies|customers/{company_id}/...; other buckets use {company_id}/...';

REVOKE ALL ON FUNCTION public.storage_object_company_id(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.storage_object_company_id(text, text)
  TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Logos: drop Dev policies, add company-scoped manage + public read
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Dev: Allow all authenticated users to manage logos"
  ON storage.objects;
DROP POLICY IF EXISTS "Dev: Allow public to view logos"
  ON storage.objects;
DROP POLICY IF EXISTS "Company members can manage logos"
  ON storage.objects;
DROP POLICY IF EXISTS "Public can view logos"
  ON storage.objects;

CREATE POLICY "Company members can manage logos"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'logos'
  AND (
    public.is_superuser((select auth.uid()))
    OR public.user_is_company_member(
      public.storage_object_company_id('logos', name),
      (select auth.uid())
    )
  )
)
WITH CHECK (
  bucket_id = 'logos'
  AND (
    public.is_superuser((select auth.uid()))
    OR public.user_is_company_member(
      public.storage_object_company_id('logos', name),
      (select auth.uid())
    )
  )
);

CREATE POLICY "Public can view logos"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'logos');

-- ---------------------------------------------------------------------------
-- Demo restrictive policies: parse logos paths correctly
-- ---------------------------------------------------------------------------
-- Previously these cast folder[1] to uuid. That throws for logos paths
-- (folder[1] is 'companies' or 'customers') and would block legitimate
-- uploads once the Dev catch-all is gone.
DROP POLICY IF EXISTS demo_company_no_storage_insert ON storage.objects;
CREATE POLICY demo_company_no_storage_insert ON storage.objects
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id NOT IN (
      'pretty_offer_media',
      'pretty_offer_quotes',
      'logos',
      'company_files',
      'vehicle_images'
    )
    OR NOT public.demo_company_blocks_mutation(
      public.storage_object_company_id(bucket_id, name)
    )
  );

DROP POLICY IF EXISTS demo_company_no_storage_update ON storage.objects;
CREATE POLICY demo_company_no_storage_update ON storage.objects
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (
    bucket_id NOT IN (
      'pretty_offer_media',
      'pretty_offer_quotes',
      'logos',
      'company_files',
      'vehicle_images'
    )
    OR NOT public.demo_company_blocks_mutation(
      public.storage_object_company_id(bucket_id, name)
    )
  )
  WITH CHECK (
    bucket_id NOT IN (
      'pretty_offer_media',
      'pretty_offer_quotes',
      'logos',
      'company_files',
      'vehicle_images'
    )
    OR NOT public.demo_company_blocks_mutation(
      public.storage_object_company_id(bucket_id, name)
    )
  );

DROP POLICY IF EXISTS demo_company_no_storage_delete ON storage.objects;
CREATE POLICY demo_company_no_storage_delete ON storage.objects
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (
    bucket_id NOT IN (
      'pretty_offer_media',
      'pretty_offer_quotes',
      'logos',
      'company_files',
      'vehicle_images'
    )
    OR NOT public.demo_company_blocks_mutation(
      public.storage_object_company_id(bucket_id, name)
    )
  );
