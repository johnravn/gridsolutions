-- Fix "infinite recursion detected in policy for relation time_periods"
--
-- Root cause:
-- - time_periods SELECT policy for freelancers referenced reserved_crew
-- - reserved_crew SELECT policy references time_periods
-- This creates a circular RLS dependency (time_periods -> reserved_crew -> time_periods).
--
-- Fix:
-- - Move the "is invited/booked" check into a SECURITY DEFINER helper function
--   with row_security = off, so policy evaluation does not recurse.

-- Helper: can the *current* user (auth.uid()) as a freelancer view this time period?
CREATE OR REPLACE FUNCTION public.can_freelancer_view_time_period(
  p_company_id uuid,
  p_time_period_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT
    -- Must be a freelancer in this company
    EXISTS (
      SELECT 1
      FROM public.company_users cu
      WHERE cu.company_id = p_company_id
        AND cu.user_id = auth.uid()
        AND cu.role = 'freelancer'
    )
    AND (
      -- Booked/assigned to this time period
      EXISTS (
        SELECT 1
        FROM public.reserved_crew rc
        WHERE rc.time_period_id = p_time_period_id
          AND rc.user_id = auth.uid()
      )
      OR
      -- Invited to this time period (crew_invite matter recipient)
      EXISTS (
        SELECT 1
        FROM public.matters m
        JOIN public.matter_recipients mr
          ON mr.matter_id = m.id
        WHERE m.company_id = p_company_id
          AND m.time_period_id = p_time_period_id
          AND m.matter_type = 'crew_invite'
          AND mr.user_id = auth.uid()
      )
    );
$$;

-- Replace the freelancer time_periods policy to use the helper (prevents recursion).
DROP POLICY IF EXISTS "Freelancers can view time_periods they are invited to" ON public.time_periods;
CREATE POLICY "Freelancers can view time_periods they are invited to"
  ON public.time_periods
  FOR SELECT
  USING (
    public.can_freelancer_view_time_period(time_periods.company_id, time_periods.id)
    OR public.is_superuser(auth.uid())
  );

