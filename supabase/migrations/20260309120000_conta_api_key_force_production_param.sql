-- Allow forcing production Conta API key when running in local dev (via optional param).
-- When p_force_production is TRUE, returns the production key and caller should use production URL.

DROP FUNCTION IF EXISTS get_conta_api_key();

CREATE OR REPLACE FUNCTION get_conta_api_key(p_force_production boolean DEFAULT FALSE)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_company_id UUID;
  v_role TEXT;
  v_api_key BYTEA;
  v_api_key_base64 TEXT;
  v_is_superuser BOOLEAN;
  v_api_environment TEXT;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

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
    RAISE EXCEPTION 'User is not a member of this company or does not have permission to access Conta API key';
  ELSIF v_role NOT IN ('owner', 'employee', 'super_user') THEN
    RAISE EXCEPTION 'User role "%" does not have permission to access Conta API key. Required roles: owner, employee, or super_user', v_role;
  END IF;

  -- When p_force_production is TRUE, always use production key; otherwise use company's selected environment
  IF p_force_production THEN
    v_api_environment := 'production';
  ELSE
    SELECT COALESCE(accounting_api_environment, 'production') INTO v_api_environment
    FROM company_expansions
    WHERE company_id = v_company_id;
  END IF;

  IF v_api_environment = 'sandbox' THEN
    SELECT accounting_api_key_sandbox_encrypted INTO v_api_key
    FROM company_expansions
    WHERE company_id = v_company_id;
  ELSE
    SELECT accounting_api_key_encrypted INTO v_api_key
    FROM company_expansions
    WHERE company_id = v_company_id;
  END IF;

  IF v_api_key IS NULL THEN
    RAISE EXCEPTION 'No Conta API key configured for this company';
  END IF;

  v_api_key_base64 := convert_from(v_api_key, 'UTF8');

  RETURN decrypt_api_key(v_company_id, v_api_key_base64);
END;
$$;

COMMENT ON FUNCTION get_conta_api_key(boolean) IS
'Returns the decrypted Conta API key for the current user''s company. Use p_force_production=TRUE in local dev (with VITE_CONTA_USE_PRODUCTION_IN_DEV) to use production key regardless of company''s accounting_api_environment.';
