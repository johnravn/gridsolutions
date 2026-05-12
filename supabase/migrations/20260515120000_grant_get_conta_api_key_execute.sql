-- get_conta_api_key(boolean) was DROP'd and recreated in 20260309120000 / 20260511113500
-- without re-applying EXECUTE for authenticated. PostgREST then rejects rpc(get_conta_api_key)
-- (often as HTTP 400) when the Conta client loads the API key.

REVOKE ALL ON FUNCTION public.get_conta_api_key(boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_conta_api_key(boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_conta_api_key(boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_conta_api_key(boolean) TO service_role;
