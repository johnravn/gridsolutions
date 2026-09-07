-- Lock profiles.superuser against self-escalation via the Data API.
-- Own-profile UPDATE RLS only checks row ownership, so any authenticated user
-- could previously set superuser = true on themselves.
--
-- 1) BEFORE INSERT/UPDATE trigger: only existing superusers (or privileged
--    backend roles with no end-user JWT) may change the column.
-- 2) Column-level REVOKE so authenticated PostgREST cannot mention superuser.
-- 3) SECURITY DEFINER admin_update_profile RPC for the Super user dialog.

CREATE OR REPLACE FUNCTION public.protect_profiles_superuser()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF COALESCE(NEW.superuser, false) = false THEN
      RETURN NEW;
    END IF;
  ELSIF NEW.superuser IS NOT DISTINCT FROM OLD.superuser THEN
    RETURN NEW;
  END IF;

  -- Logged-in superuser (JWT present) may promote/demote.
  IF public.is_superuser(auth.uid()) THEN
    RETURN NEW;
  END IF;

  -- Migrations, service_role, and other privileged contexts have no auth.uid().
  -- Authenticated Data API requests always have a JWT subject, so this is not
  -- a self-escalation path.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'not allowed to change superuser'
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profiles_superuser ON public.profiles;
CREATE TRIGGER trg_protect_profiles_superuser
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profiles_superuser();

REVOKE ALL ON FUNCTION public.protect_profiles_superuser() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.protect_profiles_superuser() FROM anon;
REVOKE ALL ON FUNCTION public.protect_profiles_superuser() FROM authenticated;

-- Authenticated clients cannot name the column in INSERT/UPDATE.
-- service_role and postgres keep table-level grants (including this column).
REVOKE INSERT (superuser) ON public.profiles FROM anon, authenticated;
REVOKE UPDATE (superuser) ON public.profiles FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_update_profile(
  p_user_id uuid,
  p_display_name text,
  p_first_name text,
  p_last_name text,
  p_phone text,
  p_superuser boolean
)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_row public.profiles;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF NOT public.is_superuser(v_actor) THEN
    RAISE EXCEPTION 'insufficient_privileges'
      USING HINT = 'Only superusers can update profiles via admin_update_profile.';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'profile_not_found';
  END IF;

  UPDATE public.profiles
  SET
    display_name = NULLIF(btrim(p_display_name), ''),
    first_name = NULLIF(btrim(p_first_name), ''),
    last_name = NULLIF(btrim(p_last_name), ''),
    phone = NULLIF(btrim(p_phone), ''),
    superuser = COALESCE(p_superuser, false)
  WHERE user_id = p_user_id
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile_not_found';
  END IF;

  RETURN v_row;
END;
$$;

COMMENT ON FUNCTION public.admin_update_profile(uuid, text, text, text, text, boolean) IS
  'Superuser-only profile edit, including the superuser flag. Used by the Super user dialog.';

REVOKE ALL ON FUNCTION public.admin_update_profile(uuid, text, text, text, text, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_update_profile(uuid, text, text, text, text, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_update_profile(uuid, text, text, text, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_profile(uuid, text, text, text, text, boolean) TO service_role;
