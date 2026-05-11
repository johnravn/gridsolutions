-- Crew can be assigned from global profile search without a company_users row.
-- Matters + matter_recipients still succeed; notifications INSERT failed RLS and blocked email.
-- Extend INSERT policy: same-company inviter may notify users who are either company members,
-- booked on reserved_crew for this company's time periods, or recipients on a matter for this company.

DROP POLICY IF EXISTS "Company members can create notifications for company users" ON public.notifications;

CREATE POLICY "Company members can create notifications for company users"
  ON public.notifications
  FOR INSERT
  WITH CHECK (
    public.is_superuser(auth.uid())
    OR (
      company_id IN (
        SELECT cu.company_id
        FROM public.company_users cu
        WHERE cu.user_id = auth.uid()
      )
      AND (
        user_id IN (
          SELECT cu.user_id
          FROM public.company_users cu
          WHERE cu.company_id = notifications.company_id
        )
        OR EXISTS (
          SELECT 1
          FROM public.reserved_crew rc
          INNER JOIN public.time_periods tp ON tp.id = rc.time_period_id
          WHERE rc.user_id IS NOT NULL
            AND rc.user_id = notifications.user_id
            AND tp.company_id = notifications.company_id
        )
        OR EXISTS (
          SELECT 1
          FROM public.matter_recipients mr
          INNER JOIN public.matters m ON m.id = mr.matter_id
          WHERE mr.user_id = notifications.user_id
            AND m.company_id = notifications.company_id
        )
      )
    )
  );
