-- Restrict which company roles add_member_or_invite / set_company_user_role
-- may assign. Callers were already required to be staff (or global
-- superuser), but p_role / p_new_role were unchecked — an employee could
-- pass 'owner' and escalate.
--
-- Assignment matrix:
--   employee          → freelancer
--   company super_user → employee, freelancer
--   owner              → any role
--   global superuser   → any role
--
-- set_company_user_role still only allows owner / company super_user /
-- global superuser to change existing members. The matrix then limits
-- which target roles they may set. Changing an existing owner or
-- company super_user also requires owner (or global superuser).

CREATE OR REPLACE FUNCTION public.can_assign_company_role(
  p_company_id uuid,
  p_actor uuid,
  p_role public.company_role
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_actor_role public.company_role;
BEGIN
  IF p_actor IS NULL OR p_role IS NULL THEN
    RETURN false;
  END IF;

  IF public.is_superuser(p_actor) THEN
    RETURN true;
  END IF;

  SELECT role
    INTO v_actor_role
  FROM public.company_users
  WHERE company_id = p_company_id
    AND user_id = p_actor;

  IF v_actor_role IS NULL THEN
    RETURN false;
  END IF;

  IF v_actor_role = 'owner' THEN
    RETURN true;
  END IF;

  IF v_actor_role = 'super_user' THEN
    RETURN p_role IN (
      'employee'::public.company_role,
      'freelancer'::public.company_role
    );
  END IF;

  IF v_actor_role = 'employee' THEN
    RETURN p_role = 'freelancer'::public.company_role;
  END IF;

  RETURN false;
END;
$function$;

REVOKE ALL ON FUNCTION public.can_assign_company_role(uuid, uuid, public.company_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_assign_company_role(uuid, uuid, public.company_role) FROM anon;
GRANT EXECUTE ON FUNCTION public.can_assign_company_role(uuid, uuid, public.company_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_assign_company_role(uuid, uuid, public.company_role) TO service_role;

CREATE OR REPLACE FUNCTION public.add_member_or_invite(
  p_company_id uuid,
  p_email text,
  p_inviter_id uuid,
  p_role public.company_role
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_email text := lower(p_email);
  v_existing_user uuid;
  v_existing_role public.company_role;
  v_existing_inv uuid;
  v_by_user_id uuid;
  v_inviter uuid;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF NOT (
    public.user_has_company_role(
      p_company_id,
      v_actor,
      ARRAY[
        'owner'::public.company_role,
        'super_user'::public.company_role,
        'employee'::public.company_role
      ]
    )
    OR public.is_superuser(v_actor)
  ) THEN
    RAISE EXCEPTION 'insufficient_privileges'
      USING hint = 'Only company staff can invite members.';
  END IF;

  IF NOT public.can_assign_company_role(p_company_id, v_actor, p_role) THEN
    RAISE EXCEPTION 'role_not_assignable'
      USING hint = 'You cannot invite someone with that company role.';
  END IF;

  -- Ignore client-supplied inviter; always use the authenticated actor
  v_inviter := v_actor;
  IF p_inviter_id IS NOT NULL AND p_inviter_id <> v_actor AND NOT public.is_superuser(v_actor) THEN
    RAISE EXCEPTION 'inviter_mismatch'
      USING hint = 'Inviter must be the authenticated user.';
  END IF;

  IF public.demo_company_blocks_mutation(p_company_id) THEN
    RAISE EXCEPTION 'Demo company is read-only';
  END IF;

  SELECT user_id
    INTO v_existing_user
  FROM public.profiles
  WHERE lower(email) = v_email::text;

  IF v_existing_user IS NULL THEN
    SELECT id
      INTO v_existing_user
    FROM auth.users
    WHERE lower(email) = v_email::text;

    IF v_existing_user IS NOT NULL THEN
      PERFORM public.ensure_profile_for_user(v_existing_user);
    END IF;
  END IF;

  IF v_existing_user IS NOT NULL THEN
    SELECT role
      INTO v_existing_role
    FROM public.company_users
    WHERE company_id = p_company_id
      AND user_id = v_existing_user;

    IF v_existing_role IS NOT NULL THEN
      RETURN jsonb_build_object('type', 'already_member', 'role', v_existing_role::text);
    END IF;

    INSERT INTO public.company_users (company_id, user_id, role)
    VALUES (p_company_id, v_existing_user, p_role)
    ON CONFLICT (company_id, user_id) DO NOTHING;

    RETURN jsonb_build_object('type', 'added');
  END IF;

  SELECT id, inviter_user_id
    INTO v_existing_inv, v_by_user_id
  FROM public.pending_invites
  WHERE company_id = p_company_id
    AND lower(email::text) = v_email::text
    AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_existing_inv IS NOT NULL THEN
    RETURN jsonb_build_object(
      'type', 'already_invited',
      'by_user_id', v_by_user_id,
      'pending_invite_id', v_existing_inv
    );
  END IF;

  INSERT INTO public.pending_invites (company_id, inviter_user_id, email, role, expires_at)
  VALUES (p_company_id, v_inviter, v_email::text, p_role, now() + interval '30 days')
  RETURNING id INTO v_existing_inv;

  RETURN jsonb_build_object('type', 'invited', 'pending_invite_id', v_existing_inv);
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_company_user_role(
  p_company_id uuid,
  p_target_user_id uuid,
  p_new_role public.company_role,
  p_actor_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_actor_role public.company_role;
  v_actor_is_superuser boolean;
  v_target_old_role public.company_role;
  v_owner_count integer;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Ignore client-supplied actor id (kept for API compatibility)
  IF p_actor_user_id IS NOT NULL AND p_actor_user_id <> v_actor AND NOT COALESCE(
    (SELECT superuser FROM public.profiles WHERE user_id = v_actor),
    false
  ) THEN
    RAISE EXCEPTION 'actor_mismatch'
      USING hint = 'Actor must be the authenticated user.';
  END IF;

  IF public.demo_company_blocks_mutation(p_company_id) THEN
    RAISE EXCEPTION 'Demo company is read-only';
  END IF;

  SELECT superuser INTO v_actor_is_superuser
  FROM public.profiles
  WHERE user_id = v_actor;

  SELECT role INTO v_actor_role
  FROM public.company_users
  WHERE company_id = p_company_id
    AND user_id = v_actor;

  IF v_actor_role IS NULL AND COALESCE(v_actor_is_superuser, false) = false THEN
    RAISE EXCEPTION 'not_in_company' USING hint = 'Actor must be in company.';
  END IF;

  IF COALESCE(v_actor_is_superuser, false) = false
    AND v_actor_role NOT IN ('owner', 'super_user') THEN
    RAISE EXCEPTION 'insufficient_privileges'
      USING hint = 'Only owners/super users can change roles.';
  END IF;

  SELECT role INTO v_target_old_role
  FROM public.company_users
  WHERE company_id = p_company_id
    AND user_id = p_target_user_id;

  IF v_target_old_role IS NULL THEN
    RAISE EXCEPTION 'target_not_found' USING hint = 'Target user is not in company.';
  END IF;

  IF v_target_old_role IN ('owner', 'super_user')
    AND COALESCE(v_actor_is_superuser, false) = false
    AND v_actor_role IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'insufficient_privileges'
      USING hint = 'Only owners can change owner or super user roles.';
  END IF;

  IF NOT public.can_assign_company_role(p_company_id, v_actor, p_new_role) THEN
    RAISE EXCEPTION 'role_not_assignable'
      USING hint = 'You cannot assign that company role.';
  END IF;

  IF v_target_old_role = 'owner' AND p_new_role <> 'owner' THEN
    SELECT count(*) INTO v_owner_count
    FROM public.company_users
    WHERE company_id = p_company_id
      AND role = 'owner';

    IF v_owner_count <= 1 THEN
      RAISE EXCEPTION 'last_owner_guard'
        USING hint = 'Company must have at least one owner.';
    END IF;
  END IF;

  UPDATE public.company_users
  SET role = p_new_role
  WHERE company_id = p_company_id
    AND user_id = p_target_user_id;

  RETURN jsonb_build_object('type', 'ok');
END;
$function$;
