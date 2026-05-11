-- Ensure add_member_or_invite returns the pending_invite id when relevant.
-- This lets the client explicitly invoke send-welcome-email (Resend) in dev,
-- without relying on pg_net/vault being configured.

CREATE OR REPLACE FUNCTION public.add_member_or_invite(
  p_company_id uuid,
  p_email text,
  p_inviter_id uuid,
  p_role public.company_role
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
declare
  v_email         text := lower(p_email);
  v_existing_user uuid;
  v_existing_role public.company_role;
  v_existing_inv  uuid;
  v_by_user_id    uuid;
begin
  -- Does a profile with this email exist? (case-insensitive)
  select user_id
    into v_existing_user
  from public.profiles
  where lower(email) = v_email::text;

  -- If profile is missing, try auth.users and create a profile
  if v_existing_user is null then
    select id
      into v_existing_user
    from auth.users
    where lower(email) = v_email::text;

    if v_existing_user is not null then
      perform public.ensure_profile_for_user(v_existing_user);
    end if;
  end if;

  if v_existing_user is not null then
    -- Already in the company?
    select role
      into v_existing_role
    from public.company_users
    where company_id = p_company_id
      and user_id    = v_existing_user;

    if v_existing_role is not null then
      return jsonb_build_object('type','already_member','role', v_existing_role::text);
    end if;

    -- Add them with the requested role
    insert into public.company_users (company_id, user_id, role)
    values (p_company_id, v_existing_user, p_role)
    on conflict (company_id, user_id) do nothing;

    return jsonb_build_object('type','added');
  end if;

  -- No user account yet: existing, unexpired invite?
  select id, inviter_user_id
    into v_existing_inv, v_by_user_id
  from public.pending_invites
  where company_id = p_company_id
    and lower(email::text) = v_email::text
    and expires_at > now()
  order by created_at desc
  limit 1;

  if v_existing_inv is not null then
    return jsonb_build_object(
      'type','already_invited',
      'by_user_id', v_by_user_id,
      'pending_invite_id', v_existing_inv
    );
  end if;

  -- Create invite with requested role
  insert into public.pending_invites (company_id, inviter_user_id, email, role, expires_at)
  values (p_company_id, p_inviter_id, v_email::text, p_role, now() + interval '30 days')
  returning id into v_existing_inv;

  return jsonb_build_object('type','invited','pending_invite_id', v_existing_inv);
end;
$$;

