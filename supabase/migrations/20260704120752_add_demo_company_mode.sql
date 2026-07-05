-- Demo company mode: read-only exploration for anonymous visitors.
-- Global superusers retain write access to populate and maintain demo data.

-- ---------------------------------------------------------------------------
-- 1. Schema: flag demo companies
-- ---------------------------------------------------------------------------
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

-- Fixed UUID so environments can reference the demo company consistently.
INSERT INTO public.companies (id, name, is_demo, general_email)
VALUES (
  '00000000-0000-4000-8000-000000000001',
  'Demo Company',
  true,
  'demo@gridsolutions.app'
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  is_demo = true,
  general_email = EXCLUDED.general_email;

-- ---------------------------------------------------------------------------
-- 2. Helper functions
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.demo_company_blocks_mutation(p_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p_company_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.companies c
      WHERE c.id = p_company_id
        AND c.is_demo = true
    )
    AND COALESCE(public.is_superuser(auth.uid()), false) = false;
$$;

CREATE OR REPLACE FUNCTION public.demo_company_blocks_job_mutation(p_job_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.demo_company_blocks_mutation(
    (SELECT j.company_id FROM public.jobs j WHERE j.id = p_job_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.demo_company_blocks_offer_mutation(p_offer_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.demo_company_blocks_mutation(
    (SELECT o.company_id FROM public.job_offers o WHERE o.id = p_offer_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.demo_company_blocks_matter_mutation(p_matter_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.demo_company_blocks_mutation(
    (SELECT m.company_id FROM public.matters m WHERE m.id = p_matter_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.demo_company_blocks_activity_mutation(p_activity_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.demo_company_blocks_mutation(
    (SELECT a.company_id FROM public.activity_log a WHERE a.id = p_activity_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.demo_company_blocks_time_period_mutation(p_time_period_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.demo_company_blocks_mutation(
    (SELECT tp.company_id FROM public.time_periods tp WHERE tp.id = p_time_period_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.demo_company_blocks_group_mutation(p_group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.demo_company_blocks_mutation(
    (SELECT g.company_id FROM public.item_groups g WHERE g.id = p_group_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.demo_company_blocks_item_mutation(p_item_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.demo_company_blocks_mutation(
    (SELECT i.company_id FROM public.items i WHERE i.id = p_item_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.demo_company_blocks_module_mutation(p_module_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.demo_company_blocks_offer_mutation(
    (SELECT m.offer_id FROM public.pretty_offer_modules m WHERE m.id = p_module_id)
  );
$$;

-- ---------------------------------------------------------------------------
-- 3. enter_demo() RPC — anonymous session bootstrap
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.demo_company_blocks_offer_group_mutation(p_group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.demo_company_blocks_offer_mutation(
    (SELECT g.offer_id FROM public.offer_equipment_groups g WHERE g.id = p_group_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.demo_company_blocks_module_block_mutation(p_block_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.demo_company_blocks_module_mutation(
    (SELECT b.module_id FROM public.pretty_offer_module_blocks b WHERE b.id = p_block_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.enter_demo()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_demo_company_id uuid;
  v_is_anonymous boolean;
  v_email text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT u.is_anonymous
    INTO v_is_anonymous
  FROM auth.users u
  WHERE u.id = v_user_id;

  IF NOT COALESCE(v_is_anonymous, false) THEN
    RAISE EXCEPTION 'Demo mode is only available for anonymous sessions';
  END IF;

  SELECT c.id
    INTO v_demo_company_id
  FROM public.companies c
  WHERE c.is_demo = true
  ORDER BY c.created_at
  LIMIT 1;

  IF v_demo_company_id IS NULL THEN
    RAISE EXCEPTION 'Demo company not configured';
  END IF;

  v_email := 'demo+' || v_user_id::text || '@demo.internal';

  INSERT INTO public.profiles (user_id, email, display_name)
  VALUES (v_user_id, v_email, 'Demo User')
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.company_users (company_id, user_id, role)
  VALUES (v_demo_company_id, v_user_id, 'owner')
  ON CONFLICT (company_id, user_id) DO NOTHING;

  UPDATE public.profiles
  SET selected_company_id = v_demo_company_id
  WHERE user_id = v_user_id;

  RETURN v_demo_company_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.enter_demo() TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. Restrictive RLS: block mutations on demo company data
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  tbl record;
BEGIN
  FOR tbl IN
    SELECT c.table_name
    FROM information_schema.columns c
    JOIN pg_class pc ON pc.relname = c.table_name
    JOIN pg_namespace pn ON pn.oid = pc.relnamespace AND pn.nspname = 'public'
    WHERE c.table_schema = 'public'
      AND c.column_name = 'company_id'
      AND pc.relkind = 'r'
      AND pc.relrowsecurity = true
    GROUP BY c.table_name
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS demo_company_no_insert ON public.%I',
      tbl.table_name
    );
    EXECUTE format(
      'CREATE POLICY demo_company_no_insert ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (NOT public.demo_company_blocks_mutation(company_id))',
      tbl.table_name
    );

    EXECUTE format(
      'DROP POLICY IF EXISTS demo_company_no_update ON public.%I',
      tbl.table_name
    );
    EXECUTE format(
      'CREATE POLICY demo_company_no_update ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING (NOT public.demo_company_blocks_mutation(company_id)) WITH CHECK (NOT public.demo_company_blocks_mutation(company_id))',
      tbl.table_name
    );

    EXECUTE format(
      'DROP POLICY IF EXISTS demo_company_no_delete ON public.%I',
      tbl.table_name
    );
    EXECUTE format(
      'CREATE POLICY demo_company_no_delete ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING (NOT public.demo_company_blocks_mutation(company_id))',
      tbl.table_name
    );
  END LOOP;
END $$;

-- companies uses id, not company_id
DROP POLICY IF EXISTS demo_company_no_update ON public.companies;
CREATE POLICY demo_company_no_update ON public.companies
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (NOT public.demo_company_blocks_mutation(id))
  WITH CHECK (NOT public.demo_company_blocks_mutation(id));

DROP POLICY IF EXISTS demo_company_no_delete ON public.companies;
CREATE POLICY demo_company_no_delete ON public.companies
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (NOT public.demo_company_blocks_mutation(id));

-- job-scoped tables (no company_id column)
DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'job_contacts',
    'job_files',
    'job_notes',
    'job_status_history',
    'job_invoices',
    'job_offers'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS demo_company_no_insert ON public.%I', tbl);
    EXECUTE format(
      'CREATE POLICY demo_company_no_insert ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (NOT public.demo_company_blocks_job_mutation(job_id))',
      tbl
    );
    EXECUTE format('DROP POLICY IF EXISTS demo_company_no_update ON public.%I', tbl);
    EXECUTE format(
      'CREATE POLICY demo_company_no_update ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING (NOT public.demo_company_blocks_job_mutation(job_id)) WITH CHECK (NOT public.demo_company_blocks_job_mutation(job_id))',
      tbl
    );
    EXECUTE format('DROP POLICY IF EXISTS demo_company_no_delete ON public.%I', tbl);
    EXECUTE format(
      'CREATE POLICY demo_company_no_delete ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING (NOT public.demo_company_blocks_job_mutation(job_id))',
      tbl
    );
  END LOOP;
END $$;

-- offer-scoped tables (offer_id column)
DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'offer_crew_items',
    'offer_equipment_groups',
    'offer_pretty_sections',
    'offer_transport_items',
    'offer_transport_groups',
    'pretty_offer_modules',
    'pretty_offer_subcontractor_quotes'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS demo_company_no_insert ON public.%I', tbl);
    EXECUTE format(
      'CREATE POLICY demo_company_no_insert ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (NOT public.demo_company_blocks_offer_mutation(offer_id))',
      tbl
    );
    EXECUTE format('DROP POLICY IF EXISTS demo_company_no_update ON public.%I', tbl);
    EXECUTE format(
      'CREATE POLICY demo_company_no_update ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING (NOT public.demo_company_blocks_offer_mutation(offer_id)) WITH CHECK (NOT public.demo_company_blocks_offer_mutation(offer_id))',
      tbl
    );
    EXECUTE format('DROP POLICY IF EXISTS demo_company_no_delete ON public.%I', tbl);
    EXECUTE format(
      'CREATE POLICY demo_company_no_delete ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING (NOT public.demo_company_blocks_offer_mutation(offer_id))',
      tbl
    );
  END LOOP;
END $$;

-- offer equipment line items (offer_group_id column)
DROP POLICY IF EXISTS demo_company_no_insert ON public.offer_equipment_items;
CREATE POLICY demo_company_no_insert ON public.offer_equipment_items
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (NOT public.demo_company_blocks_offer_group_mutation(offer_group_id));

DROP POLICY IF EXISTS demo_company_no_update ON public.offer_equipment_items;
CREATE POLICY demo_company_no_update ON public.offer_equipment_items
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (NOT public.demo_company_blocks_offer_group_mutation(offer_group_id))
  WITH CHECK (NOT public.demo_company_blocks_offer_group_mutation(offer_group_id));

DROP POLICY IF EXISTS demo_company_no_delete ON public.offer_equipment_items;
CREATE POLICY demo_company_no_delete ON public.offer_equipment_items
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (NOT public.demo_company_blocks_offer_group_mutation(offer_group_id));

-- pretty offer nested tables (module_id)
DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'pretty_offer_module_manual_fields',
    'pretty_offer_subcontractor_allocations',
    'pretty_offer_module_category_mappings',
    'pretty_offer_module_media',
    'pretty_offer_module_blocks'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS demo_company_no_insert ON public.%I', tbl);
    EXECUTE format(
      'CREATE POLICY demo_company_no_insert ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (NOT public.demo_company_blocks_module_mutation(module_id))',
      tbl
    );
    EXECUTE format('DROP POLICY IF EXISTS demo_company_no_update ON public.%I', tbl);
    EXECUTE format(
      'CREATE POLICY demo_company_no_update ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING (NOT public.demo_company_blocks_module_mutation(module_id)) WITH CHECK (NOT public.demo_company_blocks_module_mutation(module_id))',
      tbl
    );
    EXECUTE format('DROP POLICY IF EXISTS demo_company_no_delete ON public.%I', tbl);
    EXECUTE format(
      'CREATE POLICY demo_company_no_delete ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING (NOT public.demo_company_blocks_module_mutation(module_id))',
      tbl
    );
  END LOOP;
END $$;

DROP POLICY IF EXISTS demo_company_no_insert ON public.pretty_offer_module_block_items;
CREATE POLICY demo_company_no_insert ON public.pretty_offer_module_block_items
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (NOT public.demo_company_blocks_module_block_mutation(block_id));

DROP POLICY IF EXISTS demo_company_no_update ON public.pretty_offer_module_block_items;
CREATE POLICY demo_company_no_update ON public.pretty_offer_module_block_items
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (NOT public.demo_company_blocks_module_block_mutation(block_id))
  WITH CHECK (NOT public.demo_company_blocks_module_block_mutation(block_id));

DROP POLICY IF EXISTS demo_company_no_delete ON public.pretty_offer_module_block_items;
CREATE POLICY demo_company_no_delete ON public.pretty_offer_module_block_items
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (NOT public.demo_company_blocks_module_block_mutation(block_id));

-- matter-scoped tables
DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'matter_files',
    'matter_messages',
    'matter_recipients',
    'matter_responses'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS demo_company_no_insert ON public.%I', tbl);
    EXECUTE format(
      'CREATE POLICY demo_company_no_insert ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (NOT public.demo_company_blocks_matter_mutation(matter_id))',
      tbl
    );
    EXECUTE format('DROP POLICY IF EXISTS demo_company_no_update ON public.%I', tbl);
    EXECUTE format(
      'CREATE POLICY demo_company_no_update ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING (NOT public.demo_company_blocks_matter_mutation(matter_id)) WITH CHECK (NOT public.demo_company_blocks_matter_mutation(matter_id))',
      tbl
    );
    EXECUTE format('DROP POLICY IF EXISTS demo_company_no_delete ON public.%I', tbl);
    EXECUTE format(
      'CREATE POLICY demo_company_no_delete ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING (NOT public.demo_company_blocks_matter_mutation(matter_id))',
      tbl
    );
  END LOOP;
END $$;

-- activity-scoped tables
DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['activity_comments', 'activity_likes']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS demo_company_no_insert ON public.%I', tbl);
    EXECUTE format(
      'CREATE POLICY demo_company_no_insert ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (NOT public.demo_company_blocks_activity_mutation(activity_id))',
      tbl
    );
    EXECUTE format('DROP POLICY IF EXISTS demo_company_no_update ON public.%I', tbl);
    EXECUTE format(
      'CREATE POLICY demo_company_no_update ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING (NOT public.demo_company_blocks_activity_mutation(activity_id)) WITH CHECK (NOT public.demo_company_blocks_activity_mutation(activity_id))',
      tbl
    );
    EXECUTE format('DROP POLICY IF EXISTS demo_company_no_delete ON public.%I', tbl);
    EXECUTE format(
      'CREATE POLICY demo_company_no_delete ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING (NOT public.demo_company_blocks_activity_mutation(activity_id))',
      tbl
    );
  END LOOP;
END $$;

-- reservation tables (time_period_id)
DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['reserved_crew', 'reserved_items', 'reserved_vehicles']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS demo_company_no_insert ON public.%I', tbl);
    EXECUTE format(
      'CREATE POLICY demo_company_no_insert ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (NOT public.demo_company_blocks_time_period_mutation(time_period_id))',
      tbl
    );
    EXECUTE format('DROP POLICY IF EXISTS demo_company_no_update ON public.%I', tbl);
    EXECUTE format(
      'CREATE POLICY demo_company_no_update ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING (NOT public.demo_company_blocks_time_period_mutation(time_period_id)) WITH CHECK (NOT public.demo_company_blocks_time_period_mutation(time_period_id))',
      tbl
    );
    EXECUTE format('DROP POLICY IF EXISTS demo_company_no_delete ON public.%I', tbl);
    EXECUTE format(
      'CREATE POLICY demo_company_no_delete ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING (NOT public.demo_company_blocks_time_period_mutation(time_period_id))',
      tbl
    );
  END LOOP;
END $$;

-- group-scoped tables
DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['group_items', 'group_price_history']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS demo_company_no_insert ON public.%I', tbl);
    EXECUTE format(
      'CREATE POLICY demo_company_no_insert ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (NOT public.demo_company_blocks_group_mutation(group_id))',
      tbl
    );
    EXECUTE format('DROP POLICY IF EXISTS demo_company_no_update ON public.%I', tbl);
    EXECUTE format(
      'CREATE POLICY demo_company_no_update ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING (NOT public.demo_company_blocks_group_mutation(group_id)) WITH CHECK (NOT public.demo_company_blocks_group_mutation(group_id))',
      tbl
    );
    EXECUTE format('DROP POLICY IF EXISTS demo_company_no_delete ON public.%I', tbl);
    EXECUTE format(
      'CREATE POLICY demo_company_no_delete ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING (NOT public.demo_company_blocks_group_mutation(group_id))',
      tbl
    );
  END LOOP;
END $$;

-- item_related uses item_a_id
DROP POLICY IF EXISTS demo_company_no_insert ON public.item_related;
CREATE POLICY demo_company_no_insert ON public.item_related
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (NOT public.demo_company_blocks_item_mutation(item_a_id));

DROP POLICY IF EXISTS demo_company_no_update ON public.item_related;
CREATE POLICY demo_company_no_update ON public.item_related
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (NOT public.demo_company_blocks_item_mutation(item_a_id))
  WITH CHECK (NOT public.demo_company_blocks_item_mutation(item_a_id));

DROP POLICY IF EXISTS demo_company_no_delete ON public.item_related;
CREATE POLICY demo_company_no_delete ON public.item_related
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (NOT public.demo_company_blocks_item_mutation(item_a_id));

-- Storage: block company-scoped uploads in demo mode
DROP POLICY IF EXISTS demo_company_no_storage_insert ON storage.objects;
CREATE POLICY demo_company_no_storage_insert ON storage.objects
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id NOT IN (
      'pretty_offer_media',
      'pretty_offer_quotes',
      'logos',
      'company_files',
      'vehicle_images'
    )
    OR NOT public.demo_company_blocks_mutation((storage.foldername(name))[1]::uuid)
  );

DROP POLICY IF EXISTS demo_company_no_storage_update ON storage.objects;
CREATE POLICY demo_company_no_storage_update ON storage.objects
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (
    bucket_id NOT IN (
      'pretty_offer_media',
      'pretty_offer_quotes',
      'logos',
      'company_files',
      'vehicle_images'
    )
    OR NOT public.demo_company_blocks_mutation((storage.foldername(name))[1]::uuid)
  )
  WITH CHECK (
    bucket_id NOT IN (
      'pretty_offer_media',
      'pretty_offer_quotes',
      'logos',
      'company_files',
      'vehicle_images'
    )
    OR NOT public.demo_company_blocks_mutation((storage.foldername(name))[1]::uuid)
  );

DROP POLICY IF EXISTS demo_company_no_storage_delete ON storage.objects;
CREATE POLICY demo_company_no_storage_delete ON storage.objects
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (
    bucket_id NOT IN (
      'pretty_offer_media',
      'pretty_offer_quotes',
      'logos',
      'company_files',
      'vehicle_images'
    )
    OR NOT public.demo_company_blocks_mutation((storage.foldername(name))[1]::uuid)
  );

-- ---------------------------------------------------------------------------
-- 5. Harden SECURITY DEFINER RPCs reachable from the UI
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_company_user_role(
  p_company_id uuid,
  p_target_user_id uuid,
  p_new_role public.company_role,
  p_actor_user_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_role public.company_role;
  v_actor_is_superuser boolean;
  v_target_old_role public.company_role;
  v_owner_count integer;
BEGIN
  IF public.demo_company_blocks_mutation(p_company_id) THEN
    RAISE EXCEPTION 'Demo company is read-only';
  END IF;

  SELECT superuser INTO v_actor_is_superuser
  FROM public.profiles
  WHERE user_id = p_actor_user_id;

  SELECT role INTO v_actor_role
  FROM public.company_users
  WHERE company_id = p_company_id
    AND user_id = p_actor_user_id;

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
$$;

CREATE OR REPLACE FUNCTION public.add_member_or_invite(
  p_company_id uuid,
  p_email text,
  p_inviter_id uuid,
  p_role public.company_role
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_email text := lower(p_email);
  v_existing_user uuid;
  v_existing_role public.company_role;
  v_existing_inv uuid;
  v_by_user_id uuid;
BEGIN
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
  VALUES (p_company_id, p_inviter_id, v_email::text, p_role, now() + interval '30 days')
  RETURNING id INTO v_existing_inv;

  RETURN jsonb_build_object('type', 'invited', 'pending_invite_id', v_existing_inv);
END;
$$;

-- job_copy guard
CREATE OR REPLACE FUNCTION public.job_copy(
  p_job_id uuid,
  p_start_at timestamptz,
  p_end_at timestamptz
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_old_job public.jobs%ROWTYPE;
  v_new_job_id uuid;
  v_delta interval := interval '0';

  v_old_tp RECORD;
  v_new_tp_id uuid;

  v_old_offer RECORD;
  v_new_offer_id uuid;
  v_offer_version int := 0;

  v_old_group RECORD;
  v_new_group_id uuid;
BEGIN
  SELECT * INTO v_old_job
  FROM public.jobs
  WHERE id = p_job_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job not found';
  END IF;

  IF public.demo_company_blocks_mutation(v_old_job.company_id) THEN
    RAISE EXCEPTION 'Demo company is read-only';
  END IF;

  IF p_start_at IS NULL OR p_end_at IS NULL THEN
    RAISE EXCEPTION 'Start and end must be set';
  END IF;
  IF p_end_at < p_start_at THEN
    RAISE EXCEPTION 'End must be after start';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.company_users cu
    WHERE cu.company_id = v_old_job.company_id
      AND cu.user_id = auth.uid()
      AND cu.role IN ('owner', 'employee', 'super_user')
  ) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  IF v_old_job.start_at IS NOT NULL THEN
    v_delta := p_start_at - v_old_job.start_at;
  END IF;

  INSERT INTO public.jobs (
    company_id,
    title,
    description,
    status,
    start_at,
    end_at,
    customer_id,
    customer_user_id,
    customer_contact_id,
    project_lead_user_id,
    job_address_id,
    invoice_basis,
    archived
  )
  VALUES (
    v_old_job.company_id,
    v_old_job.title,
    v_old_job.description,
    'planned',
    p_start_at,
    p_end_at,
    v_old_job.customer_id,
    v_old_job.customer_user_id,
    v_old_job.customer_contact_id,
    v_old_job.project_lead_user_id,
    v_old_job.job_address_id,
    v_old_job.invoice_basis,
    false
  )
  RETURNING id INTO v_new_job_id;

  CREATE TEMP TABLE tp_map (
    old_id uuid PRIMARY KEY,
    new_id uuid NOT NULL
  ) ON COMMIT DROP;

  FOR v_old_tp IN
    SELECT *
    FROM public.time_periods
    WHERE job_id = p_job_id
      AND deleted = false
    ORDER BY start_at ASC
  LOOP
    INSERT INTO public.time_periods (
      job_id,
      company_id,
      title,
      start_at,
      end_at,
      category,
      program_group,
      needed_count,
      role_category,
      notes,
      reserved_by_user_id,
      deleted
    )
    VALUES (
      v_new_job_id,
      v_old_tp.company_id,
      v_old_tp.title,
      (v_old_tp.start_at + v_delta),
      (v_old_tp.end_at + v_delta),
      v_old_tp.category,
      v_old_tp.program_group,
      v_old_tp.needed_count,
      v_old_tp.role_category,
      v_old_tp.notes,
      NULL,
      false
    )
    RETURNING id INTO v_new_tp_id;

    INSERT INTO tp_map(old_id, new_id) VALUES (v_old_tp.id, v_new_tp_id);
  END LOOP;

  INSERT INTO public.reserved_items (
    time_period_id,
    item_id,
    quantity,
    status,
    external_status,
    external_note,
    forced,
    start_at,
    end_at,
    source_kind,
    source_group_id
  )
  SELECT
    m.new_id,
    ri.item_id,
    ri.quantity,
    ri.status,
    ri.external_status,
    ri.external_note,
    ri.forced,
    ri.start_at,
    ri.end_at,
    ri.source_kind,
    ri.source_group_id
  FROM public.reserved_items ri
  JOIN tp_map m ON m.old_id = ri.time_period_id;

  INSERT INTO public.reserved_vehicles (
    time_period_id,
    vehicle_id,
    status,
    external_status,
    external_note,
    start_at,
    end_at
  )
  SELECT
    m.new_id,
    rv.vehicle_id,
    rv.status,
    rv.external_status,
    rv.external_note,
    rv.start_at,
    rv.end_at
  FROM public.reserved_vehicles rv
  JOIN tp_map m ON m.old_id = rv.time_period_id;

  CREATE TEMP TABLE offer_map (
    old_id uuid PRIMARY KEY,
    new_id uuid NOT NULL
  ) ON COMMIT DROP;

  FOR v_old_offer IN
    SELECT *
    FROM public.job_offers
    WHERE job_id = p_job_id
    ORDER BY created_at ASC
  LOOP
    v_offer_version := v_offer_version + 1;

    INSERT INTO public.job_offers (
      job_id,
      company_id,
      offer_type,
      version_number,
      status,
      access_token,
      title,
      days_of_use,
      discount_percent,
      vat_percent,
      show_price_per_line,
      equipment_subtotal,
      crew_subtotal,
      transport_subtotal,
      total_before_discount,
      total_after_discount,
      total_with_vat,
      bookings_synced_at,
      locked,
      based_on_offer_id,
      copied_from_job_id,
      copied_from_offer_id
    )
    VALUES (
      v_new_job_id,
      v_old_offer.company_id,
      v_old_offer.offer_type,
      v_offer_version,
      'draft',
      md5(random()::text || clock_timestamp()::text || v_old_offer.id::text),
      v_old_offer.title,
      v_old_offer.days_of_use,
      v_old_offer.discount_percent,
      v_old_offer.vat_percent,
      v_old_offer.show_price_per_line,
      v_old_offer.equipment_subtotal,
      v_old_offer.crew_subtotal,
      v_old_offer.transport_subtotal,
      v_old_offer.total_before_discount,
      v_old_offer.total_after_discount,
      v_old_offer.total_with_vat,
      NULL,
      false,
      NULL,
      p_job_id,
      v_old_offer.id
    )
    RETURNING id INTO v_new_offer_id;

    INSERT INTO offer_map(old_id, new_id) VALUES (v_old_offer.id, v_new_offer_id);

    CREATE TEMP TABLE offer_group_map (
      old_id uuid PRIMARY KEY,
      new_id uuid NOT NULL
    ) ON COMMIT DROP;

    FOR v_old_group IN
      SELECT *
      FROM public.offer_equipment_groups
      WHERE offer_id = v_old_offer.id
      ORDER BY sort_order ASC
    LOOP
      INSERT INTO public.offer_equipment_groups (
        offer_id,
        group_name,
        sort_order
      )
      VALUES (
        v_new_offer_id,
        v_old_group.group_name,
        v_old_group.sort_order
      )
      RETURNING id INTO v_new_group_id;

      INSERT INTO offer_group_map(old_id, new_id)
      VALUES (v_old_group.id, v_new_group_id);
    END LOOP;

    INSERT INTO public.offer_equipment_items (
      offer_group_id,
      item_id,
      group_id,
      custom_line_description,
      quantity,
      unit_price,
      total_price,
      is_internal,
      sort_order
    )
    SELECT
      ogm.new_id,
      i.item_id,
      i.group_id,
      i.custom_line_description,
      i.quantity,
      i.unit_price,
      i.total_price,
      i.is_internal,
      i.sort_order
    FROM public.offer_equipment_items i
    JOIN offer_group_map ogm ON ogm.old_id = i.offer_group_id;

    INSERT INTO public.offer_crew_items (
      offer_id,
      role_title,
      role_category,
      crew_count,
      start_date,
      end_date,
      daily_rate,
      hourly_rate,
      hours_per_day,
      billing_type,
      total_price,
      sort_order
    )
    SELECT
      v_new_offer_id,
      ci.role_title,
      ci.role_category,
      ci.crew_count,
      ci.start_date,
      ci.end_date,
      ci.daily_rate,
      ci.hourly_rate,
      ci.hours_per_day,
      ci.billing_type,
      ci.total_price,
      ci.sort_order
    FROM public.offer_crew_items ci
    WHERE ci.offer_id = v_old_offer.id;

    INSERT INTO public.offer_transport_items (
      offer_id,
      vehicle_name,
      vehicle_id,
      vehicle_category,
      distance_km,
      distance_rate,
      start_date,
      end_date,
      days_used,
      daily_rate_count,
      daily_rate,
      total_price,
      is_internal,
      sort_order
    )
    SELECT
      v_new_offer_id,
      ti.vehicle_name,
      ti.vehicle_id,
      ti.vehicle_category,
      ti.distance_km,
      ti.distance_rate,
      ti.start_date,
      ti.end_date,
      ti.days_used,
      ti.daily_rate_count,
      ti.daily_rate,
      ti.total_price,
      ti.is_internal,
      ti.sort_order
    FROM public.offer_transport_items ti
    WHERE ti.offer_id = v_old_offer.id;

    INSERT INTO public.offer_pretty_sections (
      offer_id,
      section_type,
      title,
      content,
      image_url,
      sort_order
    )
    SELECT
      v_new_offer_id,
      ps.section_type,
      ps.title,
      ps.content,
      ps.image_url,
      ps.sort_order
    FROM public.offer_pretty_sections ps
    WHERE ps.offer_id = v_old_offer.id;

    DROP TABLE IF EXISTS offer_group_map;
  END LOOP;

  RETURN v_new_job_id;
END;
$$;
