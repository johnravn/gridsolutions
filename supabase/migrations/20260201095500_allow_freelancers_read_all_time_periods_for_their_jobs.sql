-- Allow freelancers to READ all time_periods for jobs they can access
-- (invited / accepted / canceled), while keeping INSERT/UPDATE/DELETE restricted.
--
-- This is needed for:
-- - Program tab (read program periods)
-- - Packing tab (read equipment/transport time periods)
-- - Contacts tab (read crew roles/time periods)
--
-- Uses SECURITY DEFINER + row_security=off to avoid RLS recursion.

CREATE OR REPLACE FUNCTION public.can_freelancer_view_job(
  p_company_id uuid,
  p_job_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT
    EXISTS (
      SELECT 1
      FROM public.company_users cu
      WHERE cu.company_id = p_company_id
        AND cu.user_id = auth.uid()
        AND cu.role = 'freelancer'
    )
    AND (
      -- Invited (crew_invite matter recipient)
      EXISTS (
        SELECT 1
        FROM public.matters m
        JOIN public.matter_recipients mr
          ON mr.matter_id = m.id
        WHERE m.company_id = p_company_id
          AND m.job_id = p_job_id
          AND m.matter_type = 'crew_invite'
          AND mr.user_id = auth.uid()
      )
      OR
      -- Accepted/canceled (has reserved_crew on any crew time_period for the job)
      EXISTS (
        SELECT 1
        FROM public.reserved_crew rc
        JOIN public.time_periods tp
          ON tp.id = rc.time_period_id
        WHERE tp.company_id = p_company_id
          AND tp.job_id = p_job_id
          AND tp.category = 'crew'
          AND rc.user_id = auth.uid()
          AND rc.status IN ('confirmed', 'canceled')
      )
    );
$$;

-- Replace the old freelancer time_periods policy with job-scoped access.
DROP POLICY IF EXISTS "Freelancers can view time_periods they are invited to" ON public.time_periods;
CREATE POLICY "Freelancers can view time_periods for their jobs"
  ON public.time_periods
  FOR SELECT
  USING (
    public.can_freelancer_view_job(time_periods.company_id, time_periods.job_id)
    OR public.is_superuser(auth.uid())
  );

