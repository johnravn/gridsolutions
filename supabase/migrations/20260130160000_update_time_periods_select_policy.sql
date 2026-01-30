-- Update time_periods SELECT policy: owners + superusers only

DROP POLICY IF EXISTS "Users can view time_periods for their companies" ON time_periods;
CREATE POLICY "Users can view time_periods for their companies"
  ON time_periods
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM company_users
      WHERE company_users.company_id = time_periods.company_id
        AND company_users.user_id = auth.uid()
        AND company_users.role = 'owner'
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );
