-- Fix: allow employees to read time_periods (needed for bookings sync)
--
-- A previous migration tightened time_periods SELECT to owners-only, which
-- prevents employees from syncing bookings (and can also indirectly block
-- reserved_* policies that join against time_periods).

DROP POLICY IF EXISTS "Users can view time_periods for their companies" ON public.time_periods;
CREATE POLICY "Users can view time_periods for their companies"
  ON public.time_periods
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.company_users cu
      WHERE cu.company_id = time_periods.company_id
        AND cu.user_id = auth.uid()
        AND cu.role IN ('owner', 'super_user', 'employee')
    )
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.superuser = true
    )
  );

