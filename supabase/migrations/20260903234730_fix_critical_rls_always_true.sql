-- Critical RLS: remove always-true bypasses flagged by Security Advisor.
-- - profiles.dev_allow_all granted full access to anon/authenticated
-- - matter_recipients / dev_auth_logs INSERT WITH CHECK (true)

-- 1) profiles: drop leftover dev bypass (other tables cleaned in 20251217010240)
DROP POLICY IF EXISTS "dev_allow_all" ON public.profiles;

-- 2) matter_recipients: require company staff (or global superuser) for the matter
DROP POLICY IF EXISTS "System can insert matter recipients" ON public.matter_recipients;
CREATE POLICY "Company staff can insert matter recipients"
  ON public.matter_recipients
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (
      EXISTS (
        SELECT 1
        FROM public.matters m
        JOIN public.company_users cu ON cu.company_id = m.company_id
        WHERE m.id = matter_recipients.matter_id
          AND cu.user_id = (SELECT auth.uid())
          AND cu.role = ANY (
            ARRAY[
              'owner'::public.company_role,
              'employee'::public.company_role,
              'super_user'::public.company_role
            ]
          )
      )
    )
    OR public.is_superuser((SELECT auth.uid()))
  );

-- 3) dev_auth_logs: inserts only via SECURITY DEFINER triggers (no client INSERT)
DROP POLICY IF EXISTS "System can insert auth logs" ON public.dev_auth_logs;
