-- Function for cron/sync jobs: get Conta API key by company_id.
-- Only callable by service_role (no grant to anon/authenticated).

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
BEGIN
  -- Protected by GRANT: only service_role can execute
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

-- Only service_role can call this
REVOKE ALL ON FUNCTION get_conta_api_key_for_sync(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_conta_api_key_for_sync(uuid) FROM anon;
REVOKE ALL ON FUNCTION get_conta_api_key_for_sync(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION get_conta_api_key_for_sync(uuid) TO service_role;

COMMENT ON FUNCTION get_conta_api_key_for_sync(uuid) IS
'Returns decrypted Conta API key for the given company. Only callable by service_role (for cron/sync jobs).';
