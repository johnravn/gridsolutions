-- Revoke broad EXECUTE on SECURITY DEFINER functions; re-grant narrowly.
-- Harden invite/role/inventory/encryption RPCs to authorize via auth.uid().

-- ---------------------------------------------------------------------------
-- 1) Harden privileged RPC bodies
-- ---------------------------------------------------------------------------

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

-- Route both freelancer overloads through the hardened add_member_or_invite
CREATE OR REPLACE FUNCTION public.add_freelancer_or_invite(
  p_company_id uuid,
  p_email text,
  p_inviter_id uuid
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
  SELECT public.add_member_or_invite(
    p_company_id,
    p_email,
    p_inviter_id,
    'freelancer'::public.company_role
  );
$function$;

CREATE OR REPLACE FUNCTION public.add_freelancer_or_invite(
  p_company_id uuid,
  p_email extensions.citext,
  p_inviter_id uuid
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
  SELECT public.add_member_or_invite(
    p_company_id,
    p_email::text,
    p_inviter_id,
    'freelancer'::public.company_role
  );
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

CREATE OR REPLACE FUNCTION public.create_item_with_price(
  p_company_id uuid,
  p_name text,
  p_category_id uuid DEFAULT NULL::uuid,
  p_brand_id uuid DEFAULT NULL::uuid,
  p_model text DEFAULT NULL::text,
  p_allow_individual_booking boolean DEFAULT true,
  p_total_quantity integer DEFAULT 0,
  p_active boolean DEFAULT true,
  p_notes text DEFAULT NULL::text,
  p_price numeric DEFAULT NULL::numeric,
  p_effective_from timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_nicknames text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_item_id uuid;
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
    RAISE EXCEPTION 'insufficient_privileges';
  END IF;

  IF public.demo_company_blocks_mutation(p_company_id) THEN
    RAISE EXCEPTION 'Demo company is read-only';
  END IF;

  INSERT INTO public.items (
    company_id,
    name,
    category_id,
    brand_id,
    model,
    allow_individual_booking,
    total_quantity,
    active,
    notes,
    nicknames
  ) VALUES (
    p_company_id,
    p_name,
    p_category_id,
    p_brand_id,
    p_model,
    p_allow_individual_booking,
    coalesce(p_total_quantity, 0),
    p_active,
    p_notes,
    p_nicknames
  )
  RETURNING id INTO v_item_id;

  IF p_price IS NOT NULL THEN
    INSERT INTO public.item_price_history (
      company_id,
      item_id,
      amount,
      effective_from,
      set_by
    ) VALUES (
      p_company_id,
      v_item_id,
      p_price,
      coalesce(p_effective_from, now()),
      v_actor
    );
  END IF;

  RETURN v_item_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_group_with_price_and_parts(
  p_company_id uuid,
  p_name text,
  p_category_id uuid DEFAULT NULL::uuid,
  p_description text DEFAULT NULL::text,
  p_active boolean DEFAULT true,
  p_price numeric DEFAULT NULL::numeric,
  p_parts jsonb DEFAULT '[]'::jsonb,
  p_unique boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_group_id uuid;
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
    RAISE EXCEPTION 'insufficient_privileges';
  END IF;

  IF public.demo_company_blocks_mutation(p_company_id) THEN
    RAISE EXCEPTION 'Demo company is read-only';
  END IF;

  INSERT INTO public.item_groups (company_id, name, category_id, description, active, "unique")
  VALUES (p_company_id, p_name, p_category_id, p_description, coalesce(p_active, true), coalesce(p_unique, false))
  RETURNING id INTO v_group_id;

  IF jsonb_typeof(p_parts) = 'array' AND jsonb_array_length(p_parts) > 0 THEN
    INSERT INTO public.group_items (group_id, item_id, quantity)
    SELECT
      v_group_id,
      (j->>'item_id')::uuid,
      greatest(1, coalesce((j->>'quantity')::int, 1))
    FROM jsonb_array_elements(p_parts) AS j;
  END IF;

  IF p_price IS NOT NULL THEN
    INSERT INTO public.group_price_history (company_id, group_id, amount, set_by)
    VALUES (p_company_id, v_group_id, p_price, v_actor);
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.encrypt_api_key(p_company_id uuid, p_api_key text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_encrypted_key text;
  v_secret_key text;
  v_key_hash bytea;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF NOT (
    public.user_has_company_role(
      p_company_id,
      v_actor,
      ARRAY['owner'::public.company_role, 'super_user'::public.company_role]
    )
    OR public.is_superuser(v_actor)
  ) THEN
    RAISE EXCEPTION 'insufficient_privileges';
  END IF;

  v_secret_key := 'conta_api_key_secret_' || p_company_id::text;
  v_key_hash := digest(v_secret_key, 'sha256');

  BEGIN
    SELECT encode(
      encrypt(p_api_key::bytea, v_key_hash, 'aes'),
      'base64'
    ) INTO v_encrypted_key;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE EXCEPTION 'Failed to encrypt API key: %', SQLERRM;
  END;

  RETURN v_encrypted_key;
END;
$function$;

-- decrypt_api_key: keep for internal use by other SECURITY DEFINER helpers;
-- EXECUTE will be revoked from anon/authenticated below.

-- ---------------------------------------------------------------------------
-- 2) Revoke EXECUTE on all public SECURITY DEFINER functions from API roles
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', r.sig);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', r.sig);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', r.sig);
    -- service_role retains access for edge functions / admin
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 3) Re-grant: RLS predicates (policies TO public may evaluate as anon)
-- ---------------------------------------------------------------------------

GRANT EXECUTE ON FUNCTION public.can_freelancer_view_job(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.can_freelancer_view_time_period(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_matter(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.can_subscribe_to_crew_user(uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_superuser(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_company_role(uuid, uuid, public.company_role[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.user_is_company_member(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.users_share_company(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notification_insert_allowed_for_actor(uuid, uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notification_recipient_allowed_for_company(uuid, uuid) TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.demo_company_blocks_mutation(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.demo_company_blocks_activity_mutation(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.demo_company_blocks_group_mutation(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.demo_company_blocks_item_mutation(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.demo_company_blocks_job_mutation(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.demo_company_blocks_matter_mutation(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.demo_company_blocks_module_block_mutation(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.demo_company_blocks_module_mutation(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.demo_company_blocks_offer_basis_mutation(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.demo_company_blocks_offer_group_mutation(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.demo_company_blocks_offer_mutation(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.demo_company_blocks_time_period_mutation(uuid) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4) Re-grant: intentional public-offer RPCs (anon + authenticated)
-- ---------------------------------------------------------------------------

GRANT EXECUTE ON FUNCTION public.public_offer_get(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_offer_mark_viewed(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_offer_accept(text, text, text, text, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_offer_reject(text, text, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_offer_request_revision(text, text, text, text, text) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5) Re-grant: authenticated client RPCs
-- ---------------------------------------------------------------------------

GRANT EXECUTE ON FUNCTION public.add_member_or_invite(uuid, text, uuid, public.company_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_freelancer_or_invite(uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_freelancer_or_invite(uuid, extensions.citext, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_company_user_role(uuid, uuid, public.company_role, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_item_with_price(uuid, text, uuid, uuid, text, boolean, integer, boolean, text, numeric, timestamptz, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_group_with_price_and_parts(uuid, text, uuid, text, boolean, numeric, jsonb, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.encrypt_api_key(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.job_copy(uuid, timestamptz, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_to_crew_invite(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_my_profile(text, text, text, text, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_my_avatar(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.enter_demo() TO authenticated;
GRANT EXECUTE ON FUNCTION public.advance_demo_company_timeline(interval) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_system_monitor_snapshot() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_accounting_api_environment() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_accounting_read_only() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_conta_api_key(boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_group_contents_for_display(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_default_reservation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_job_offer_bookings_synced(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_offer_basis_bookings_synced(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_existing_users_to_welcome_matter(uuid, uuid) TO authenticated;

-- Trigger-only / internal SECURITY DEFINER functions intentionally have no
-- anon/authenticated EXECUTE (service_role + owner only).
