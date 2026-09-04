-- Clear remaining advisor WARNs: search_path, duplicate indexes, multiple permissive policies.

-- ---------------------------------------------------------------------------
-- 1) function_search_path_mutable (4 trigger helpers)
-- ---------------------------------------------------------------------------

ALTER FUNCTION public.update_time_entries_updated_at() SET search_path TO 'public';
ALTER FUNCTION public.update_logging_periods_updated_at() SET search_path TO 'public';
ALTER FUNCTION public.update_job_money_items_updated_at() SET search_path TO 'public';
ALTER FUNCTION public.update_offer_bases_updated_at() SET search_path TO 'public';

-- ---------------------------------------------------------------------------
-- 2) duplicate_index
-- ---------------------------------------------------------------------------

DROP INDEX IF EXISTS public.reserved_items_item_idx;
DROP INDEX IF EXISTS public.reserved_items_reservation_idx;
DROP INDEX IF EXISTS public.vehicles_deleted_idx;

-- ---------------------------------------------------------------------------
-- 3) multiple_permissive_policies — consolidate
-- ---------------------------------------------------------------------------

-- profiles: merge SELECT; keep UPDATE own
DROP POLICY IF EXISTS "Company members can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "read own profile" ON public.profiles;
CREATE POLICY "Users can view accessible profiles"
  ON public.profiles
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.uid()) = user_id
    OR public.users_share_company((SELECT auth.uid()), user_id)
    OR public.is_superuser((SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "update own profile" ON public.profiles;
CREATE POLICY "update own profile"
  ON public.profiles
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- activity_comments: merge identical UPDATE policies
DROP POLICY IF EXISTS "Users can delete own comments" ON public.activity_comments;
DROP POLICY IF EXISTS "Users can update own comments" ON public.activity_comments;
CREATE POLICY "Users can update own comments"
  ON public.activity_comments
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (created_by_user_id = (SELECT auth.uid()))
  WITH CHECK (created_by_user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can create comments" ON public.activity_comments;
CREATE POLICY "Users can create comments"
  ON public.activity_comments
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (created_by_user_id = (SELECT auth.uid()))
    AND (
      EXISTS (
        SELECT 1
        FROM public.activity_log al
        JOIN public.company_users cu ON cu.company_id = al.company_id
        JOIN public.company_expansions ce ON ce.company_id = al.company_id
        WHERE al.id = activity_comments.activity_id
          AND al.deleted = false
          AND cu.user_id = (SELECT auth.uid())
          AND (
            cu.role = ANY (
              ARRAY[
                'owner'::public.company_role,
                'employee'::public.company_role,
                'super_user'::public.company_role
              ]
            )
            OR (
              cu.role = 'freelancer'::public.company_role
              AND ce.latest_feed_open_to_freelancers = true
            )
          )
      )
    )
  );

DROP POLICY IF EXISTS "Users can view comments" ON public.activity_comments;
CREATE POLICY "Users can view comments"
  ON public.activity_comments
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (
    deleted = false
    AND (
      EXISTS (
        SELECT 1
        FROM public.activity_log al
        JOIN public.company_users cu ON cu.company_id = al.company_id
        JOIN public.company_expansions ce ON ce.company_id = al.company_id
        WHERE al.id = activity_comments.activity_id
          AND cu.user_id = (SELECT auth.uid())
          AND (
            cu.role = ANY (
              ARRAY[
                'owner'::public.company_role,
                'employee'::public.company_role,
                'super_user'::public.company_role
              ]
            )
            OR (
              cu.role = 'freelancer'::public.company_role
              AND ce.latest_feed_open_to_freelancers = true
            )
          )
      )
    )
  );

-- activity_likes: narrow ALL → write cmds; keep separate SELECT for viewing others' likes
DROP POLICY IF EXISTS "Users can like activities" ON public.activity_likes;
CREATE POLICY "Users can like activities"
  ON public.activity_likes
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (user_id = (SELECT auth.uid()))
    AND (
      EXISTS (
        SELECT 1
        FROM public.activity_log al
        JOIN public.company_users cu ON cu.company_id = al.company_id
        JOIN public.company_expansions ce ON ce.company_id = al.company_id
        WHERE al.id = activity_likes.activity_id
          AND al.deleted = false
          AND cu.user_id = (SELECT auth.uid())
          AND (
            cu.role = ANY (
              ARRAY[
                'owner'::public.company_role,
                'employee'::public.company_role,
                'super_user'::public.company_role
              ]
            )
            OR (
              cu.role = 'freelancer'::public.company_role
              AND ce.latest_feed_open_to_freelancers = true
            )
          )
      )
    )
  );

CREATE POLICY "Users can update own likes"
  ON public.activity_likes
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (
    (user_id = (SELECT auth.uid()))
    AND (
      EXISTS (
        SELECT 1
        FROM public.activity_log al
        JOIN public.company_users cu ON cu.company_id = al.company_id
        JOIN public.company_expansions ce ON ce.company_id = al.company_id
        WHERE al.id = activity_likes.activity_id
          AND al.deleted = false
          AND cu.user_id = (SELECT auth.uid())
          AND (
            cu.role = ANY (
              ARRAY[
                'owner'::public.company_role,
                'employee'::public.company_role,
                'super_user'::public.company_role
              ]
            )
            OR (
              cu.role = 'freelancer'::public.company_role
              AND ce.latest_feed_open_to_freelancers = true
            )
          )
      )
    )
  )
  WITH CHECK (
    (user_id = (SELECT auth.uid()))
    AND (
      EXISTS (
        SELECT 1
        FROM public.activity_log al
        JOIN public.company_users cu ON cu.company_id = al.company_id
        JOIN public.company_expansions ce ON ce.company_id = al.company_id
        WHERE al.id = activity_likes.activity_id
          AND al.deleted = false
          AND cu.user_id = (SELECT auth.uid())
          AND (
            cu.role = ANY (
              ARRAY[
                'owner'::public.company_role,
                'employee'::public.company_role,
                'super_user'::public.company_role
              ]
            )
            OR (
              cu.role = 'freelancer'::public.company_role
              AND ce.latest_feed_open_to_freelancers = true
            )
          )
      )
    )
  );

CREATE POLICY "Users can delete own likes"
  ON public.activity_likes
  AS PERMISSIVE
  FOR DELETE
  TO authenticated
  USING (
    (user_id = (SELECT auth.uid()))
    AND (
      EXISTS (
        SELECT 1
        FROM public.activity_log al
        JOIN public.company_users cu ON cu.company_id = al.company_id
        JOIN public.company_expansions ce ON ce.company_id = al.company_id
        WHERE al.id = activity_likes.activity_id
          AND al.deleted = false
          AND cu.user_id = (SELECT auth.uid())
          AND (
            cu.role = ANY (
              ARRAY[
                'owner'::public.company_role,
                'employee'::public.company_role,
                'super_user'::public.company_role
              ]
            )
            OR (
              cu.role = 'freelancer'::public.company_role
              AND ce.latest_feed_open_to_freelancers = true
            )
          )
      )
    )
  );

DROP POLICY IF EXISTS "Users can view likes" ON public.activity_likes;
CREATE POLICY "Users can view likes"
  ON public.activity_likes
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.activity_log al
      JOIN public.company_users cu ON cu.company_id = al.company_id
      JOIN public.company_expansions ce ON ce.company_id = al.company_id
      WHERE al.id = activity_likes.activity_id
        AND al.deleted = false
        AND cu.user_id = (SELECT auth.uid())
        AND (
          cu.role = ANY (
            ARRAY[
              'owner'::public.company_role,
              'employee'::public.company_role,
              'super_user'::public.company_role
            ]
          )
          OR (
            cu.role = 'freelancer'::public.company_role
            AND ce.latest_feed_open_to_freelancers = true
          )
        )
    )
  );

-- company_expansions: owners write via INSERT/UPDATE/DELETE; all members SELECT
DROP POLICY IF EXISTS "Company owners can insert expansions" ON public.company_expansions;
DROP POLICY IF EXISTS "Company owners can manage expansions" ON public.company_expansions;

CREATE POLICY "Company owners can insert expansions"
  ON public.company_expansions
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (
      EXISTS (
        SELECT 1
        FROM public.company_users
        WHERE company_users.company_id = company_expansions.company_id
          AND company_users.user_id = (SELECT auth.uid())
          AND company_users.role = ANY (
            ARRAY['owner'::public.company_role, 'super_user'::public.company_role]
          )
      )
    )
    OR (
      EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE profiles.user_id = (SELECT auth.uid())
          AND profiles.superuser = true
      )
    )
  );

CREATE POLICY "Company owners can update expansions"
  ON public.company_expansions
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (
    (
      EXISTS (
        SELECT 1
        FROM public.company_users
        WHERE company_users.company_id = company_expansions.company_id
          AND company_users.user_id = (SELECT auth.uid())
          AND company_users.role = ANY (
            ARRAY['owner'::public.company_role, 'super_user'::public.company_role]
          )
      )
    )
    OR (
      EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE profiles.user_id = (SELECT auth.uid())
          AND profiles.superuser = true
      )
    )
  )
  WITH CHECK (
    (
      EXISTS (
        SELECT 1
        FROM public.company_users
        WHERE company_users.company_id = company_expansions.company_id
          AND company_users.user_id = (SELECT auth.uid())
          AND company_users.role = ANY (
            ARRAY['owner'::public.company_role, 'super_user'::public.company_role]
          )
      )
    )
    OR (
      EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE profiles.user_id = (SELECT auth.uid())
          AND profiles.superuser = true
      )
    )
  );

CREATE POLICY "Company owners can delete expansions"
  ON public.company_expansions
  AS PERMISSIVE
  FOR DELETE
  TO authenticated
  USING (
    (
      EXISTS (
        SELECT 1
        FROM public.company_users
        WHERE company_users.company_id = company_expansions.company_id
          AND company_users.user_id = (SELECT auth.uid())
          AND company_users.role = ANY (
            ARRAY['owner'::public.company_role, 'super_user'::public.company_role]
          )
      )
    )
    OR (
      EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE profiles.user_id = (SELECT auth.uid())
          AND profiles.superuser = true
      )
    )
  );

DROP POLICY IF EXISTS "Users can view company expansions" ON public.company_expansions;
CREATE POLICY "Users can view company expansions"
  ON public.company_expansions
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.company_users
      WHERE company_users.company_id = company_expansions.company_id
        AND company_users.user_id = (SELECT auth.uid())
    )
  );

-- offer_*: company write without SELECT so public SELECT is the sole SELECT policy
DROP POLICY IF EXISTS "Company members can manage their company's crew items"
  ON public.offer_crew_items;
CREATE POLICY "Company members can insert offer_crew_items"
  ON public.offer_crew_items AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (
    offer_basis_id IN (
      SELECT ob.id FROM public.offer_bases ob
      JOIN public.company_users cu ON ob.company_id = cu.company_id
      WHERE cu.user_id = (SELECT auth.uid())
    )
  );
