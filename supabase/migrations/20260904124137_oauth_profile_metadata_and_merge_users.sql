-- OAuth metadata mapping for ensure_profile_for_user + superuser merge_users RPC

CREATE OR REPLACE FUNCTION public.ensure_profile_for_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  u record;
  meta jsonb;
  v_conflict_user uuid;
  v_full_name text;
  v_first_name text;
  v_last_name text;
  v_display_name text;
  v_phone text;
  v_avatar text;
  v_name_parts text[];
BEGIN
  SELECT id, email, raw_user_meta_data
  INTO u
  FROM auth.users
  WHERE id = p_user_id;

  IF NOT FOUND OR u.email IS NULL THEN
    RETURN;
  END IF;

  meta := coalesce(u.raw_user_meta_data, '{}'::jsonb);

  -- Prefer app signup keys, then common OAuth claim shapes (Google/Apple).
  v_full_name := nullif(trim(coalesce(
    meta->>'full_name',
    meta->>'name',
    ''
  )), '');

  v_first_name := nullif(trim(coalesce(
    meta->>'first_name',
    meta->>'given_name',
    ''
  )), '');

  v_last_name := nullif(trim(coalesce(
    meta->>'last_name',
    meta->>'family_name',
    ''
  )), '');

  IF v_first_name IS NULL AND v_last_name IS NULL AND v_full_name IS NOT NULL THEN
    v_name_parts := regexp_split_to_array(v_full_name, '\s+');
    IF array_length(v_name_parts, 1) >= 1 THEN
      v_first_name := v_name_parts[1];
    END IF;
    IF array_length(v_name_parts, 1) >= 2 THEN
      v_last_name := array_to_string(v_name_parts[2:array_length(v_name_parts, 1)], ' ');
    END IF;
  END IF;

  v_display_name := v_full_name;

  v_phone := nullif(trim(coalesce(meta->>'phone', '')), '');

  v_avatar := nullif(trim(coalesce(
    meta->>'avatar_url',
    meta->>'picture',
    ''
  )), '');

  -- DEV-SAFE: delete any stale profile with same email on a different user
  SELECT p.user_id
    INTO v_conflict_user
  FROM public.profiles p
  WHERE lower(p.email) = lower(u.email)
    AND p.user_id <> u.id
  LIMIT 1;

  IF FOUND THEN
    DELETE FROM public.profiles WHERE user_id = v_conflict_user;
  END IF;

  INSERT INTO public.profiles(
    user_id, email, display_name, first_name, last_name, phone, avatar_url
  )
  VALUES (
    u.id,
    lower(u.email),
    v_display_name,
    v_first_name,
    v_last_name,
    v_phone,
    v_avatar
  )
  ON CONFLICT (user_id) DO UPDATE SET
    email        = excluded.email,
    display_name = coalesce(excluded.display_name, profiles.display_name),
    first_name   = coalesce(excluded.first_name,   profiles.first_name),
    last_name    = coalesce(excluded.last_name,    profiles.last_name),
    phone        = coalesce(excluded.phone,        profiles.phone),
    avatar_url   = coalesce(excluded.avatar_url,   profiles.avatar_url);
END;
$$;

COMMENT ON FUNCTION public.ensure_profile_for_user(uuid) IS
  'Upserts profiles from auth.users, mapping app metadata and OAuth claim shapes (Google/Apple).';

