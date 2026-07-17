-- Fix INSERT ... RETURNING on matters.
--
-- The SELECT policy used only can_view_matter(id), which re-queries matters by id.
-- During INSERT ... RETURNING, that lookup cannot see the new row yet, so PostgREST
-- .insert().select('id') fails with "new row violates row-level security policy"
-- even when the INSERT WITH CHECK would pass.
--
-- Allow creators (and the existing can_view_matter path) so RETURNING succeeds.

DROP POLICY IF EXISTS "Users can view matters for their company" ON public.matters;
CREATE POLICY "Users can view matters for their company"
  ON public.matters
  FOR SELECT
  USING (
    created_by_user_id = auth.uid()
    OR public.can_view_matter(id)
  );
