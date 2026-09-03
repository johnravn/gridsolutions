-- Optimize RLS InitPlan on hot tables: wrap auth.uid()/auth.jwt() in (select ...)
-- Also drop stale JWT company_id policy on items (duplicate SELECT).
-- Refs #82

DROP POLICY IF EXISTS "items read own company" ON public.items;

DROP POLICY IF EXISTS "Owners can delete activities" ON public.activity_log;
CREATE POLICY "Owners can delete activities" ON public.activity_log FOR UPDATE
  USING ((EXISTS ( SELECT 1
   FROM company_users
  WHERE ((company_users.company_id = activity_log.company_id) AND (company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role]))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM company_users
  WHERE ((company_users.company_id = activity_log.company_id) AND (company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role]))))));

DROP POLICY IF EXISTS "Users can create activities" ON public.activity_log;
CREATE POLICY "Users can create activities" ON public.activity_log FOR INSERT
  WITH CHECK (((EXISTS ( SELECT 1
   FROM company_users
  WHERE ((company_users.company_id = activity_log.company_id) AND (company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'employee'::company_role, 'super_user'::company_role]))))) AND (created_by_user_id = (select auth.uid()))));

DROP POLICY IF EXISTS "Users can view company activities" ON public.activity_log;
CREATE POLICY "Users can view company activities" ON public.activity_log FOR SELECT
  USING (((deleted = false) AND (EXISTS ( SELECT 1
   FROM (company_users cu
     JOIN company_expansions ce ON ((ce.company_id = cu.company_id)))
  WHERE ((cu.company_id = activity_log.company_id) AND (cu.user_id = (select auth.uid())) AND ((cu.role = ANY (ARRAY['owner'::company_role, 'employee'::company_role, 'super_user'::company_role])) OR ((cu.role = 'freelancer'::company_role) AND (ce.latest_feed_open_to_freelancers = true))))))));

