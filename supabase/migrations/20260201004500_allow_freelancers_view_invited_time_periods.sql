-- Allow freelancers to read the minimal data required to see "their" jobs:
-- - time_periods where they are booked (reserved_crew.user_id = auth.uid())
-- - time_periods where they are invited (crew_invite matter recipient)
--
-- This is needed because time_periods SELECT was tightened to owners/employees,
-- and reserved_crew SELECT depends on time_periods for company-scoping.
-- Without this, frontend queries can fail under RLS and appear as "no jobs".

-- RESERVED_CREW: allow any user to read their own reserved_crew rows
DROP POLICY IF EXISTS "Users can view their own reserved_crew" ON public.reserved_crew;
CREATE POLICY "Users can view their own reserved_crew"
  ON public.reserved_crew
  FOR SELECT
  USING (
    reserved_crew.user_id = auth.uid()
    OR public.is_superuser(auth.uid())
  );

-- TIME_PERIODS: allow freelancers to read only time periods relevant to them
DROP POLICY IF EXISTS "Freelancers can view time_periods they are invited to" ON public.time_periods;
CREATE POLICY "Freelancers can view time_periods they are invited to"
  ON public.time_periods
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.company_users cu
      WHERE cu.company_id = time_periods.company_id
        AND cu.user_id = auth.uid()
        AND cu.role = 'freelancer'
    )
    AND (
      -- Booked/assigned to the time period
      EXISTS (
        SELECT 1
        FROM public.reserved_crew rc
        WHERE rc.time_period_id = time_periods.id
          AND rc.user_id = auth.uid()
      )
      -- Invited to the time period (crew_invite matter recipient)
      OR EXISTS (
        SELECT 1
        FROM public.matters m
        JOIN public.matter_recipients mr
          ON mr.matter_id = m.id
        WHERE m.time_period_id = time_periods.id
          AND m.matter_type = 'crew_invite'
          AND mr.user_id = auth.uid()
      )
    )
    OR public.is_superuser(auth.uid())
  );