CREATE POLICY "Company members can update offer_crew_items"
  ON public.offer_crew_items AS PERMISSIVE FOR UPDATE TO authenticated
  USING (
    offer_basis_id IN (
      SELECT ob.id FROM public.offer_bases ob
      JOIN public.company_users cu ON ob.company_id = cu.company_id
      WHERE cu.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    offer_basis_id IN (
      SELECT ob.id FROM public.offer_bases ob
      JOIN public.company_users cu ON ob.company_id = cu.company_id
      WHERE cu.user_id = (SELECT auth.uid())
    )
  );
CREATE POLICY "Company members can delete offer_crew_items"
  ON public.offer_crew_items AS PERMISSIVE FOR DELETE TO authenticated
  USING (
    offer_basis_id IN (
      SELECT ob.id FROM public.offer_bases ob
      JOIN public.company_users cu ON ob.company_id = cu.company_id
      WHERE cu.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Company members can manage their company's equipment groups"
  ON public.offer_equipment_groups;
CREATE POLICY "Company members can insert offer_equipment_groups"
  ON public.offer_equipment_groups AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (
    offer_basis_id IN (
      SELECT ob.id FROM public.offer_bases ob
      JOIN public.company_users cu ON ob.company_id = cu.company_id
      WHERE cu.user_id = (SELECT auth.uid())
    )
  );
CREATE POLICY "Company members can update offer_equipment_groups"
  ON public.offer_equipment_groups AS PERMISSIVE FOR UPDATE TO authenticated
  USING (
    offer_basis_id IN (
      SELECT ob.id FROM public.offer_bases ob
      JOIN public.company_users cu ON ob.company_id = cu.company_id
      WHERE cu.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    offer_basis_id IN (
      SELECT ob.id FROM public.offer_bases ob
      JOIN public.company_users cu ON ob.company_id = cu.company_id
      WHERE cu.user_id = (SELECT auth.uid())
    )
  );
CREATE POLICY "Company members can delete offer_equipment_groups"
  ON public.offer_equipment_groups AS PERMISSIVE FOR DELETE TO authenticated
  USING (
    offer_basis_id IN (
      SELECT ob.id FROM public.offer_bases ob
      JOIN public.company_users cu ON ob.company_id = cu.company_id
      WHERE cu.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Company members can manage their company's transport items"
  ON public.offer_transport_items;
CREATE POLICY "Company members can insert offer_transport_items"
  ON public.offer_transport_items AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (
    offer_basis_id IN (
      SELECT ob.id FROM public.offer_bases ob
      JOIN public.company_users cu ON ob.company_id = cu.company_id
      WHERE cu.user_id = (SELECT auth.uid())
    )
  );
CREATE POLICY "Company members can update offer_transport_items"
  ON public.offer_transport_items AS PERMISSIVE FOR UPDATE TO authenticated
  USING (
    offer_basis_id IN (
      SELECT ob.id FROM public.offer_bases ob
      JOIN public.company_users cu ON ob.company_id = cu.company_id
      WHERE cu.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    offer_basis_id IN (
      SELECT ob.id FROM public.offer_bases ob
      JOIN public.company_users cu ON ob.company_id = cu.company_id
      WHERE cu.user_id = (SELECT auth.uid())
    )
  );
CREATE POLICY "Company members can delete offer_transport_items"
  ON public.offer_transport_items AS PERMISSIVE FOR DELETE TO authenticated
  USING (
    offer_basis_id IN (
      SELECT ob.id FROM public.offer_bases ob
      JOIN public.company_users cu ON ob.company_id = cu.company_id
      WHERE cu.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Company members can manage their company's equipment items"
  ON public.offer_equipment_items;
CREATE POLICY "Company members can insert offer_equipment_items"
  ON public.offer_equipment_items
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (
    offer_group_id IN (
      SELECT og.id
      FROM public.offer_equipment_groups og
      JOIN public.offer_bases ob ON og.offer_basis_id = ob.id
      JOIN public.company_users cu ON ob.company_id = cu.company_id
      WHERE cu.user_id = (SELECT auth.uid())
    )
  );
CREATE POLICY "Company members can update offer_equipment_items"
  ON public.offer_equipment_items
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (
    offer_group_id IN (
      SELECT og.id
      FROM public.offer_equipment_groups og
      JOIN public.offer_bases ob ON og.offer_basis_id = ob.id
      JOIN public.company_users cu ON ob.company_id = cu.company_id
      WHERE cu.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    offer_group_id IN (
      SELECT og.id
      FROM public.offer_equipment_groups og
      JOIN public.offer_bases ob ON og.offer_basis_id = ob.id
      JOIN public.company_users cu ON ob.company_id = cu.company_id
      WHERE cu.user_id = (SELECT auth.uid())
    )
  );
CREATE POLICY "Company members can delete offer_equipment_items"
  ON public.offer_equipment_items
  AS PERMISSIVE
  FOR DELETE
  TO authenticated
  USING (
    offer_group_id IN (
      SELECT og.id
      FROM public.offer_equipment_groups og
      JOIN public.offer_bases ob ON og.offer_basis_id = ob.id
      JOIN public.company_users cu ON ob.company_id = cu.company_id
      WHERE cu.user_id = (SELECT auth.uid())
    )
  );

-- reserved_items: one policy per command (company member OR global superuser)
DROP POLICY IF EXISTS "Users can delete reserved_items for their company jobs" ON public.reserved_items;
DROP POLICY IF EXISTS "Users can delete reserved_items for their company time_periods" ON public.reserved_items;
DROP POLICY IF EXISTS "Users can create reserved_items for their company time_periods" ON public.reserved_items;
DROP POLICY IF EXISTS "Users can insert reserved_items for their company jobs" ON public.reserved_items;
DROP POLICY IF EXISTS "Users can view reserved_items for their company jobs" ON public.reserved_items;
DROP POLICY IF EXISTS "Users can view reserved_items for their company time_periods" ON public.reserved_items;
DROP POLICY IF EXISTS "Users can update reserved_items for their company jobs" ON public.reserved_items;
DROP POLICY IF EXISTS "Users can update reserved_items for their company time_periods" ON public.reserved_items;

CREATE POLICY "Users can view reserved_items for their company"
  ON public.reserved_items
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.time_periods tp
      JOIN public.company_users cu ON cu.company_id = tp.company_id
      WHERE tp.id = reserved_items.time_period_id
        AND cu.user_id = (SELECT auth.uid())
    )
    OR public.is_superuser((SELECT auth.uid()))
  );

CREATE POLICY "Users can insert reserved_items for their company"
  ON public.reserved_items
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.time_periods tp
      JOIN public.company_users cu ON cu.company_id = tp.company_id
      WHERE tp.id = reserved_items.time_period_id
        AND cu.user_id = (SELECT auth.uid())
    )
    OR public.is_superuser((SELECT auth.uid()))
  );

CREATE POLICY "Users can update reserved_items for their company"
  ON public.reserved_items
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.time_periods tp
      JOIN public.company_users cu ON cu.company_id = tp.company_id
      WHERE tp.id = reserved_items.time_period_id
        AND cu.user_id = (SELECT auth.uid())
    )
    OR public.is_superuser((SELECT auth.uid()))
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.time_periods tp
      JOIN public.company_users cu ON cu.company_id = tp.company_id
      WHERE tp.id = reserved_items.time_period_id
        AND cu.user_id = (SELECT auth.uid())
    )
    OR public.is_superuser((SELECT auth.uid()))
  );

CREATE POLICY "Users can delete reserved_items for their company"
  ON public.reserved_items
  AS PERMISSIVE
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.time_periods tp
      JOIN public.company_users cu ON cu.company_id = tp.company_id
      WHERE tp.id = reserved_items.time_period_id
        AND cu.user_id = (SELECT auth.uid())
    )
    OR public.is_superuser((SELECT auth.uid()))
  );

-- reserved_crew SELECT: company members OR own row OR superuser
DROP POLICY IF EXISTS "Users can view reserved_crew for their company time_periods" ON public.reserved_crew;
DROP POLICY IF EXISTS "Users can view their own reserved_crew" ON public.reserved_crew;
CREATE POLICY "Users can view reserved_crew"
  ON public.reserved_crew
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR public.is_superuser((SELECT auth.uid()))
    OR EXISTS (
      SELECT 1
      FROM public.time_periods
      JOIN public.company_users
        ON company_users.company_id = time_periods.company_id
      WHERE time_periods.id = reserved_crew.time_period_id
        AND company_users.user_id = (SELECT auth.uid())
    )
  );

-- time_periods SELECT: staff OR freelancer access OR superuser
DROP POLICY IF EXISTS "Freelancers can view time_periods for their jobs" ON public.time_periods;
DROP POLICY IF EXISTS "Users can view time_periods for their companies" ON public.time_periods;
CREATE POLICY "Users can view time_periods"
  ON public.time_periods
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (
    public.can_freelancer_view_job(company_id, job_id)
    OR public.is_superuser((SELECT auth.uid()))
    OR EXISTS (
      SELECT 1
      FROM public.company_users cu
      WHERE cu.company_id = time_periods.company_id
        AND cu.user_id = (SELECT auth.uid())
        AND cu.role = ANY (
          ARRAY[
            'owner'::public.company_role,
            'super_user'::public.company_role,
            'employee'::public.company_role
          ]
        )
    )
  );
