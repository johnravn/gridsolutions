-- Add an active/inactive flag for the accounting API key.
-- When inactive, the key is preserved (encrypted) but is not returned by
-- get_conta_api_key()/get_conta_api_key_for_sync(), so the integration
-- effectively pauses without losing the configured key, organization, or
-- environment. Users can re-activate later without re-entering anything.

ALTER TABLE company_expansions
  ADD COLUMN IF NOT EXISTS accounting_api_key_active BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN company_expansions.accounting_api_key_active IS
'When FALSE, the stored accounting API key is treated as if not configured. The encrypted key is kept so it can be re-activated without re-configuration.';

-- Update get_conta_api_key to respect the active flag.
DROP FUNCTION IF EXISTS get_conta_api_key(boolean);
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
  v_api_key_active BOOLEAN;
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

  SELECT COALESCE(accounting_api_key_active, TRUE) INTO v_api_key_active
  FROM company_expansions
  WHERE company_id = v_company_id;

  IF v_api_key_active IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'Conta API key is currently inactive for this company';
  END IF;

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
'Returns the decrypted Conta API key for the current user''s company. Raises if the key is marked inactive. Use p_force_production=TRUE in local dev (with VITE_CONTA_USE_PRODUCTION_IN_DEV) to use production key regardless of company''s accounting_api_environment.';

-- Update get_conta_api_key_for_sync to skip inactive keys (return NULL).
DROP FUNCTION IF EXISTS get_conta_api_key_for_sync(uuid);

CREATE OR REPLACE FUNCTION get_conta_api_key_for_sync(p_company_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_api_key BYTEA;
  v_api_key_base64 text;
  v_api_environment text;
  v_api_key_active BOOLEAN;
BEGIN
  SELECT COALESCE(accounting_api_key_active, TRUE) INTO v_api_key_active
  FROM company_expansions
  WHERE company_id = p_company_id;

  IF v_api_key_active IS DISTINCT FROM TRUE THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(accounting_api_environment, 'production') INTO v_api_environment
  FROM company_expansions
  WHERE company_id = p_company_id;

  IF v_api_environment = 'sandbox' THEN
    SELECT accounting_api_key_sandbox_encrypted INTO v_api_key
    FROM company_expansions
    WHERE company_id = p_company_id;
  ELSE
    SELECT accounting_api_key_encrypted INTO v_api_key
    FROM company_expansions
    WHERE company_id = p_company_id;
  END IF;

  IF v_api_key IS NULL THEN
    RETURN NULL;
  END IF;

  v_api_key_base64 := convert_from(v_api_key, 'UTF8');
  RETURN decrypt_api_key(p_company_id, v_api_key_base64);
END;
$$;

REVOKE ALL ON FUNCTION get_conta_api_key_for_sync(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_conta_api_key_for_sync(uuid) FROM anon;
REVOKE ALL ON FUNCTION get_conta_api_key_for_sync(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION get_conta_api_key_for_sync(uuid) TO service_role;

COMMENT ON FUNCTION get_conta_api_key_for_sync(uuid) IS
'Returns decrypted Conta API key for the given company, or NULL if the key is inactive. Only callable by service_role (for cron/sync jobs).';