DROP POLICY IF EXISTS "Company members can update company_users" ON public.company_users;
CREATE POLICY "Company members can update company_users" ON public.company_users FOR UPDATE
  USING ((user_has_company_role(company_id, (select auth.uid()), ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))))
  WITH CHECK ((user_has_company_role(company_id, (select auth.uid()), ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Company owners can delete company_users" ON public.company_users;
CREATE POLICY "Company owners can delete company_users" ON public.company_users FOR DELETE
  USING ((user_has_company_role(company_id, (select auth.uid()), ARRAY['owner'::company_role, 'super_user'::company_role]) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Company owners can manage company_users" ON public.company_users;
CREATE POLICY "Company owners can manage company_users" ON public.company_users FOR INSERT
  WITH CHECK ((user_has_company_role(company_id, (select auth.uid()), ARRAY['owner'::company_role, 'super_user'::company_role]) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Users can view company_users for their companies" ON public.company_users;
CREATE POLICY "Users can view company_users for their companies" ON public.company_users FOR SELECT
  USING (((user_id = (select auth.uid())) OR user_is_company_member(company_id, (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Users can create items for their companies" ON public.items;
CREATE POLICY "Users can create items for their companies" ON public.items FOR INSERT
  WITH CHECK (((EXISTS ( SELECT 1
   FROM company_users
  WHERE ((company_users.company_id = items.company_id) AND (company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Users can delete items for their companies" ON public.items;
CREATE POLICY "Users can delete items for their companies" ON public.items FOR DELETE
  USING (((EXISTS ( SELECT 1
   FROM company_users
  WHERE ((company_users.company_id = items.company_id) AND (company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Users can update items for their companies" ON public.items;
CREATE POLICY "Users can update items for their companies" ON public.items FOR UPDATE
  USING (((EXISTS ( SELECT 1
   FROM company_users
  WHERE ((company_users.company_id = items.company_id) AND (company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM company_users
  WHERE ((company_users.company_id = items.company_id) AND (company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Users can view items for their companies" ON public.items;
CREATE POLICY "Users can view items for their companies" ON public.items FOR SELECT
  USING (((EXISTS ( SELECT 1
   FROM company_users
  WHERE ((company_users.company_id = items.company_id) AND (company_users.user_id = (select auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Users can create jobs for their companies" ON public.jobs;
CREATE POLICY "Users can create jobs for their companies" ON public.jobs FOR INSERT
  WITH CHECK (((EXISTS ( SELECT 1
   FROM company_users
  WHERE ((company_users.company_id = jobs.company_id) AND (company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Users can delete jobs for their companies" ON public.jobs;
CREATE POLICY "Users can delete jobs for their companies" ON public.jobs FOR DELETE
  USING (((EXISTS ( SELECT 1
   FROM company_users
  WHERE ((company_users.company_id = jobs.company_id) AND (company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Users can update jobs for their companies" ON public.jobs;
CREATE POLICY "Users can update jobs for their companies" ON public.jobs FOR UPDATE
  USING (((EXISTS ( SELECT 1
   FROM company_users
  WHERE ((company_users.company_id = jobs.company_id) AND (company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM company_users
  WHERE ((company_users.company_id = jobs.company_id) AND (company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Users can view jobs for their companies" ON public.jobs;
CREATE POLICY "Users can view jobs for their companies" ON public.jobs FOR SELECT
  USING (((EXISTS ( SELECT 1
   FROM company_users
  WHERE ((company_users.company_id = jobs.company_id) AND (company_users.user_id = (select auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Recipients can update their own status" ON public.matter_recipients;
CREATE POLICY "Recipients can update their own status" ON public.matter_recipients FOR UPDATE
  USING ((user_id = (select auth.uid())))
  WITH CHECK ((user_id = (select auth.uid())));

DROP POLICY IF EXISTS "Users can view matter recipients" ON public.matter_recipients;
CREATE POLICY "Users can view matter recipients" ON public.matter_recipients FOR SELECT
  USING (((user_id = (select auth.uid())) OR can_view_matter(matter_id)));

DROP POLICY IF EXISTS "Users can insert their own responses" ON public.matter_responses;
CREATE POLICY "Users can insert their own responses" ON public.matter_responses FOR INSERT
  WITH CHECK ((user_id = (select auth.uid())));

DROP POLICY IF EXISTS "Users can update their own responses" ON public.matter_responses;
CREATE POLICY "Users can update their own responses" ON public.matter_responses FOR UPDATE
  USING ((user_id = (select auth.uid())))
  WITH CHECK ((user_id = (select auth.uid())));

DROP POLICY IF EXISTS "Users can create matters for their company" ON public.matters;
CREATE POLICY "Users can create matters for their company" ON public.matters FOR INSERT
  WITH CHECK (((created_by_user_id = (select auth.uid())) AND (is_superuser((select auth.uid())) OR ((EXISTS ( SELECT 1
   FROM company_users cu
  WHERE ((cu.user_id = (select auth.uid())) AND (cu.company_id = matters.company_id) AND (cu.role = ANY (ARRAY['owner'::company_role, 'employee'::company_role]))))) AND (matter_type = ANY (ARRAY['announcement'::matter_type, 'crew_invite'::matter_type, 'vote'::matter_type, 'chat'::matter_type]))) OR ((EXISTS ( SELECT 1
   FROM company_users cu
  WHERE ((cu.user_id = (select auth.uid())) AND (cu.company_id = matters.company_id) AND (cu.role = 'super_user'::company_role)))) AND (matter_type = ANY (ARRAY['crew_invite'::matter_type, 'vote'::matter_type, 'chat'::matter_type]))) OR ((EXISTS ( SELECT 1
   FROM company_users cu
  WHERE ((cu.user_id = (select auth.uid())) AND (cu.company_id = matters.company_id) AND (cu.role = 'freelancer'::company_role)))) AND (matter_type = 'crew_invite'::matter_type)))));

DROP POLICY IF EXISTS "Users can delete matters they created" ON public.matters;
CREATE POLICY "Users can delete matters they created" ON public.matters FOR DELETE
  USING (((created_by_user_id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM company_users
  WHERE ((company_users.user_id = (select auth.uid())) AND (company_users.company_id = matters.company_id) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role]))))) OR is_superuser((select auth.uid()))));

DROP POLICY IF EXISTS "Users can update matters they created" ON public.matters;
CREATE POLICY "Users can update matters they created" ON public.matters FOR UPDATE
  USING (((created_by_user_id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM company_users
  WHERE ((company_users.user_id = (select auth.uid())) AND (company_users.company_id = matters.company_id) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role]))))) OR is_superuser((select auth.uid()))))
  WITH CHECK (((created_by_user_id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM company_users
  WHERE ((company_users.user_id = (select auth.uid())) AND (company_users.company_id = matters.company_id) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role]))))) OR is_superuser((select auth.uid()))));

DROP POLICY IF EXISTS "Users can view matters for their company" ON public.matters;
CREATE POLICY "Users can view matters for their company" ON public.matters FOR SELECT
  USING (((created_by_user_id = (select auth.uid())) OR can_view_matter(id)));

DROP POLICY IF EXISTS "Company members can create notifications for company users" ON public.notifications;
CREATE POLICY "Company members can create notifications for company users" ON public.notifications FOR INSERT
  WITH CHECK ((is_superuser((select auth.uid())) OR (((select auth.uid()) IS NOT NULL) AND (NOT (created_by_user_id IS DISTINCT FROM (select auth.uid()))) AND notification_insert_allowed_for_actor(company_id, user_id, (select auth.uid()))) OR (((select auth.uid()) IS NULL) AND (created_by_user_id IS NOT NULL) AND notification_insert_allowed_for_actor(company_id, user_id, created_by_user_id))));

DROP POLICY IF EXISTS "Users can update their own notifications (e.g. mark read)" ON public.notifications;
CREATE POLICY "Users can update their own notifications (e.g. mark read)" ON public.notifications FOR UPDATE
  USING ((user_id = (select auth.uid())))
  WITH CHECK ((user_id = (select auth.uid())));

DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
CREATE POLICY "Users can view their own notifications" ON public.notifications FOR SELECT
  USING (((user_id = (select auth.uid())) OR (created_by_user_id = (select auth.uid())) OR is_superuser((select auth.uid()))));

DROP POLICY IF EXISTS "Company members can view profiles" ON public.profiles;
CREATE POLICY "Company members can view profiles" ON public.profiles FOR SELECT
  USING (((user_id = (select auth.uid())) OR users_share_company((select auth.uid()), user_id) OR is_superuser((select auth.uid()))));

DROP POLICY IF EXISTS "read own profile" ON public.profiles;
CREATE POLICY "read own profile" ON public.profiles FOR SELECT
  USING (((select auth.uid()) = user_id));

DROP POLICY IF EXISTS "update own profile" ON public.profiles;
CREATE POLICY "update own profile" ON public.profiles FOR UPDATE
  USING (((select auth.uid()) = user_id));

DROP POLICY IF EXISTS "Users can create reserved_crew for their company time_periods" ON public.reserved_crew;
CREATE POLICY "Users can create reserved_crew for their company time_periods" ON public.reserved_crew FOR INSERT
  WITH CHECK (((EXISTS ( SELECT 1
   FROM (time_periods
     JOIN company_users ON ((company_users.company_id = time_periods.company_id)))
  WHERE ((time_periods.id = reserved_crew.time_period_id) AND (company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Users can delete reserved_crew for their company time_periods" ON public.reserved_crew;
CREATE POLICY "Users can delete reserved_crew for their company time_periods" ON public.reserved_crew FOR DELETE
  USING (((EXISTS ( SELECT 1
   FROM (time_periods
     JOIN company_users ON ((company_users.company_id = time_periods.company_id)))
  WHERE ((time_periods.id = reserved_crew.time_period_id) AND (company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Users can update reserved_crew for their company time_periods" ON public.reserved_crew;
CREATE POLICY "Users can update reserved_crew for their company time_periods" ON public.reserved_crew FOR UPDATE
  USING (((EXISTS ( SELECT 1
   FROM (time_periods
     JOIN company_users ON ((company_users.company_id = time_periods.company_id)))
  WHERE ((time_periods.id = reserved_crew.time_period_id) AND (company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))) OR (user_id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM (time_periods
     JOIN company_users ON ((company_users.company_id = time_periods.company_id)))
  WHERE ((time_periods.id = reserved_crew.time_period_id) AND (company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))) OR (user_id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Users can view reserved_crew for their company time_periods" ON public.reserved_crew;
CREATE POLICY "Users can view reserved_crew for their company time_periods" ON public.reserved_crew FOR SELECT
  USING (((EXISTS ( SELECT 1
   FROM (time_periods
     JOIN company_users ON ((company_users.company_id = time_periods.company_id)))
  WHERE ((time_periods.id = reserved_crew.time_period_id) AND (company_users.user_id = (select auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Users can view their own reserved_crew" ON public.reserved_crew;
CREATE POLICY "Users can view their own reserved_crew" ON public.reserved_crew FOR SELECT
  USING (((user_id = (select auth.uid())) OR is_superuser((select auth.uid()))));

DROP POLICY IF EXISTS "Users can create reserved_items for their company time_periods" ON public.reserved_items;
CREATE POLICY "Users can create reserved_items for their company time_periods" ON public.reserved_items FOR INSERT
  WITH CHECK (((EXISTS ( SELECT 1
   FROM (time_periods
     JOIN company_users ON ((company_users.company_id = time_periods.company_id)))
  WHERE ((time_periods.id = reserved_items.time_period_id) AND (company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Users can delete reserved_items for their company jobs" ON public.reserved_items;
CREATE POLICY "Users can delete reserved_items for their company jobs" ON public.reserved_items FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM time_periods tp
  WHERE ((tp.id = reserved_items.time_period_id) AND (tp.company_id IN ( SELECT company_users.company_id
           FROM company_users
          WHERE (company_users.user_id = (select auth.uid()))))))));

DROP POLICY IF EXISTS "Users can delete reserved_items for their company time_periods" ON public.reserved_items;
CREATE POLICY "Users can delete reserved_items for their company time_periods" ON public.reserved_items FOR DELETE
  USING (((EXISTS ( SELECT 1
   FROM (time_periods
     JOIN company_users ON ((company_users.company_id = time_periods.company_id)))
  WHERE ((time_periods.id = reserved_items.time_period_id) AND (company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Users can insert reserved_items for their company jobs" ON public.reserved_items;
CREATE POLICY "Users can insert reserved_items for their company jobs" ON public.reserved_items FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM time_periods tp
  WHERE ((tp.id = reserved_items.time_period_id) AND (tp.company_id IN ( SELECT company_users.company_id
           FROM company_users
          WHERE (company_users.user_id = (select auth.uid()))))))));

DROP POLICY IF EXISTS "Users can update reserved_items for their company jobs" ON public.reserved_items;
CREATE POLICY "Users can update reserved_items for their company jobs" ON public.reserved_items FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM time_periods tp
  WHERE ((tp.id = reserved_items.time_period_id) AND (tp.company_id IN ( SELECT company_users.company_id
           FROM company_users
          WHERE (company_users.user_id = (select auth.uid()))))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM time_periods tp
  WHERE ((tp.id = reserved_items.time_period_id) AND (tp.company_id IN ( SELECT company_users.company_id
           FROM company_users
          WHERE (company_users.user_id = (select auth.uid()))))))));

DROP POLICY IF EXISTS "Users can update reserved_items for their company time_periods" ON public.reserved_items;
CREATE POLICY "Users can update reserved_items for their company time_periods" ON public.reserved_items FOR UPDATE
  USING (((EXISTS ( SELECT 1
   FROM (time_periods
     JOIN company_users ON ((company_users.company_id = time_periods.company_id)))
  WHERE ((time_periods.id = reserved_items.time_period_id) AND (company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM (time_periods
     JOIN company_users ON ((company_users.company_id = time_periods.company_id)))
  WHERE ((time_periods.id = reserved_items.time_period_id) AND (company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Users can view reserved_items for their company jobs" ON public.reserved_items;
CREATE POLICY "Users can view reserved_items for their company jobs" ON public.reserved_items FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM time_periods tp
  WHERE ((tp.id = reserved_items.time_period_id) AND (tp.company_id IN ( SELECT company_users.company_id
           FROM company_users
          WHERE (company_users.user_id = (select auth.uid()))))))));

DROP POLICY IF EXISTS "Users can view reserved_items for their company time_periods" ON public.reserved_items;
CREATE POLICY "Users can view reserved_items for their company time_periods" ON public.reserved_items FOR SELECT
  USING (((EXISTS ( SELECT 1
   FROM (time_periods
     JOIN company_users ON ((company_users.company_id = time_periods.company_id)))
  WHERE ((time_periods.id = reserved_items.time_period_id) AND (company_users.user_id = (select auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Freelancers can view time_periods for their jobs" ON public.time_periods;
CREATE POLICY "Freelancers can view time_periods for their jobs" ON public.time_periods FOR SELECT
  USING ((can_freelancer_view_job(company_id, job_id) OR is_superuser((select auth.uid()))));

DROP POLICY IF EXISTS "Users can create time_periods for their companies" ON public.time_periods;
CREATE POLICY "Users can create time_periods for their companies" ON public.time_periods FOR INSERT
  WITH CHECK (((EXISTS ( SELECT 1
   FROM company_users
  WHERE ((company_users.company_id = time_periods.company_id) AND (company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Users can delete time_periods for their companies" ON public.time_periods;
CREATE POLICY "Users can delete time_periods for their companies" ON public.time_periods FOR DELETE
  USING (((EXISTS ( SELECT 1
   FROM company_users
  WHERE ((company_users.company_id = time_periods.company_id) AND (company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Users can update time_periods for their companies" ON public.time_periods;
CREATE POLICY "Users can update time_periods for their companies" ON public.time_periods FOR UPDATE
  USING (((EXISTS ( SELECT 1
   FROM company_users
  WHERE ((company_users.company_id = time_periods.company_id) AND (company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM company_users
  WHERE ((company_users.company_id = time_periods.company_id) AND (company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Users can view time_periods for their companies" ON public.time_periods;
CREATE POLICY "Users can view time_periods for their companies" ON public.time_periods FOR SELECT
  USING (((EXISTS ( SELECT 1
   FROM company_users cu
  WHERE ((cu.company_id = time_periods.company_id) AND (cu.user_id = (select auth.uid())) AND (cu.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.user_id = (select auth.uid())) AND (p.superuser = true))))));