-- ---------------------------------------------------------------------------
-- merge_users: reassign absorb → keep, then delete absorb auth user
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.merge_users(
  p_keep_user_id uuid,
  p_absorb_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_keep_exists boolean;
  v_absorb_exists boolean;
BEGIN
  IF v_actor IS NULL OR NOT public.is_superuser(v_actor) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF p_keep_user_id IS NULL OR p_absorb_user_id IS NULL THEN
    RAISE EXCEPTION 'Both keep and absorb user ids are required';
  END IF;

  IF p_keep_user_id = p_absorb_user_id THEN
    RAISE EXCEPTION 'Cannot merge a user into themselves';
  END IF;

  IF p_absorb_user_id = v_actor THEN
    RAISE EXCEPTION 'Cannot absorb your own account';
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = p_keep_user_id)
    INTO v_keep_exists;
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = p_absorb_user_id)
    INTO v_absorb_exists;

  IF NOT v_keep_exists THEN
    RAISE EXCEPTION 'Keep user profile not found';
  END IF;
  IF NOT v_absorb_exists THEN
    RAISE EXCEPTION 'Absorb user profile not found';
  END IF;

  -- Fill null keep profile fields from absorb (do not overwrite keep values)
  UPDATE public.profiles AS keep
  SET
    display_name = coalesce(keep.display_name, absorb.display_name),
    first_name   = coalesce(keep.first_name, absorb.first_name),
    last_name    = coalesce(keep.last_name, absorb.last_name),
    phone        = coalesce(keep.phone, absorb.phone),
    avatar_url   = coalesce(keep.avatar_url, absorb.avatar_url),
    bio          = coalesce(keep.bio, absorb.bio),
    preferences  = CASE
      WHEN keep.preferences IS NULL OR keep.preferences = '{}'::jsonb
        THEN absorb.preferences
      ELSE keep.preferences
    END,
    primary_address_id = coalesce(keep.primary_address_id, absorb.primary_address_id),
    selected_company_id = coalesce(keep.selected_company_id, absorb.selected_company_id)
  FROM public.profiles AS absorb
  WHERE keep.user_id = p_keep_user_id
    AND absorb.user_id = p_absorb_user_id;

  -- Unique-conflict tables: drop absorb rows that would collide with keep
  DELETE FROM public.company_users cu
  WHERE cu.user_id = p_absorb_user_id
    AND EXISTS (
      SELECT 1 FROM public.company_users k
      WHERE k.user_id = p_keep_user_id AND k.company_id = cu.company_id
    );

  DELETE FROM public.matter_recipients mr
  WHERE mr.user_id = p_absorb_user_id
    AND EXISTS (
      SELECT 1 FROM public.matter_recipients k
      WHERE k.user_id = p_keep_user_id AND k.matter_id = mr.matter_id
    );

  DELETE FROM public.matter_responses mr
  WHERE mr.user_id = p_absorb_user_id
    AND EXISTS (
      SELECT 1 FROM public.matter_responses k
      WHERE k.user_id = p_keep_user_id AND k.matter_id = mr.matter_id
    );

  DELETE FROM public.activity_likes al
  WHERE al.user_id = p_absorb_user_id
    AND EXISTS (
      SELECT 1 FROM public.activity_likes k
      WHERE k.user_id = p_keep_user_id AND k.activity_id = al.activity_id
    );

  DELETE FROM public.notification_preferences np
  WHERE np.user_id = p_absorb_user_id
    AND EXISTS (
      SELECT 1 FROM public.notification_preferences k
      WHERE k.user_id = p_keep_user_id AND k.company_id = np.company_id
    );

  DELETE FROM public.company_user_internal_notes n
  WHERE n.user_id = p_absorb_user_id
    AND EXISTS (
      SELECT 1 FROM public.company_user_internal_notes k
      WHERE k.user_id = p_keep_user_id AND k.company_id = n.company_id
    );

  -- Reassign public FKs absorb → keep
  UPDATE public.activity_comments SET created_by_user_id = p_keep_user_id WHERE created_by_user_id = p_absorb_user_id;
  UPDATE public.activity_likes SET user_id = p_keep_user_id WHERE user_id = p_absorb_user_id;
  UPDATE public.activity_log SET created_by_user_id = p_keep_user_id WHERE created_by_user_id = p_absorb_user_id;
  UPDATE public.companies SET contact_person_id = p_keep_user_id WHERE contact_person_id = p_absorb_user_id;
  UPDATE public.company_users SET user_id = p_keep_user_id WHERE user_id = p_absorb_user_id;
  UPDATE public.company_user_internal_notes SET user_id = p_keep_user_id WHERE user_id = p_absorb_user_id;
  UPDATE public.calendar_subscriptions SET user_id = p_keep_user_id WHERE user_id = p_absorb_user_id;
  UPDATE public.calendar_subscriptions SET crew_user_id = p_keep_user_id WHERE crew_user_id = p_absorb_user_id;
  UPDATE public.job_files SET uploaded_by_user_id = p_keep_user_id WHERE uploaded_by_user_id = p_absorb_user_id;
  UPDATE public.job_invoices SET created_by_user_id = p_keep_user_id WHERE created_by_user_id = p_absorb_user_id;
  UPDATE public.job_notes SET author_user_id = p_keep_user_id WHERE author_user_id = p_absorb_user_id;
  UPDATE public.job_packing_sessions SET created_by_user_id = p_keep_user_id WHERE created_by_user_id = p_absorb_user_id;
  UPDATE public.jobs SET customer_user_id = p_keep_user_id WHERE customer_user_id = p_absorb_user_id;
  UPDATE public.jobs SET project_lead_user_id = p_keep_user_id WHERE project_lead_user_id = p_absorb_user_id;
  UPDATE public.logging_periods SET locked_by_user_id = p_keep_user_id WHERE locked_by_user_id = p_absorb_user_id;
  UPDATE public.matter_files SET uploaded_by_user_id = p_keep_user_id WHERE uploaded_by_user_id = p_absorb_user_id;
  UPDATE public.matter_messages SET user_id = p_keep_user_id WHERE user_id = p_absorb_user_id;
  UPDATE public.matter_recipients SET user_id = p_keep_user_id WHERE user_id = p_absorb_user_id;
  UPDATE public.matter_responses SET user_id = p_keep_user_id WHERE user_id = p_absorb_user_id;
  UPDATE public.matters SET created_by_user_id = p_keep_user_id WHERE created_by_user_id = p_absorb_user_id;
  UPDATE public.notification_preferences SET user_id = p_keep_user_id WHERE user_id = p_absorb_user_id;
  UPDATE public.notifications SET user_id = p_keep_user_id WHERE user_id = p_absorb_user_id;
  UPDATE public.notifications SET created_by_user_id = p_keep_user_id WHERE created_by_user_id = p_absorb_user_id;
  UPDATE public.personal_calendar_events SET user_id = p_keep_user_id WHERE user_id = p_absorb_user_id;
  UPDATE public.recurring_jobs SET customer_user_id = p_keep_user_id WHERE customer_user_id = p_absorb_user_id;
  UPDATE public.recurring_jobs SET project_lead_user_id = p_keep_user_id WHERE project_lead_user_id = p_absorb_user_id;
  UPDATE public.reserved_crew SET user_id = p_keep_user_id WHERE user_id = p_absorb_user_id;
  UPDATE public.reserved_crew SET forced_by_user_id = p_keep_user_id WHERE forced_by_user_id = p_absorb_user_id;
  UPDATE public.reserved_items SET forced_by_user_id = p_keep_user_id WHERE forced_by_user_id = p_absorb_user_id;
  UPDATE public.reserved_vehicles SET forced_by_user_id = p_keep_user_id WHERE forced_by_user_id = p_absorb_user_id;
  UPDATE public.time_entries SET user_id = p_keep_user_id WHERE user_id = p_absorb_user_id;
  UPDATE public.time_periods SET reserved_by_user_id = p_keep_user_id WHERE reserved_by_user_id = p_absorb_user_id;
  UPDATE public.time_periods SET updated_by_user_id = p_keep_user_id WHERE updated_by_user_id = p_absorb_user_id;
  UPDATE public.vehicles SET owner_user_id = p_keep_user_id WHERE owner_user_id = p_absorb_user_id;
  UPDATE public.pending_invites SET inviter_user_id = p_keep_user_id WHERE inviter_user_id = p_absorb_user_id;
  UPDATE public.group_price_history SET set_by = p_keep_user_id WHERE set_by = p_absorb_user_id;
  UPDATE public.item_price_history SET set_by = p_keep_user_id WHERE set_by = p_absorb_user_id;
  UPDATE public.job_status_history SET set_by = p_keep_user_id WHERE set_by = p_absorb_user_id;

  -- Transfer non-conflicting auth identities (same provider already on keep → drop absorb's)
  DELETE FROM auth.identities ai
  WHERE ai.user_id = p_absorb_user_id
    AND EXISTS (
      SELECT 1 FROM auth.identities k
      WHERE k.user_id = p_keep_user_id AND k.provider = ai.provider
    );

  UPDATE auth.identities
  SET user_id = p_keep_user_id
  WHERE user_id = p_absorb_user_id;

  DELETE FROM auth.sessions WHERE user_id = p_absorb_user_id;
  DELETE FROM auth.refresh_tokens WHERE user_id = p_absorb_user_id;

  -- Clear absorb profile address link so cascade/delete is clean
  UPDATE public.profiles
  SET primary_address_id = NULL
  WHERE user_id = p_absorb_user_id;

  DELETE FROM public.profiles WHERE user_id = p_absorb_user_id;
  DELETE FROM auth.users WHERE id = p_absorb_user_id;
END;
$$;

COMMENT ON FUNCTION public.merge_users(uuid, uuid) IS
  'Superuser-only: merge absorb user into keep user (reassign FKs, transfer identities, delete absorb).';

REVOKE ALL ON FUNCTION public.merge_users(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.merge_users(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.merge_users(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.merge_users(uuid, uuid) TO service_role;
