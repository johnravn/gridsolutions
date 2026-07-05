-- Restrict freelancer matter visibility to creator/recipient rules that match the app inbox.
-- Internal roles (owner, employee, super_user) retain full company-wide access.

CREATE OR REPLACE FUNCTION public.can_view_matter(p_matter_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.matters m
    WHERE m.id = p_matter_id
      AND (
        public.is_superuser(auth.uid())
        OR EXISTS (
          SELECT 1
          FROM public.company_users cu
          WHERE cu.company_id = m.company_id
            AND cu.user_id = auth.uid()
            AND cu.role IN ('owner', 'employee', 'super_user')
        )
        OR (
          EXISTS (
            SELECT 1
            FROM public.company_users cu
            WHERE cu.company_id = m.company_id
              AND cu.user_id = auth.uid()
              AND cu.role = 'freelancer'
          )
          AND (
            (
              m.matter_type = 'crew_invite'
              AND EXISTS (
                SELECT 1
                FROM public.matter_recipients mr
                WHERE mr.matter_id = m.id
                  AND mr.user_id = auth.uid()
              )
            )
            OR (
              m.matter_type <> 'crew_invite'
              AND (
                m.created_by_user_id = auth.uid()
                OR EXISTS (
                  SELECT 1
                  FROM public.matter_recipients mr
                  WHERE mr.matter_id = m.id
                    AND mr.user_id = auth.uid()
                )
              )
            )
          )
        )
      )
  );
$$;

-- ============================================================================
-- MATTERS
-- ============================================================================
DROP POLICY IF EXISTS "Users can view matters for their company" ON public.matters;
CREATE POLICY "Users can view matters for their company"
  ON public.matters
  FOR SELECT
  USING (public.can_view_matter(id));

-- ============================================================================
-- MATTER FILES
-- ============================================================================
DROP POLICY IF EXISTS "Users can view matter files" ON public.matter_files;
CREATE POLICY "Users can view matter files"
  ON public.matter_files
  FOR SELECT
  USING (public.can_view_matter(matter_id));

-- ============================================================================
-- MATTER MESSAGES
-- ============================================================================
DROP POLICY IF EXISTS "Users can view matter messages" ON public.matter_messages;
CREATE POLICY "Users can view matter messages"
  ON public.matter_messages
  FOR SELECT
  USING (public.can_view_matter(matter_id));

-- ============================================================================
-- MATTER RECIPIENTS
-- ============================================================================
DROP POLICY IF EXISTS "Users can view matter recipients" ON public.matter_recipients;
CREATE POLICY "Users can view matter recipients"
  ON public.matter_recipients
  FOR SELECT
  USING (
    matter_recipients.user_id = auth.uid()
    OR public.can_view_matter(matter_id)
  );

-- ============================================================================
-- MATTER RESPONSES
-- ============================================================================
DROP POLICY IF EXISTS "Users can view matter responses" ON public.matter_responses;
CREATE POLICY "Users can view matter responses"
  ON public.matter_responses
  FOR SELECT
  USING (public.can_view_matter(matter_id));
