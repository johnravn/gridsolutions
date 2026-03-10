-- Align get_accounting_read_only company resolution with get_conta_api_key.
-- Previously get_accounting_read_only used ORDER BY created_at ASC when no company
-- was selected, while get_conta_api_key uses ORDER BY role (owner, super_user, employee).
-- That could make the API key come from one company and the read-only flag from another,
-- causing "Write operations (POST) are not allowed when API is in read-only mode" even
-- when the company expansion tab showed "Full access" for the company that has the key.

DROP FUNCTION IF EXISTS get_accounting_read_only();

CREATE OR REPLACE FUNCTION get_accounting_read_only()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_company_id UUID;
  v_role TEXT;
  v_read_only BOOLEAN;
  v_is_superuser BOOLEAN;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Same company resolution as get_conta_api_key: profile selected_company_id,
  -- verify membership, then fallback by role priority (owner, super_user, employee)
  SELECT selected_company_id INTO v_company_id
  FROM profiles
  WHERE user_id = v_user_id;

  IF v_company_id IS NOT NULL THEN
    SELECT role INTO v_role
    FROM company_users
    WHERE user_id = v_user_id
      AND company_id = v_company_id;
    IF v_role IS NULL THEN
      v_company_id := NULL;
      v_role := NULL;
    END IF;
  END IF;

  IF v_company_id IS NULL THEN
    SELECT company_id, role INTO v_company_id, v_role
    FROM company_users
    WHERE user_id = v_user_id
      AND role IN ('owner', 'employee', 'super_user')
    ORDER BY
      CASE role
        WHEN 'owner' THEN 1
        WHEN 'super_user' THEN 2
        WHEN 'employee' THEN 3
      END
    LIMIT 1;
  END IF;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'User is not a member of any company with access permissions';
  END IF;

  IF v_role IS NULL THEN
    SELECT role INTO v_role
    FROM company_users
    WHERE user_id = v_user_id
      AND company_id = v_company_id;
  END IF;

  SELECT COALESCE(superuser, false) INTO v_is_superuser
  FROM profiles
  WHERE user_id = v_user_id;

  IF v_is_superuser THEN
    NULL;
  ELSIF v_role IS NULL THEN
    RAISE EXCEPTION 'User is not a member of this company or does not have permission to access accounting settings';
  ELSIF v_role NOT IN ('owner', 'employee', 'super_user') THEN
    RAISE EXCEPTION 'User role "%" does not have permission to access accounting settings. Required roles: owner, employee, or super_user', v_role;
  END IF;

  -- Get the read-only setting from company_expansions (same company as get_conta_api_key)
  SELECT COALESCE(ce.accounting_api_read_only, false) INTO v_read_only
  FROM company_expansions ce
  WHERE ce.company_id = v_company_id;

  -- No row or null => default to read-only for safety
  RETURN COALESCE(v_read_only, true);
END;
$$;

COMMENT ON FUNCTION get_accounting_read_only() IS
'Returns the read-only setting for accounting API operations. Uses the same company resolution as get_conta_api_key so key and read-only setting always refer to the same company.';
