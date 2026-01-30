-- Update time_entries SELECT policy for company owners

DROP POLICY IF EXISTS "Users can view their own time entries" ON time_entries;
CREATE POLICY "Users can view their own time entries"
  ON time_entries
  FOR SELECT
  USING (
    (
      user_id = auth.uid()
      AND company_id IN (
        SELECT company_id FROM company_users
        WHERE user_id = auth.uid()
          AND role IN ('owner', 'employee', 'super_user')
      )
    )
    OR EXISTS (
      SELECT 1 FROM company_users
      WHERE company_users.company_id = time_entries.company_id
        AND company_users.user_id = auth.uid()
        AND company_users.role = 'owner'
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );
