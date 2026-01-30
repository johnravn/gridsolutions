-- Fix addresses INSERT RLS to allow personal profile addresses
-- - Personal addresses can be created by authenticated users for their own profile
-- - Company addresses remain restricted to company members
-- - Superusers can create any address

DROP POLICY IF EXISTS "Users can create company addresses" ON addresses;
CREATE POLICY "Users can create company addresses"
  ON addresses
  FOR INSERT
  WITH CHECK (
    -- Company addresses: user must be a member of the company with appropriate role
    (
      company_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM company_users
        WHERE company_users.company_id = addresses.company_id
          AND company_users.user_id = auth.uid()
          AND company_users.role IN ('owner', 'super_user', 'employee')
      )
    )
    OR
    -- Personal addresses: authenticated user can create their own personal address
    (
      is_personal = true
      AND company_id IS NULL
      AND EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.user_id = auth.uid()
      )
    )
    OR
    -- Superusers can create any address
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );
