-- Optimize RLS InitPlan on remaining tables: wrap auth.uid() in (select ...)
-- Drop stale JWT company_id SELECT/INSERT policies (duplicates of company_users policies), same as #82 items.
-- Do not merge duplicate SELECT policies on reserved_crew / time_periods (freelancer access).
-- Refs #83

-- Stale JWT duplicates
DROP POLICY IF EXISTS "group_items read own company via group" ON public.group_items;
DROP POLICY IF EXISTS "group_items read via group company" ON public.group_items;
DROP POLICY IF EXISTS "group_price_history insert own company" ON public.group_price_history;
DROP POLICY IF EXISTS "group_price_history read own company" ON public.group_price_history;
DROP POLICY IF EXISTS "brands read own company" ON public.item_brands;
DROP POLICY IF EXISTS "categories read own company" ON public.item_categories;
DROP POLICY IF EXISTS "groups read own company" ON public.item_groups;
DROP POLICY IF EXISTS "item_price_history read own company" ON public.item_price_history;

DROP POLICY IF EXISTS "Users can create comments" ON public.activity_comments;
CREATE POLICY "Users can create comments" ON public.activity_comments AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((created_by_user_id = (select auth.uid())) AND (EXISTS ( SELECT 1
   FROM ((activity_log al
     JOIN company_users cu ON ((cu.company_id = al.company_id)))
     JOIN company_expansions ce ON ((ce.company_id = al.company_id)))
  WHERE ((al.id = activity_comments.activity_id) AND (al.deleted = false) AND ((cu.user_id = (select auth.uid())) AND ((cu.role = ANY (ARRAY['owner'::company_role, 'employee'::company_role, 'super_user'::company_role])) OR ((cu.role = 'freelancer'::company_role) AND (ce.latest_feed_open_to_freelancers = true)))))))));

DROP POLICY IF EXISTS "Users can delete own comments" ON public.activity_comments;
CREATE POLICY "Users can delete own comments" ON public.activity_comments AS PERMISSIVE FOR UPDATE TO public
  USING ((created_by_user_id = (select auth.uid())))
  WITH CHECK ((created_by_user_id = (select auth.uid())));

DROP POLICY IF EXISTS "Users can update own comments" ON public.activity_comments;
CREATE POLICY "Users can update own comments" ON public.activity_comments AS PERMISSIVE FOR UPDATE TO public
  USING ((created_by_user_id = (select auth.uid())))
  WITH CHECK ((created_by_user_id = (select auth.uid())));

DROP POLICY IF EXISTS "Users can view comments" ON public.activity_comments;
CREATE POLICY "Users can view comments" ON public.activity_comments AS PERMISSIVE FOR SELECT TO public
  USING (((deleted = false) AND (EXISTS ( SELECT 1
   FROM ((activity_log al
     JOIN company_users cu ON ((cu.company_id = al.company_id)))
     JOIN company_expansions ce ON ((ce.company_id = al.company_id)))
  WHERE ((al.id = activity_comments.activity_id) AND ((cu.user_id = (select auth.uid())) AND ((cu.role = ANY (ARRAY['owner'::company_role, 'employee'::company_role, 'super_user'::company_role])) OR ((cu.role = 'freelancer'::company_role) AND (ce.latest_feed_open_to_freelancers = true)))))))));

DROP POLICY IF EXISTS "Users can like activities" ON public.activity_likes;
CREATE POLICY "Users can like activities" ON public.activity_likes AS PERMISSIVE FOR ALL TO public
  USING (((user_id = (select auth.uid())) AND (EXISTS ( SELECT 1
   FROM ((activity_log al
     JOIN company_users cu ON ((cu.company_id = al.company_id)))
     JOIN company_expansions ce ON ((ce.company_id = al.company_id)))
  WHERE ((al.id = activity_likes.activity_id) AND (al.deleted = false) AND ((cu.user_id = (select auth.uid())) AND ((cu.role = ANY (ARRAY['owner'::company_role, 'employee'::company_role, 'super_user'::company_role])) OR ((cu.role = 'freelancer'::company_role) AND (ce.latest_feed_open_to_freelancers = true)))))))))
  WITH CHECK (((user_id = (select auth.uid())) AND (EXISTS ( SELECT 1
   FROM ((activity_log al
     JOIN company_users cu ON ((cu.company_id = al.company_id)))
     JOIN company_expansions ce ON ((ce.company_id = al.company_id)))
  WHERE ((al.id = activity_likes.activity_id) AND (al.deleted = false) AND ((cu.user_id = (select auth.uid())) AND ((cu.role = ANY (ARRAY['owner'::company_role, 'employee'::company_role, 'super_user'::company_role])) OR ((cu.role = 'freelancer'::company_role) AND (ce.latest_feed_open_to_freelancers = true)))))))));

DROP POLICY IF EXISTS "Users can view likes" ON public.activity_likes;
CREATE POLICY "Users can view likes" ON public.activity_likes AS PERMISSIVE FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM ((activity_log al
     JOIN company_users cu ON ((cu.company_id = al.company_id)))
     JOIN company_expansions ce ON ((ce.company_id = al.company_id)))
  WHERE ((al.id = activity_likes.activity_id) AND (al.deleted = false) AND ((cu.user_id = (select auth.uid())) AND ((cu.role = ANY (ARRAY['owner'::company_role, 'employee'::company_role, 'super_user'::company_role])) OR ((cu.role = 'freelancer'::company_role) AND (ce.latest_feed_open_to_freelancers = true))))))));

DROP POLICY IF EXISTS "Users can create company addresses" ON public.addresses;
CREATE POLICY "Users can create company addresses" ON public.addresses AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((((company_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM company_users
  WHERE ((company_users.company_id = addresses.company_id) AND (company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role])))))) OR ((is_personal = true) AND (company_id IS NULL)) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Users can delete company addresses" ON public.addresses;
CREATE POLICY "Users can delete company addresses" ON public.addresses AS PERMISSIVE FOR DELETE TO public
  USING ((((company_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM company_users
  WHERE ((company_users.company_id = addresses.company_id) AND (company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role])))))) OR ((is_personal = true) AND (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.primary_address_id = addresses.id) AND (profiles.user_id = (select auth.uid())))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Users can update company addresses" ON public.addresses;
CREATE POLICY "Users can update company addresses" ON public.addresses AS PERMISSIVE FOR UPDATE TO public
  USING ((((company_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM company_users
  WHERE ((company_users.company_id = addresses.company_id) AND (company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role])))))) OR ((is_personal = true) AND (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.primary_address_id = addresses.id) AND (profiles.user_id = (select auth.uid())))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))))
  WITH CHECK ((((company_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM company_users
  WHERE ((company_users.company_id = addresses.company_id) AND (company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role])))))) OR ((is_personal = true) AND (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.primary_address_id = addresses.id) AND (profiles.user_id = (select auth.uid())))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Users can view company addresses" ON public.addresses;
CREATE POLICY "Users can view company addresses" ON public.addresses AS PERMISSIVE FOR SELECT TO public
  USING ((((company_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM company_users
  WHERE ((company_users.company_id = addresses.company_id) AND (company_users.user_id = (select auth.uid())))))) OR ((is_personal = true) AND (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.primary_address_id = addresses.id) AND (profiles.user_id = (select auth.uid())))))) OR ((is_personal = true) AND (EXISTS ( SELECT 1
   FROM ((profiles p
     JOIN company_users cu_target ON ((cu_target.user_id = p.user_id)))
     JOIN company_users cu_self ON ((cu_self.company_id = cu_target.company_id)))
  WHERE ((p.primary_address_id = addresses.id) AND (cu_self.user_id = (select auth.uid())))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Users can delete own calendar subscription" ON public.calendar_subscriptions;
CREATE POLICY "Users can delete own calendar subscription" ON public.calendar_subscriptions AS PERMISSIVE FOR DELETE TO public
  USING (((user_id = (select auth.uid())) AND (EXISTS ( SELECT 1
   FROM company_users cu
  WHERE ((cu.company_id = calendar_subscriptions.company_id) AND (cu.user_id = (select auth.uid())))))));

DROP POLICY IF EXISTS "Users can insert own calendar subscription" ON public.calendar_subscriptions;
CREATE POLICY "Users can insert own calendar subscription" ON public.calendar_subscriptions AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((user_id = (select auth.uid())) AND (EXISTS ( SELECT 1
   FROM company_users cu
  WHERE ((cu.company_id = calendar_subscriptions.company_id) AND (cu.user_id = (select auth.uid())))))));

DROP POLICY IF EXISTS "Users can update own calendar subscription" ON public.calendar_subscriptions;
CREATE POLICY "Users can update own calendar subscription" ON public.calendar_subscriptions AS PERMISSIVE FOR UPDATE TO public
  USING (((user_id = (select auth.uid())) AND (EXISTS ( SELECT 1
   FROM company_users cu
  WHERE ((cu.company_id = calendar_subscriptions.company_id) AND (cu.user_id = (select auth.uid())))))))
  WITH CHECK (((user_id = (select auth.uid())) AND (EXISTS ( SELECT 1
   FROM company_users cu
  WHERE ((cu.company_id = calendar_subscriptions.company_id) AND (cu.user_id = (select auth.uid())))))));

DROP POLICY IF EXISTS "Users can view own calendar subscription" ON public.calendar_subscriptions;
CREATE POLICY "Users can view own calendar subscription" ON public.calendar_subscriptions AS PERMISSIVE FOR SELECT TO public
  USING (((user_id = (select auth.uid())) AND (EXISTS ( SELECT 1
   FROM company_users cu
  WHERE ((cu.company_id = calendar_subscriptions.company_id) AND (cu.user_id = (select auth.uid())))))));

DROP POLICY IF EXISTS "Company owners can update their company" ON public.companies;
CREATE POLICY "Company owners can update their company" ON public.companies AS PERMISSIVE FOR UPDATE TO public
  USING (((EXISTS ( SELECT 1
   FROM company_users
  WHERE ((company_users.company_id = companies.id) AND (company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM company_users
  WHERE ((company_users.company_id = companies.id) AND (company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Superusers can delete companies" ON public.companies;
CREATE POLICY "Superusers can delete companies" ON public.companies AS PERMISSIVE FOR DELETE TO public
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true)))));

DROP POLICY IF EXISTS "Users can insert companies" ON public.companies;
CREATE POLICY "Users can insert companies" ON public.companies AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true)))));

DROP POLICY IF EXISTS "Users can view companies they belong to" ON public.companies;
CREATE POLICY "Users can view companies they belong to" ON public.companies AS PERMISSIVE FOR SELECT TO public
  USING (((EXISTS ( SELECT 1
   FROM company_users
  WHERE ((company_users.company_id = companies.id) AND (company_users.user_id = (select auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Company owners can insert expansions" ON public.company_expansions;
CREATE POLICY "Company owners can insert expansions" ON public.company_expansions AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((EXISTS ( SELECT 1
   FROM company_users
  WHERE ((company_users.company_id = company_expansions.company_id) AND (company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Company owners can manage expansions" ON public.company_expansions;
CREATE POLICY "Company owners can manage expansions" ON public.company_expansions AS PERMISSIVE FOR ALL TO public
  USING (((EXISTS ( SELECT 1
   FROM company_users
  WHERE ((company_users.company_id = company_expansions.company_id) AND (company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Users can view company expansions" ON public.company_expansions;
CREATE POLICY "Users can view company expansions" ON public.company_expansions AS PERMISSIVE FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM company_users
  WHERE ((company_users.company_id = company_expansions.company_id) AND (company_users.user_id = (select auth.uid()))))));

DROP POLICY IF EXISTS "Users can create company pretty offer default images" ON public.company_pretty_offer_default_images;
CREATE POLICY "Users can create company pretty offer default images" ON public.company_pretty_offer_default_images AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((EXISTS ( SELECT 1
   FROM company_users cu
  WHERE ((cu.company_id = company_pretty_offer_default_images.company_id) AND (cu.user_id = (select auth.uid())) AND (cu.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.user_id = (select auth.uid())) AND (p.superuser = true))))));

DROP POLICY IF EXISTS "Users can delete company pretty offer default images" ON public.company_pretty_offer_default_images;
CREATE POLICY "Users can delete company pretty offer default images" ON public.company_pretty_offer_default_images AS PERMISSIVE FOR DELETE TO public
  USING (((EXISTS ( SELECT 1
   FROM company_users cu
  WHERE ((cu.company_id = company_pretty_offer_default_images.company_id) AND (cu.user_id = (select auth.uid())) AND (cu.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.user_id = (select auth.uid())) AND (p.superuser = true))))));

DROP POLICY IF EXISTS "Users can update company pretty offer default images" ON public.company_pretty_offer_default_images;
CREATE POLICY "Users can update company pretty offer default images" ON public.company_pretty_offer_default_images AS PERMISSIVE FOR UPDATE TO public
  USING (((EXISTS ( SELECT 1
   FROM company_users cu
  WHERE ((cu.company_id = company_pretty_offer_default_images.company_id) AND (cu.user_id = (select auth.uid())) AND (cu.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.user_id = (select auth.uid())) AND (p.superuser = true))))))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM company_users cu
  WHERE ((cu.company_id = company_pretty_offer_default_images.company_id) AND (cu.user_id = (select auth.uid())) AND (cu.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.user_id = (select auth.uid())) AND (p.superuser = true))))));

DROP POLICY IF EXISTS "Users can view company pretty offer default images" ON public.company_pretty_offer_default_images;
CREATE POLICY "Users can view company pretty offer default images" ON public.company_pretty_offer_default_images AS PERMISSIVE FOR SELECT TO public
  USING (((EXISTS ( SELECT 1
   FROM company_users cu
  WHERE ((cu.company_id = company_pretty_offer_default_images.company_id) AND (cu.user_id = (select auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.user_id = (select auth.uid())) AND (p.superuser = true))))));

DROP POLICY IF EXISTS "Employees can delete company member internal notes" ON public.company_user_internal_notes;
CREATE POLICY "Employees can delete company member internal notes" ON public.company_user_internal_notes AS PERMISSIVE FOR DELETE TO public
  USING ((user_has_company_role(company_id, (select auth.uid()), ARRAY['owner'::company_role, 'employee'::company_role, 'super_user'::company_role]) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.user_id = (select auth.uid())) AND (p.superuser = true))))));

DROP POLICY IF EXISTS "Employees can insert company member internal notes" ON public.company_user_internal_notes;
CREATE POLICY "Employees can insert company member internal notes" ON public.company_user_internal_notes AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((user_has_company_role(company_id, (select auth.uid()), ARRAY['owner'::company_role, 'employee'::company_role, 'super_user'::company_role]) AND user_is_company_member(company_id, user_id)) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.user_id = (select auth.uid())) AND (p.superuser = true))))));

DROP POLICY IF EXISTS "Employees can update company member internal notes" ON public.company_user_internal_notes;
CREATE POLICY "Employees can update company member internal notes" ON public.company_user_internal_notes AS PERMISSIVE FOR UPDATE TO public
  USING ((user_has_company_role(company_id, (select auth.uid()), ARRAY['owner'::company_role, 'employee'::company_role, 'super_user'::company_role]) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.user_id = (select auth.uid())) AND (p.superuser = true))))))
  WITH CHECK (((user_has_company_role(company_id, (select auth.uid()), ARRAY['owner'::company_role, 'employee'::company_role, 'super_user'::company_role]) AND user_is_company_member(company_id, user_id)) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.user_id = (select auth.uid())) AND (p.superuser = true))))));

DROP POLICY IF EXISTS "Employees can view company member internal notes" ON public.company_user_internal_notes;
CREATE POLICY "Employees can view company member internal notes" ON public.company_user_internal_notes AS PERMISSIVE FOR SELECT TO public
  USING ((user_has_company_role(company_id, (select auth.uid()), ARRAY['owner'::company_role, 'employee'::company_role, 'super_user'::company_role]) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.user_id = (select auth.uid())) AND (p.superuser = true))))));

DROP POLICY IF EXISTS "Users can create contacts for their companies" ON public.contacts;
CREATE POLICY "Users can create contacts for their companies" ON public.contacts AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((EXISTS ( SELECT 1
   FROM company_users
  WHERE ((company_users.company_id = contacts.company_id) AND (company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Users can delete contacts for their companies" ON public.contacts;
CREATE POLICY "Users can delete contacts for their companies" ON public.contacts AS PERMISSIVE FOR DELETE TO public
  USING (((EXISTS ( SELECT 1
   FROM company_users
  WHERE ((company_users.company_id = contacts.company_id) AND (company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Users can update contacts for their companies" ON public.contacts;
CREATE POLICY "Users can update contacts for their companies" ON public.contacts AS PERMISSIVE FOR UPDATE TO public
  USING (((EXISTS ( SELECT 1
   FROM company_users
  WHERE ((company_users.company_id = contacts.company_id) AND (company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM company_users
  WHERE ((company_users.company_id = contacts.company_id) AND (company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Users can view contacts for their companies" ON public.contacts;
CREATE POLICY "Users can view contacts for their companies" ON public.contacts AS PERMISSIVE FOR SELECT TO public
  USING (((EXISTS ( SELECT 1
   FROM company_users
  WHERE ((company_users.company_id = contacts.company_id) AND (company_users.user_id = (select auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Users can create crew_pricing_levels for their companies" ON public.crew_pricing_levels;
CREATE POLICY "Users can create crew_pricing_levels for their companies" ON public.crew_pricing_levels AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((EXISTS ( SELECT 1
   FROM company_users
  WHERE ((company_users.company_id = crew_pricing_levels.company_id) AND (company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Users can delete crew_pricing_levels for their companies" ON public.crew_pricing_levels;
CREATE POLICY "Users can delete crew_pricing_levels for their companies" ON public.crew_pricing_levels AS PERMISSIVE FOR DELETE TO public
  USING (((EXISTS ( SELECT 1
   FROM company_users
  WHERE ((company_users.company_id = crew_pricing_levels.company_id) AND (company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Users can update crew_pricing_levels for their companies" ON public.crew_pricing_levels;
CREATE POLICY "Users can update crew_pricing_levels for their companies" ON public.crew_pricing_levels AS PERMISSIVE FOR UPDATE TO public
  USING (((EXISTS ( SELECT 1
   FROM company_users
  WHERE ((company_users.company_id = crew_pricing_levels.company_id) AND (company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM company_users
  WHERE ((company_users.company_id = crew_pricing_levels.company_id) AND (company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Users can view crew_pricing_levels for their companies" ON public.crew_pricing_levels;
CREATE POLICY "Users can view crew_pricing_levels for their companies" ON public.crew_pricing_levels AS PERMISSIVE FOR SELECT TO public
  USING (((EXISTS ( SELECT 1
   FROM company_users
  WHERE ((company_users.company_id = crew_pricing_levels.company_id) AND (company_users.user_id = (select auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Users can create customers for their companies" ON public.customers;
CREATE POLICY "Users can create customers for their companies" ON public.customers AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((EXISTS ( SELECT 1
   FROM company_users
  WHERE ((company_users.company_id = customers.company_id) AND (company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Users can delete customers for their companies" ON public.customers;
CREATE POLICY "Users can delete customers for their companies" ON public.customers AS PERMISSIVE FOR DELETE TO public
  USING (((EXISTS ( SELECT 1
   FROM company_users
  WHERE ((company_users.company_id = customers.company_id) AND (company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Users can update customers for their companies" ON public.customers;
CREATE POLICY "Users can update customers for their companies" ON public.customers AS PERMISSIVE FOR UPDATE TO public
  USING (((EXISTS ( SELECT 1
   FROM company_users
  WHERE ((company_users.company_id = customers.company_id) AND (company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM company_users
  WHERE ((company_users.company_id = customers.company_id) AND (company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Users can view customers for their companies" ON public.customers;
CREATE POLICY "Users can view customers for their companies" ON public.customers AS PERMISSIVE FOR SELECT TO public
  USING (((EXISTS ( SELECT 1
   FROM company_users
  WHERE ((company_users.company_id = customers.company_id) AND (company_users.user_id = (select auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Users can view their own auth logs" ON public.dev_auth_logs;
CREATE POLICY "Users can view their own auth logs" ON public.dev_auth_logs AS PERMISSIVE FOR SELECT TO public
  USING (((user_id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Users can create group_items for their company groups" ON public.group_items;
CREATE POLICY "Users can create group_items for their company groups" ON public.group_items AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((EXISTS ( SELECT 1
   FROM (item_groups
     JOIN company_users ON ((company_users.company_id = item_groups.company_id)))
  WHERE ((item_groups.id = group_items.group_id) AND (company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Users can delete group_items for their company groups" ON public.group_items;
CREATE POLICY "Users can delete group_items for their company groups" ON public.group_items AS PERMISSIVE FOR DELETE TO public
  USING (((EXISTS ( SELECT 1
   FROM (item_groups
     JOIN company_users ON ((company_users.company_id = item_groups.company_id)))
  WHERE ((item_groups.id = group_items.group_id) AND (company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Users can update group_items for their company groups" ON public.group_items;
CREATE POLICY "Users can update group_items for their company groups" ON public.group_items AS PERMISSIVE FOR UPDATE TO public
  USING (((EXISTS ( SELECT 1
   FROM (item_groups
     JOIN company_users ON ((company_users.company_id = item_groups.company_id)))
  WHERE ((item_groups.id = group_items.group_id) AND (company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM (item_groups
     JOIN company_users ON ((company_users.company_id = item_groups.company_id)))
  WHERE ((item_groups.id = group_items.group_id) AND (company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Users can view group_items for their company groups" ON public.group_items;
CREATE POLICY "Users can view group_items for their company groups" ON public.group_items AS PERMISSIVE FOR SELECT TO public
  USING (((EXISTS ( SELECT 1
   FROM (item_groups
     JOIN company_users ON ((company_users.company_id = item_groups.company_id)))
  WHERE ((item_groups.id = group_items.group_id) AND (company_users.user_id = (select auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Users can create group_price_history for their companies" ON public.group_price_history;
CREATE POLICY "Users can create group_price_history for their companies" ON public.group_price_history AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((EXISTS ( SELECT 1
   FROM company_users
  WHERE ((company_users.company_id = group_price_history.company_id) AND (company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Users can delete group_price_history for their companies" ON public.group_price_history;
CREATE POLICY "Users can delete group_price_history for their companies" ON public.group_price_history AS PERMISSIVE FOR DELETE TO public
  USING (((EXISTS ( SELECT 1
   FROM company_users
  WHERE ((company_users.company_id = group_price_history.company_id) AND (company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Users can update group_price_history for their companies" ON public.group_price_history;
CREATE POLICY "Users can update group_price_history for their companies" ON public.group_price_history AS PERMISSIVE FOR UPDATE TO public
  USING (((EXISTS ( SELECT 1
   FROM company_users
  WHERE ((company_users.company_id = group_price_history.company_id) AND (company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM company_users
  WHERE ((company_users.company_id = group_price_history.company_id) AND (company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Users can view group_price_history for their companies" ON public.group_price_history;
CREATE POLICY "Users can view group_price_history for their companies" ON public.group_price_history AS PERMISSIVE FOR SELECT TO public
  USING (((EXISTS ( SELECT 1
   FROM company_users
  WHERE ((company_users.company_id = group_price_history.company_id) AND (company_users.user_id = (select auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Users can create item_brands for their companies" ON public.item_brands;
CREATE POLICY "Users can create item_brands for their companies" ON public.item_brands AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((EXISTS ( SELECT 1
   FROM company_users
  WHERE ((company_users.company_id = item_brands.company_id) AND (company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Users can delete item_brands for their companies" ON public.item_brands;
CREATE POLICY "Users can delete item_brands for their companies" ON public.item_brands AS PERMISSIVE FOR DELETE TO public
  USING (((EXISTS ( SELECT 1
   FROM company_users
  WHERE ((company_users.company_id = item_brands.company_id) AND (company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Users can update item_brands for their companies" ON public.item_brands;
CREATE POLICY "Users can update item_brands for their companies" ON public.item_brands AS PERMISSIVE FOR UPDATE TO public
  USING (((EXISTS ( SELECT 1
   FROM company_users
  WHERE ((company_users.company_id = item_brands.company_id) AND (company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM company_users
  WHERE ((company_users.company_id = item_brands.company_id) AND (company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Users can view item_brands for their companies" ON public.item_brands;
CREATE POLICY "Users can view item_brands for their companies" ON public.item_brands AS PERMISSIVE FOR SELECT TO public
  USING (((EXISTS ( SELECT 1
   FROM company_users
  WHERE ((company_users.company_id = item_brands.company_id) AND (company_users.user_id = (select auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Users can create item_categories for their companies" ON public.item_categories;
CREATE POLICY "Users can create item_categories for their companies" ON public.item_categories AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((EXISTS ( SELECT 1
   FROM company_users
  WHERE ((company_users.company_id = item_categories.company_id) AND (company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Users can delete item_categories for their companies" ON public.item_categories;
CREATE POLICY "Users can delete item_categories for their companies" ON public.item_categories AS PERMISSIVE FOR DELETE TO public
  USING (((EXISTS ( SELECT 1
   FROM company_users
  WHERE ((company_users.company_id = item_categories.company_id) AND (company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Users can update item_categories for their companies" ON public.item_categories;
CREATE POLICY "Users can update item_categories for their companies" ON public.item_categories AS PERMISSIVE FOR UPDATE TO public
  USING (((EXISTS ( SELECT 1
   FROM company_users
  WHERE ((company_users.company_id = item_categories.company_id) AND (company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM company_users
  WHERE ((company_users.company_id = item_categories.company_id) AND (company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Users can view item_categories for their companies" ON public.item_categories;
CREATE POLICY "Users can view item_categories for their companies" ON public.item_categories AS PERMISSIVE FOR SELECT TO public
  USING (((EXISTS ( SELECT 1
   FROM company_users
  WHERE ((company_users.company_id = item_categories.company_id) AND (company_users.user_id = (select auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Users can create item_groups for their companies" ON public.item_groups;
CREATE POLICY "Users can create item_groups for their companies" ON public.item_groups AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((EXISTS ( SELECT 1
   FROM company_users
  WHERE ((company_users.company_id = item_groups.company_id) AND (company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Users can delete item_groups for their companies" ON public.item_groups;
CREATE POLICY "Users can delete item_groups for their companies" ON public.item_groups AS PERMISSIVE FOR DELETE TO public
  USING (((EXISTS ( SELECT 1
   FROM company_users
  WHERE ((company_users.company_id = item_groups.company_id) AND (company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Users can update item_groups for their companies" ON public.item_groups;
CREATE POLICY "Users can update item_groups for their companies" ON public.item_groups AS PERMISSIVE FOR UPDATE TO public
  USING (((EXISTS ( SELECT 1
   FROM company_users
  WHERE ((company_users.company_id = item_groups.company_id) AND (company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM company_users
  WHERE ((company_users.company_id = item_groups.company_id) AND (company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Users can view item_groups for their companies" ON public.item_groups;
CREATE POLICY "Users can view item_groups for their companies" ON public.item_groups AS PERMISSIVE FOR SELECT TO public
  USING (((EXISTS ( SELECT 1
   FROM company_users
  WHERE ((company_users.company_id = item_groups.company_id) AND (company_users.user_id = (select auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Users can create item_price_history for their companies" ON public.item_price_history;
CREATE POLICY "Users can create item_price_history for their companies" ON public.item_price_history AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((EXISTS ( SELECT 1
   FROM company_users
  WHERE ((company_users.company_id = item_price_history.company_id) AND (company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Users can delete item_price_history for their companies" ON public.item_price_history;
CREATE POLICY "Users can delete item_price_history for their companies" ON public.item_price_history AS PERMISSIVE FOR DELETE TO public
  USING (((EXISTS ( SELECT 1
   FROM company_users
  WHERE ((company_users.company_id = item_price_history.company_id) AND (company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Users can update item_price_history for their companies" ON public.item_price_history;
CREATE POLICY "Users can update item_price_history for their companies" ON public.item_price_history AS PERMISSIVE FOR UPDATE TO public
  USING (((EXISTS ( SELECT 1
   FROM company_users
  WHERE ((company_users.company_id = item_price_history.company_id) AND (company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM company_users
  WHERE ((company_users.company_id = item_price_history.company_id) AND (company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Users can view item_price_history for their companies" ON public.item_price_history;
CREATE POLICY "Users can view item_price_history for their companies" ON public.item_price_history AS PERMISSIVE FOR SELECT TO public
  USING (((EXISTS ( SELECT 1
   FROM company_users
  WHERE ((company_users.company_id = item_price_history.company_id) AND (company_users.user_id = (select auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Users can create item_related for their company items" ON public.item_related;
CREATE POLICY "Users can create item_related for their company items" ON public.item_related AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((EXISTS ( SELECT 1
   FROM (items
     JOIN company_users ON ((company_users.company_id = items.company_id)))
  WHERE ((items.id = item_related.item_a_id) AND (company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Users can delete item_related for their company items" ON public.item_related;
CREATE POLICY "Users can delete item_related for their company items" ON public.item_related AS PERMISSIVE FOR DELETE TO public
  USING (((EXISTS ( SELECT 1
   FROM (items
     JOIN company_users ON ((company_users.company_id = items.company_id)))
  WHERE ((items.id = item_related.item_a_id) AND (company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Users can update item_related for their company items" ON public.item_related;
CREATE POLICY "Users can update item_related for their company items" ON public.item_related AS PERMISSIVE FOR UPDATE TO public
  USING (((EXISTS ( SELECT 1
   FROM (items
     JOIN company_users ON ((company_users.company_id = items.company_id)))
  WHERE ((items.id = item_related.item_a_id) AND (company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM (items
     JOIN company_users ON ((company_users.company_id = items.company_id)))
  WHERE ((items.id = item_related.item_a_id) AND (company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Users can view item_related for their company items" ON public.item_related;
CREATE POLICY "Users can view item_related for their company items" ON public.item_related AS PERMISSIVE FOR SELECT TO public
  USING (((EXISTS ( SELECT 1
   FROM (items
     JOIN company_users ON ((company_users.company_id = items.company_id)))
  WHERE ((items.id = item_related.item_a_id) AND (company_users.user_id = (select auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Users can create job_contacts for their company jobs" ON public.job_contacts;
CREATE POLICY "Users can create job_contacts for their company jobs" ON public.job_contacts AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((EXISTS ( SELECT 1
   FROM (jobs
     JOIN company_users ON ((company_users.company_id = jobs.company_id)))
  WHERE ((jobs.id = job_contacts.job_id) AND (company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Users can delete job_contacts for their company jobs" ON public.job_contacts;
CREATE POLICY "Users can delete job_contacts for their company jobs" ON public.job_contacts AS PERMISSIVE FOR DELETE TO public
  USING (((EXISTS ( SELECT 1
   FROM (jobs
     JOIN company_users ON ((company_users.company_id = jobs.company_id)))
  WHERE ((jobs.id = job_contacts.job_id) AND (company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Users can update job_contacts for their company jobs" ON public.job_contacts;
CREATE POLICY "Users can update job_contacts for their company jobs" ON public.job_contacts AS PERMISSIVE FOR UPDATE TO public
  USING (((EXISTS ( SELECT 1
   FROM (jobs
     JOIN company_users ON ((company_users.company_id = jobs.company_id)))
  WHERE ((jobs.id = job_contacts.job_id) AND (company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM (jobs
     JOIN company_users ON ((company_users.company_id = jobs.company_id)))
  WHERE ((jobs.id = job_contacts.job_id) AND (company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Users can view job_contacts for their company jobs" ON public.job_contacts;
CREATE POLICY "Users can view job_contacts for their company jobs" ON public.job_contacts AS PERMISSIVE FOR SELECT TO public
  USING (((EXISTS ( SELECT 1
   FROM (jobs
     JOIN company_users ON ((company_users.company_id = jobs.company_id)))
  WHERE ((jobs.id = job_contacts.job_id) AND (company_users.user_id = (select auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Users can create job_files for their company jobs" ON public.job_files;
CREATE POLICY "Users can create job_files for their company jobs" ON public.job_files AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((EXISTS ( SELECT 1
   FROM (jobs
     JOIN company_users ON ((company_users.company_id = jobs.company_id)))
  WHERE ((jobs.id = job_files.job_id) AND (company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Users can delete job_files for their company jobs" ON public.job_files;
CREATE POLICY "Users can delete job_files for their company jobs" ON public.job_files AS PERMISSIVE FOR DELETE TO public
  USING (((EXISTS ( SELECT 1
   FROM (jobs
     JOIN company_users ON ((company_users.company_id = jobs.company_id)))
  WHERE ((jobs.id = job_files.job_id) AND (company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Users can update job_files for their company jobs" ON public.job_files;
CREATE POLICY "Users can update job_files for their company jobs" ON public.job_files AS PERMISSIVE FOR UPDATE TO public
  USING (((EXISTS ( SELECT 1
   FROM (jobs
     JOIN company_users ON ((company_users.company_id = jobs.company_id)))
  WHERE ((jobs.id = job_files.job_id) AND (company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM (jobs
     JOIN company_users ON ((company_users.company_id = jobs.company_id)))
  WHERE ((jobs.id = job_files.job_id) AND (company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Users can view job_files for their company jobs" ON public.job_files;
CREATE POLICY "Users can view job_files for their company jobs" ON public.job_files AS PERMISSIVE FOR SELECT TO public
  USING (((EXISTS ( SELECT 1
   FROM (jobs
     JOIN company_users ON ((company_users.company_id = jobs.company_id)))
  WHERE ((jobs.id = job_files.job_id) AND (company_users.user_id = (select auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Users can create job_invoice_jobs for their company" ON public.job_invoice_jobs;
CREATE POLICY "Users can create job_invoice_jobs for their company" ON public.job_invoice_jobs AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((EXISTS ( SELECT 1
   FROM ((job_invoices ji
     JOIN jobs j ON ((j.id = ji.job_id)))
     JOIN company_users cu ON ((cu.company_id = j.company_id)))
  WHERE ((ji.id = job_invoice_jobs.invoice_id) AND (cu.user_id = (select auth.uid())) AND (cu.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))) AND (EXISTS ( SELECT 1
   FROM (jobs j2
     JOIN company_users cu2 ON ((cu2.company_id = j2.company_id)))
  WHERE ((j2.id = job_invoice_jobs.job_id) AND (cu2.user_id = (select auth.uid())) AND (cu2.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role])))))));

DROP POLICY IF EXISTS "Users can view job_invoice_jobs for their company" ON public.job_invoice_jobs;
CREATE POLICY "Users can view job_invoice_jobs for their company" ON public.job_invoice_jobs AS PERMISSIVE FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM ((job_invoices ji
     JOIN jobs j ON ((j.id = ji.job_id)))
     JOIN company_users cu ON ((cu.company_id = j.company_id)))
  WHERE ((ji.id = job_invoice_jobs.invoice_id) AND (cu.user_id = (select auth.uid()))))));

DROP POLICY IF EXISTS "Users can create invoices for their company jobs" ON public.job_invoices;
CREATE POLICY "Users can create invoices for their company jobs" ON public.job_invoices AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((EXISTS ( SELECT 1
   FROM (jobs j
     JOIN company_users cu ON ((cu.company_id = j.company_id)))
  WHERE ((j.id = job_invoices.job_id) AND (cu.user_id = (select auth.uid())) AND (cu.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))));

DROP POLICY IF EXISTS "Users can update invoices for their company jobs" ON public.job_invoices;
CREATE POLICY "Users can update invoices for their company jobs" ON public.job_invoices AS PERMISSIVE FOR UPDATE TO public
  USING ((EXISTS ( SELECT 1
   FROM (jobs j
     JOIN company_users cu ON ((cu.company_id = j.company_id)))
  WHERE ((j.id = job_invoices.job_id) AND (cu.user_id = (select auth.uid())) AND (cu.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM (jobs j
     JOIN company_users cu ON ((cu.company_id = j.company_id)))
  WHERE ((j.id = job_invoices.job_id) AND (cu.user_id = (select auth.uid())) AND (cu.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))));

DROP POLICY IF EXISTS "Users can view invoices for their company jobs" ON public.job_invoices;
CREATE POLICY "Users can view invoices for their company jobs" ON public.job_invoices AS PERMISSIVE FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM (jobs j
     JOIN company_users cu ON ((cu.company_id = j.company_id)))
  WHERE ((j.id = job_invoices.job_id) AND (cu.user_id = (select auth.uid()))))));

DROP POLICY IF EXISTS "Users can create money items for their company jobs" ON public.job_money_items;
CREATE POLICY "Users can create money items for their company jobs" ON public.job_money_items AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((EXISTS ( SELECT 1
   FROM (jobs j
     JOIN company_users cu ON ((cu.company_id = j.company_id)))
  WHERE ((j.id = job_money_items.job_id) AND (cu.user_id = (select auth.uid())) AND (cu.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))));

DROP POLICY IF EXISTS "Users can delete money items for their company jobs" ON public.job_money_items;
CREATE POLICY "Users can delete money items for their company jobs" ON public.job_money_items AS PERMISSIVE FOR DELETE TO public
  USING ((EXISTS ( SELECT 1
   FROM (jobs j
     JOIN company_users cu ON ((cu.company_id = j.company_id)))
  WHERE ((j.id = job_money_items.job_id) AND (cu.user_id = (select auth.uid())) AND (cu.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))));

DROP POLICY IF EXISTS "Users can update money items for their company jobs" ON public.job_money_items;
CREATE POLICY "Users can update money items for their company jobs" ON public.job_money_items AS PERMISSIVE FOR UPDATE TO public
  USING ((EXISTS ( SELECT 1
   FROM (jobs j
     JOIN company_users cu ON ((cu.company_id = j.company_id)))
  WHERE ((j.id = job_money_items.job_id) AND (cu.user_id = (select auth.uid())) AND (cu.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM (jobs j
     JOIN company_users cu ON ((cu.company_id = j.company_id)))
  WHERE ((j.id = job_money_items.job_id) AND (cu.user_id = (select auth.uid())) AND (cu.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))));

DROP POLICY IF EXISTS "Users can view money items for their company jobs" ON public.job_money_items;
CREATE POLICY "Users can view money items for their company jobs" ON public.job_money_items AS PERMISSIVE FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM (jobs j
     JOIN company_users cu ON ((cu.company_id = j.company_id)))
  WHERE ((j.id = job_money_items.job_id) AND (cu.user_id = (select auth.uid()))))));

DROP POLICY IF EXISTS "Users can create job_notes for their company jobs" ON public.job_notes;
CREATE POLICY "Users can create job_notes for their company jobs" ON public.job_notes AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((EXISTS ( SELECT 1
   FROM (jobs
     JOIN company_users ON ((company_users.company_id = jobs.company_id)))
  WHERE ((jobs.id = job_notes.job_id) AND (company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Users can delete job_notes for their company jobs" ON public.job_notes;
CREATE POLICY "Users can delete job_notes for their company jobs" ON public.job_notes AS PERMISSIVE FOR DELETE TO public
  USING (((EXISTS ( SELECT 1
   FROM (jobs
     JOIN company_users ON ((company_users.company_id = jobs.company_id)))
  WHERE ((jobs.id = job_notes.job_id) AND (company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Users can update job_notes for their company jobs" ON public.job_notes;
CREATE POLICY "Users can update job_notes for their company jobs" ON public.job_notes AS PERMISSIVE FOR UPDATE TO public
  USING (((EXISTS ( SELECT 1
   FROM (jobs
     JOIN company_users ON ((company_users.company_id = jobs.company_id)))
  WHERE ((jobs.id = job_notes.job_id) AND (company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM (jobs
     JOIN company_users ON ((company_users.company_id = jobs.company_id)))
  WHERE ((jobs.id = job_notes.job_id) AND (company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Users can view job_notes for their company jobs" ON public.job_notes;
CREATE POLICY "Users can view job_notes for their company jobs" ON public.job_notes AS PERMISSIVE FOR SELECT TO public
  USING (((EXISTS ( SELECT 1
   FROM (jobs
     JOIN company_users ON ((company_users.company_id = jobs.company_id)))
  WHERE ((jobs.id = job_notes.job_id) AND (company_users.user_id = (select auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Company members can manage their company's offers" ON public.job_offers;
CREATE POLICY "Company members can manage their company's offers" ON public.job_offers AS PERMISSIVE FOR ALL TO public
  USING ((company_id IN ( SELECT company_users.company_id
   FROM company_users
  WHERE (company_users.user_id = (select auth.uid())))));

DROP POLICY IF EXISTS "Users can create packing sessions for their company jobs" ON public.job_packing_sessions;
CREATE POLICY "Users can create packing sessions for their company jobs" ON public.job_packing_sessions AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((EXISTS ( SELECT 1
   FROM (jobs j
     JOIN company_users cu ON ((cu.company_id = j.company_id)))
  WHERE ((j.id = job_packing_sessions.job_id) AND (cu.user_id = (select auth.uid())) AND (cu.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))));

DROP POLICY IF EXISTS "Users can delete packing sessions for their company jobs" ON public.job_packing_sessions;
CREATE POLICY "Users can delete packing sessions for their company jobs" ON public.job_packing_sessions AS PERMISSIVE FOR DELETE TO public
  USING ((EXISTS ( SELECT 1
   FROM (jobs j
     JOIN company_users cu ON ((cu.company_id = j.company_id)))
  WHERE ((j.id = job_packing_sessions.job_id) AND (cu.user_id = (select auth.uid())) AND (cu.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))));

DROP POLICY IF EXISTS "Users can update packing sessions for their company jobs" ON public.job_packing_sessions;
CREATE POLICY "Users can update packing sessions for their company jobs" ON public.job_packing_sessions AS PERMISSIVE FOR UPDATE TO public
  USING ((EXISTS ( SELECT 1
   FROM (jobs j
     JOIN company_users cu ON ((cu.company_id = j.company_id)))
  WHERE ((j.id = job_packing_sessions.job_id) AND (cu.user_id = (select auth.uid())) AND (cu.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM (jobs j
     JOIN company_users cu ON ((cu.company_id = j.company_id)))
  WHERE ((j.id = job_packing_sessions.job_id) AND (cu.user_id = (select auth.uid())) AND (cu.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))));

DROP POLICY IF EXISTS "Users can view packing sessions for their company jobs" ON public.job_packing_sessions;
CREATE POLICY "Users can view packing sessions for their company jobs" ON public.job_packing_sessions AS PERMISSIVE FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM (jobs j
     JOIN company_users cu ON ((cu.company_id = j.company_id)))
  WHERE ((j.id = job_packing_sessions.job_id) AND (cu.user_id = (select auth.uid()))))));

DROP POLICY IF EXISTS "Users can create job_status_history for their company jobs" ON public.job_status_history;
CREATE POLICY "Users can create job_status_history for their company jobs" ON public.job_status_history AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((EXISTS ( SELECT 1
   FROM (jobs
     JOIN company_users ON ((company_users.company_id = jobs.company_id)))
  WHERE ((jobs.id = job_status_history.job_id) AND (company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Users can delete job_status_history for their company jobs" ON public.job_status_history;
CREATE POLICY "Users can delete job_status_history for their company jobs" ON public.job_status_history AS PERMISSIVE FOR DELETE TO public
  USING (((EXISTS ( SELECT 1
   FROM (jobs
     JOIN company_users ON ((company_users.company_id = jobs.company_id)))
  WHERE ((jobs.id = job_status_history.job_id) AND (company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Users can update job_status_history for their company jobs" ON public.job_status_history;
CREATE POLICY "Users can update job_status_history for their company jobs" ON public.job_status_history AS PERMISSIVE FOR UPDATE TO public
  USING (((EXISTS ( SELECT 1
   FROM (jobs
     JOIN company_users ON ((company_users.company_id = jobs.company_id)))
  WHERE ((jobs.id = job_status_history.job_id) AND (company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM (jobs
     JOIN company_users ON ((company_users.company_id = jobs.company_id)))
  WHERE ((jobs.id = job_status_history.job_id) AND (company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Users can view job_status_history for their company jobs" ON public.job_status_history;
CREATE POLICY "Users can view job_status_history for their company jobs" ON public.job_status_history AS PERMISSIVE FOR SELECT TO public
  USING (((EXISTS ( SELECT 1
   FROM (jobs
     JOIN company_users ON ((company_users.company_id = jobs.company_id)))
  WHERE ((jobs.id = job_status_history.job_id) AND (company_users.user_id = (select auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Company members can manage job subcontractor quotes" ON public.job_subcontractor_quotes;
CREATE POLICY "Company members can manage job subcontractor quotes" ON public.job_subcontractor_quotes AS PERMISSIVE FOR ALL TO public
  USING ((job_id IN ( SELECT j.id
   FROM (jobs j
     JOIN company_users cu ON ((j.company_id = cu.company_id)))
  WHERE (cu.user_id = (select auth.uid())))))
  WITH CHECK ((job_id IN ( SELECT j.id
   FROM (jobs j
     JOIN company_users cu ON ((j.company_id = cu.company_id)))
  WHERE (cu.user_id = (select auth.uid())))));

DROP POLICY IF EXISTS "Users can create job_subcontractors for their company jobs" ON public.job_subcontractors;
CREATE POLICY "Users can create job_subcontractors for their company jobs" ON public.job_subcontractors AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((EXISTS ( SELECT 1
   FROM (jobs
     JOIN company_users ON ((company_users.company_id = jobs.company_id)))
  WHERE ((jobs.id = job_subcontractors.job_id) AND (company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Users can delete job_subcontractors for their company jobs" ON public.job_subcontractors;
CREATE POLICY "Users can delete job_subcontractors for their company jobs" ON public.job_subcontractors AS PERMISSIVE FOR DELETE TO public
  USING (((EXISTS ( SELECT 1
   FROM (jobs
     JOIN company_users ON ((company_users.company_id = jobs.company_id)))
  WHERE ((jobs.id = job_subcontractors.job_id) AND (company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Users can update job_subcontractors for their company jobs" ON public.job_subcontractors;
CREATE POLICY "Users can update job_subcontractors for their company jobs" ON public.job_subcontractors AS PERMISSIVE FOR UPDATE TO public
  USING (((EXISTS ( SELECT 1
   FROM (jobs
     JOIN company_users ON ((company_users.company_id = jobs.company_id)))
  WHERE ((jobs.id = job_subcontractors.job_id) AND (company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM (jobs
     JOIN company_users ON ((company_users.company_id = jobs.company_id)))
  WHERE ((jobs.id = job_subcontractors.job_id) AND (company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Users can view job_subcontractors for their company jobs" ON public.job_subcontractors;
CREATE POLICY "Users can view job_subcontractors for their company jobs" ON public.job_subcontractors AS PERMISSIVE FOR SELECT TO public
  USING (((EXISTS ( SELECT 1
   FROM (jobs
     JOIN company_users ON ((company_users.company_id = jobs.company_id)))
  WHERE ((jobs.id = job_subcontractors.job_id) AND (company_users.user_id = (select auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Owners can delete logging periods" ON public.logging_periods;
CREATE POLICY "Owners can delete logging periods" ON public.logging_periods AS PERMISSIVE FOR DELETE TO public
  USING (((company_id IN ( SELECT company_users.company_id
   FROM company_users
  WHERE ((company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Owners can insert logging periods" ON public.logging_periods;
CREATE POLICY "Owners can insert logging periods" ON public.logging_periods AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((company_id IN ( SELECT company_users.company_id
   FROM company_users
  WHERE ((company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Owners can update logging periods" ON public.logging_periods;
CREATE POLICY "Owners can update logging periods" ON public.logging_periods AS PERMISSIVE FOR UPDATE TO public
  USING (((company_id IN ( SELECT company_users.company_id
   FROM company_users
  WHERE ((company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))))
  WITH CHECK (((company_id IN ( SELECT company_users.company_id
   FROM company_users
  WHERE ((company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Users can view logging periods" ON public.logging_periods;
CREATE POLICY "Users can view logging periods" ON public.logging_periods AS PERMISSIVE FOR SELECT TO public
  USING (((company_id IN ( SELECT company_users.company_id
   FROM company_users
  WHERE ((company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'employee'::company_role, 'super_user'::company_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Users can delete their own files" ON public.matter_files;
CREATE POLICY "Users can delete their own files" ON public.matter_files AS PERMISSIVE FOR DELETE TO public
  USING ((uploaded_by_user_id = (select auth.uid())));

DROP POLICY IF EXISTS "Users can insert matter files" ON public.matter_files;
CREATE POLICY "Users can insert matter files" ON public.matter_files AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((uploaded_by_user_id = (select auth.uid())) AND (EXISTS ( SELECT 1
   FROM matters
  WHERE ((matters.id = matter_files.matter_id) AND (EXISTS ( SELECT 1
           FROM company_users
          WHERE ((company_users.user_id = (select auth.uid())) AND (company_users.company_id = matters.company_id)))))))));

DROP POLICY IF EXISTS "Users can update their own files" ON public.matter_files;
CREATE POLICY "Users can update their own files" ON public.matter_files AS PERMISSIVE FOR UPDATE TO public
  USING ((uploaded_by_user_id = (select auth.uid())))
  WITH CHECK ((uploaded_by_user_id = (select auth.uid())));

DROP POLICY IF EXISTS "Users can insert matter messages" ON public.matter_messages;
CREATE POLICY "Users can insert matter messages" ON public.matter_messages AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((user_id = (select auth.uid())) AND (EXISTS ( SELECT 1
   FROM matters
  WHERE ((matters.id = matter_messages.matter_id) AND (EXISTS ( SELECT 1
           FROM company_users
          WHERE ((company_users.user_id = (select auth.uid())) AND (company_users.company_id = matters.company_id)))))))));

DROP POLICY IF EXISTS "Users can update their own messages" ON public.matter_messages;
CREATE POLICY "Users can update their own messages" ON public.matter_messages AS PERMISSIVE FOR UPDATE TO public
  USING ((user_id = (select auth.uid())))
  WITH CHECK ((user_id = (select auth.uid())));

DROP POLICY IF EXISTS "Users can insert their own notification preferences" ON public.notification_preferences;
CREATE POLICY "Users can insert their own notification preferences" ON public.notification_preferences AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((user_id = (select auth.uid())));

DROP POLICY IF EXISTS "Users can update their own notification preferences" ON public.notification_preferences;
CREATE POLICY "Users can update their own notification preferences" ON public.notification_preferences AS PERMISSIVE FOR UPDATE TO public
  USING ((user_id = (select auth.uid())))
  WITH CHECK ((user_id = (select auth.uid())));

DROP POLICY IF EXISTS "Users can view their own notification preferences" ON public.notification_preferences;
CREATE POLICY "Users can view their own notification preferences" ON public.notification_preferences AS PERMISSIVE FOR SELECT TO public
  USING ((user_id = (select auth.uid())));

DROP POLICY IF EXISTS "Company members can manage their company's offer bases" ON public.offer_bases;
CREATE POLICY "Company members can manage their company's offer bases" ON public.offer_bases AS PERMISSIVE FOR ALL TO public
  USING ((company_id IN ( SELECT company_users.company_id
   FROM company_users
  WHERE (company_users.user_id = (select auth.uid())))));

DROP POLICY IF EXISTS "Company members can manage their company's crew items" ON public.offer_crew_items;
CREATE POLICY "Company members can manage their company's crew items" ON public.offer_crew_items AS PERMISSIVE FOR ALL TO public
  USING ((offer_basis_id IN ( SELECT ob.id
   FROM (offer_bases ob
     JOIN company_users cu ON ((ob.company_id = cu.company_id)))
  WHERE (cu.user_id = (select auth.uid())))));

DROP POLICY IF EXISTS "Company members can manage their company's equipment groups" ON public.offer_equipment_groups;
CREATE POLICY "Company members can manage their company's equipment groups" ON public.offer_equipment_groups AS PERMISSIVE FOR ALL TO public
  USING ((offer_basis_id IN ( SELECT ob.id
   FROM (offer_bases ob
     JOIN company_users cu ON ((ob.company_id = cu.company_id)))
  WHERE (cu.user_id = (select auth.uid())))));

DROP POLICY IF EXISTS "Company members can manage their company's equipment items" ON public.offer_equipment_items;
CREATE POLICY "Company members can manage their company's equipment items" ON public.offer_equipment_items AS PERMISSIVE FOR ALL TO public
  USING ((offer_group_id IN ( SELECT og.id
   FROM ((offer_equipment_groups og
     JOIN offer_bases ob ON ((og.offer_basis_id = ob.id)))
     JOIN company_users cu ON ((ob.company_id = cu.company_id)))
  WHERE (cu.user_id = (select auth.uid())))));

DROP POLICY IF EXISTS "Company members can manage their company's pretty sections" ON public.offer_pretty_sections;
CREATE POLICY "Company members can manage their company's pretty sections" ON public.offer_pretty_sections AS PERMISSIVE FOR ALL TO public
  USING ((offer_id IN ( SELECT o.id
   FROM (job_offers o
     JOIN company_users cu ON ((o.company_id = cu.company_id)))
  WHERE (cu.user_id = (select auth.uid())))));

DROP POLICY IF EXISTS "Company members can manage their company's transport groups" ON public.offer_transport_groups;
CREATE POLICY "Company members can manage their company's transport groups" ON public.offer_transport_groups AS PERMISSIVE FOR ALL TO public
  USING ((offer_basis_id IN ( SELECT ob.id
   FROM (offer_bases ob
     JOIN company_users cu ON ((ob.company_id = cu.company_id)))
  WHERE (cu.user_id = (select auth.uid())))));

DROP POLICY IF EXISTS "Company members can manage their company's transport items" ON public.offer_transport_items;
CREATE POLICY "Company members can manage their company's transport items" ON public.offer_transport_items AS PERMISSIVE FOR ALL TO public
  USING ((offer_basis_id IN ( SELECT ob.id
   FROM (offer_bases ob
     JOIN company_users cu ON ((ob.company_id = cu.company_id)))
  WHERE (cu.user_id = (select auth.uid())))));

DROP POLICY IF EXISTS "Company members can create pending_invites" ON public.pending_invites;
CREATE POLICY "Company members can create pending_invites" ON public.pending_invites AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((EXISTS ( SELECT 1
   FROM company_users
  WHERE ((company_users.company_id = pending_invites.company_id) AND (company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Company members can delete pending_invites" ON public.pending_invites;
CREATE POLICY "Company members can delete pending_invites" ON public.pending_invites AS PERMISSIVE FOR DELETE TO public
  USING (((EXISTS ( SELECT 1
   FROM company_users
  WHERE ((company_users.company_id = pending_invites.company_id) AND (company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Company members can update pending_invites" ON public.pending_invites;
CREATE POLICY "Company members can update pending_invites" ON public.pending_invites AS PERMISSIVE FOR UPDATE TO public
  USING (((EXISTS ( SELECT 1
   FROM company_users
  WHERE ((company_users.company_id = pending_invites.company_id) AND (company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM company_users
  WHERE ((company_users.company_id = pending_invites.company_id) AND (company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Users can view pending_invites for their companies" ON public.pending_invites;
CREATE POLICY "Users can view pending_invites for their companies" ON public.pending_invites AS PERMISSIVE FOR SELECT TO public
  USING (((EXISTS ( SELECT 1
   FROM company_users
  WHERE ((company_users.company_id = pending_invites.company_id) AND (company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Company members can view personal calendar events" ON public.personal_calendar_events;
CREATE POLICY "Company members can view personal calendar events" ON public.personal_calendar_events AS PERMISSIVE FOR SELECT TO public
  USING (((user_id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM company_users cu
  WHERE ((cu.company_id = personal_calendar_events.company_id) AND (cu.user_id = (select auth.uid())) AND (cu.role <> 'freelancer'::company_role)))) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.user_id = (select auth.uid())) AND (p.superuser = true))))));

DROP POLICY IF EXISTS "Users can delete own personal calendar events" ON public.personal_calendar_events;
CREATE POLICY "Users can delete own personal calendar events" ON public.personal_calendar_events AS PERMISSIVE FOR DELETE TO public
  USING (((user_id = (select auth.uid())) AND (EXISTS ( SELECT 1
   FROM company_users cu
  WHERE ((cu.company_id = personal_calendar_events.company_id) AND (cu.user_id = (select auth.uid())))))));

DROP POLICY IF EXISTS "Users can insert own personal calendar events" ON public.personal_calendar_events;
CREATE POLICY "Users can insert own personal calendar events" ON public.personal_calendar_events AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((user_id = (select auth.uid())) AND (EXISTS ( SELECT 1
   FROM company_users cu
  WHERE ((cu.company_id = personal_calendar_events.company_id) AND (cu.user_id = (select auth.uid())))))));

DROP POLICY IF EXISTS "Users can update own personal calendar events" ON public.personal_calendar_events;
CREATE POLICY "Users can update own personal calendar events" ON public.personal_calendar_events AS PERMISSIVE FOR UPDATE TO public
  USING (((user_id = (select auth.uid())) AND (EXISTS ( SELECT 1
   FROM company_users cu
  WHERE ((cu.company_id = personal_calendar_events.company_id) AND (cu.user_id = (select auth.uid())))))))
  WITH CHECK (((user_id = (select auth.uid())) AND (EXISTS ( SELECT 1
   FROM company_users cu
  WHERE ((cu.company_id = personal_calendar_events.company_id) AND (cu.user_id = (select auth.uid())))))));

DROP POLICY IF EXISTS "Company members can manage pretty offer module block items" ON public.pretty_offer_module_block_items;
CREATE POLICY "Company members can manage pretty offer module block items" ON public.pretty_offer_module_block_items AS PERMISSIVE FOR ALL TO public
  USING ((block_id IN ( SELECT b.id
   FROM (((pretty_offer_module_blocks b
     JOIN pretty_offer_modules mod ON ((b.module_id = mod.id)))
     JOIN job_offers o ON ((mod.offer_id = o.id)))
     JOIN company_users cu ON ((o.company_id = cu.company_id)))
  WHERE (cu.user_id = (select auth.uid())))))
  WITH CHECK ((block_id IN ( SELECT b.id
   FROM (((pretty_offer_module_blocks b
     JOIN pretty_offer_modules mod ON ((b.module_id = mod.id)))
     JOIN job_offers o ON ((mod.offer_id = o.id)))
     JOIN company_users cu ON ((o.company_id = cu.company_id)))
  WHERE (cu.user_id = (select auth.uid())))));

DROP POLICY IF EXISTS "Company members can manage pretty offer module blocks" ON public.pretty_offer_module_blocks;
CREATE POLICY "Company members can manage pretty offer module blocks" ON public.pretty_offer_module_blocks AS PERMISSIVE FOR ALL TO public
  USING ((module_id IN ( SELECT mod.id
   FROM ((pretty_offer_modules mod
     JOIN job_offers o ON ((mod.offer_id = o.id)))
     JOIN company_users cu ON ((o.company_id = cu.company_id)))
  WHERE (cu.user_id = (select auth.uid())))))
  WITH CHECK ((module_id IN ( SELECT mod.id
   FROM ((pretty_offer_modules mod
     JOIN job_offers o ON ((mod.offer_id = o.id)))
     JOIN company_users cu ON ((o.company_id = cu.company_id)))
  WHERE (cu.user_id = (select auth.uid())))));

DROP POLICY IF EXISTS "Company members can manage pretty offer module media" ON public.pretty_offer_module_media;
CREATE POLICY "Company members can manage pretty offer module media" ON public.pretty_offer_module_media AS PERMISSIVE FOR ALL TO public
  USING ((module_id IN ( SELECT m.id
   FROM ((pretty_offer_modules m
     JOIN job_offers o ON ((m.offer_id = o.id)))
     JOIN company_users cu ON ((o.company_id = cu.company_id)))
  WHERE (cu.user_id = (select auth.uid())))))
  WITH CHECK ((module_id IN ( SELECT m.id
   FROM ((pretty_offer_modules m
     JOIN job_offers o ON ((m.offer_id = o.id)))
     JOIN company_users cu ON ((o.company_id = cu.company_id)))
  WHERE (cu.user_id = (select auth.uid())))));

DROP POLICY IF EXISTS "Company members can manage pretty offer module timeline items" ON public.pretty_offer_module_timeline_items;
CREATE POLICY "Company members can manage pretty offer module timeline items" ON public.pretty_offer_module_timeline_items AS PERMISSIVE FOR ALL TO public
  USING ((module_id IN ( SELECT mod.id
   FROM ((pretty_offer_modules mod
     JOIN job_offers o ON ((mod.offer_id = o.id)))
     JOIN company_users cu ON ((o.company_id = cu.company_id)))
  WHERE (cu.user_id = (select auth.uid())))))
  WITH CHECK ((module_id IN ( SELECT mod.id
   FROM ((pretty_offer_modules mod
     JOIN job_offers o ON ((mod.offer_id = o.id)))
     JOIN company_users cu ON ((o.company_id = cu.company_id)))
  WHERE (cu.user_id = (select auth.uid())))));

DROP POLICY IF EXISTS "Company members can manage pretty offer modules" ON public.pretty_offer_modules;
CREATE POLICY "Company members can manage pretty offer modules" ON public.pretty_offer_modules AS PERMISSIVE FOR ALL TO public
  USING ((offer_id IN ( SELECT o.id
   FROM (job_offers o
     JOIN company_users cu ON ((o.company_id = cu.company_id)))
  WHERE (cu.user_id = (select auth.uid())))))
  WITH CHECK ((offer_id IN ( SELECT o.id
   FROM (job_offers o
     JOIN company_users cu ON ((o.company_id = cu.company_id)))
  WHERE (cu.user_id = (select auth.uid())))));

DROP POLICY IF EXISTS "Company members can manage pretty offer pricing bases" ON public.pretty_offer_pricing_bases;
CREATE POLICY "Company members can manage pretty offer pricing bases" ON public.pretty_offer_pricing_bases AS PERMISSIVE FOR ALL TO public
  USING ((offer_id IN ( SELECT o.id
   FROM (job_offers o
     JOIN company_users cu ON ((o.company_id = cu.company_id)))
  WHERE (cu.user_id = (select auth.uid())))))
  WITH CHECK ((offer_id IN ( SELECT o.id
   FROM (job_offers o
     JOIN company_users cu ON ((o.company_id = cu.company_id)))
  WHERE (cu.user_id = (select auth.uid())))));

DROP POLICY IF EXISTS "Company members can manage pretty offer pricing basis splits" ON public.pretty_offer_pricing_basis_splits;
CREATE POLICY "Company members can manage pretty offer pricing basis splits" ON public.pretty_offer_pricing_basis_splits AS PERMISSIVE FOR ALL TO public
  USING ((basis_id IN ( SELECT pb.id
   FROM ((pretty_offer_pricing_bases pb
     JOIN job_offers o ON ((pb.offer_id = o.id)))
     JOIN company_users cu ON ((o.company_id = cu.company_id)))
  WHERE (cu.user_id = (select auth.uid())))))
  WITH CHECK ((basis_id IN ( SELECT pb.id
   FROM ((pretty_offer_pricing_bases pb
     JOIN job_offers o ON ((pb.offer_id = o.id)))
     JOIN company_users cu ON ((o.company_id = cu.company_id)))
  WHERE (cu.user_id = (select auth.uid())))));

DROP POLICY IF EXISTS "Users can create recurring job templates for their companies" ON public.recurring_job_templates;
CREATE POLICY "Users can create recurring job templates for their companies" ON public.recurring_job_templates AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((EXISTS ( SELECT 1
   FROM company_users
  WHERE ((company_users.company_id = recurring_job_templates.company_id) AND (company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Users can delete recurring job templates for their companies" ON public.recurring_job_templates;
CREATE POLICY "Users can delete recurring job templates for their companies" ON public.recurring_job_templates AS PERMISSIVE FOR DELETE TO public
  USING (((EXISTS ( SELECT 1
   FROM company_users
  WHERE ((company_users.company_id = recurring_job_templates.company_id) AND (company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Users can update recurring job templates for their companies" ON public.recurring_job_templates;
CREATE POLICY "Users can update recurring job templates for their companies" ON public.recurring_job_templates AS PERMISSIVE FOR UPDATE TO public
  USING (((EXISTS ( SELECT 1
   FROM company_users
  WHERE ((company_users.company_id = recurring_job_templates.company_id) AND (company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM company_users
  WHERE ((company_users.company_id = recurring_job_templates.company_id) AND (company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Users can view recurring job templates for their companies" ON public.recurring_job_templates;
CREATE POLICY "Users can view recurring job templates for their companies" ON public.recurring_job_templates AS PERMISSIVE FOR SELECT TO public
  USING (((EXISTS ( SELECT 1
   FROM company_users
  WHERE ((company_users.company_id = recurring_job_templates.company_id) AND (company_users.user_id = (select auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Users can create recurring jobs for their companies" ON public.recurring_jobs;
CREATE POLICY "Users can create recurring jobs for their companies" ON public.recurring_jobs AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((EXISTS ( SELECT 1
   FROM company_users
  WHERE ((company_users.company_id = recurring_jobs.company_id) AND (company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Users can delete recurring jobs for their companies" ON public.recurring_jobs;
CREATE POLICY "Users can delete recurring jobs for their companies" ON public.recurring_jobs AS PERMISSIVE FOR DELETE TO public
  USING (((EXISTS ( SELECT 1
   FROM company_users
  WHERE ((company_users.company_id = recurring_jobs.company_id) AND (company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Users can update recurring jobs for their companies" ON public.recurring_jobs;
CREATE POLICY "Users can update recurring jobs for their companies" ON public.recurring_jobs AS PERMISSIVE FOR UPDATE TO public
  USING (((EXISTS ( SELECT 1
   FROM company_users
  WHERE ((company_users.company_id = recurring_jobs.company_id) AND (company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM company_users
  WHERE ((company_users.company_id = recurring_jobs.company_id) AND (company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Users can view recurring jobs for their companies" ON public.recurring_jobs;
CREATE POLICY "Users can view recurring jobs for their companies" ON public.recurring_jobs AS PERMISSIVE FOR SELECT TO public
  USING (((EXISTS ( SELECT 1
   FROM company_users
  WHERE ((company_users.company_id = recurring_jobs.company_id) AND (company_users.user_id = (select auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Users can create reserved_vehicles" ON public.reserved_vehicles;
CREATE POLICY "Users can create reserved_vehicles" ON public.reserved_vehicles AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((EXISTS ( SELECT 1
   FROM (time_periods
     JOIN company_users ON ((company_users.company_id = time_periods.company_id)))
  WHERE ((time_periods.id = reserved_vehicles.time_period_id) AND (company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Users can delete reserved_vehicles" ON public.reserved_vehicles;
CREATE POLICY "Users can delete reserved_vehicles" ON public.reserved_vehicles AS PERMISSIVE FOR DELETE TO public
  USING (((EXISTS ( SELECT 1
   FROM (time_periods
     JOIN company_users ON ((company_users.company_id = time_periods.company_id)))
  WHERE ((time_periods.id = reserved_vehicles.time_period_id) AND (company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Users can update reserved_vehicles" ON public.reserved_vehicles;
CREATE POLICY "Users can update reserved_vehicles" ON public.reserved_vehicles AS PERMISSIVE FOR UPDATE TO public
  USING (((EXISTS ( SELECT 1
   FROM (time_periods
     JOIN company_users ON ((company_users.company_id = time_periods.company_id)))
  WHERE ((time_periods.id = reserved_vehicles.time_period_id) AND (company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM (time_periods
     JOIN company_users ON ((company_users.company_id = time_periods.company_id)))
  WHERE ((time_periods.id = reserved_vehicles.time_period_id) AND (company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Users can view reserved_vehicles" ON public.reserved_vehicles;
CREATE POLICY "Users can view reserved_vehicles" ON public.reserved_vehicles AS PERMISSIVE FOR SELECT TO public
  USING (((EXISTS ( SELECT 1
   FROM (time_periods
     JOIN company_users ON ((company_users.company_id = time_periods.company_id)))
  WHERE ((time_periods.id = reserved_vehicles.time_period_id) AND (company_users.user_id = (select auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Superusers can read scheduled job runs" ON public.scheduled_job_runs;
CREATE POLICY "Superusers can read scheduled job runs" ON public.scheduled_job_runs AS PERMISSIVE FOR SELECT TO public
  USING (is_superuser((select auth.uid())));

DROP POLICY IF EXISTS "Users can delete their own time entries" ON public.time_entries;
CREATE POLICY "Users can delete their own time entries" ON public.time_entries AS PERMISSIVE FOR DELETE TO public
  USING (((((user_id = (select auth.uid())) AND (company_id IN ( SELECT company_users.company_id
   FROM company_users
  WHERE ((company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'employee'::company_role, 'super_user'::company_role])))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))) AND (NOT (EXISTS ( SELECT 1
   FROM logging_periods lp
  WHERE ((lp.company_id = time_entries.company_id) AND (lp.period_start = (date_trunc('month'::text, time_entries.start_at))::date) AND (lp.is_locked = true)))))));

DROP POLICY IF EXISTS "Users can insert their own time entries" ON public.time_entries;
CREATE POLICY "Users can insert their own time entries" ON public.time_entries AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((((user_id = (select auth.uid())) AND (company_id IN ( SELECT company_users.company_id
   FROM company_users
  WHERE ((company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'employee'::company_role, 'super_user'::company_role])))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))) AND (NOT (EXISTS ( SELECT 1
   FROM logging_periods lp
  WHERE ((lp.company_id = time_entries.company_id) AND (lp.period_start = (date_trunc('month'::text, time_entries.start_at))::date) AND (lp.is_locked = true)))))));

DROP POLICY IF EXISTS "Users can update their own time entries" ON public.time_entries;
CREATE POLICY "Users can update their own time entries" ON public.time_entries AS PERMISSIVE FOR UPDATE TO public
  USING (((((user_id = (select auth.uid())) AND (company_id IN ( SELECT company_users.company_id
   FROM company_users
  WHERE ((company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'employee'::company_role, 'super_user'::company_role])))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))) AND (NOT (EXISTS ( SELECT 1
   FROM logging_periods lp
  WHERE ((lp.company_id = time_entries.company_id) AND (lp.period_start = (date_trunc('month'::text, time_entries.start_at))::date) AND (lp.is_locked = true)))))))
  WITH CHECK (((((user_id = (select auth.uid())) AND (company_id IN ( SELECT company_users.company_id
   FROM company_users
  WHERE ((company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'employee'::company_role, 'super_user'::company_role])))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))) AND (NOT (EXISTS ( SELECT 1
   FROM logging_periods lp
  WHERE ((lp.company_id = time_entries.company_id) AND (lp.period_start = (date_trunc('month'::text, time_entries.start_at))::date) AND (lp.is_locked = true)))))));

DROP POLICY IF EXISTS "Users can view their own time entries" ON public.time_entries;
CREATE POLICY "Users can view their own time entries" ON public.time_entries AS PERMISSIVE FOR SELECT TO public
  USING ((((user_id = (select auth.uid())) AND (company_id IN ( SELECT company_users.company_id
   FROM company_users
  WHERE ((company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'employee'::company_role, 'super_user'::company_role])))))) OR (EXISTS ( SELECT 1
   FROM company_users
  WHERE ((company_users.company_id = time_entries.company_id) AND (company_users.user_id = (select auth.uid())) AND (company_users.role = 'owner'::company_role)))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Users can create vehicles for their companies" ON public.vehicles;
CREATE POLICY "Users can create vehicles for their companies" ON public.vehicles AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((EXISTS ( SELECT 1
   FROM company_users
  WHERE ((company_users.company_id = vehicles.company_id) AND (company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Users can delete vehicles for their companies" ON public.vehicles;
CREATE POLICY "Users can delete vehicles for their companies" ON public.vehicles AS PERMISSIVE FOR DELETE TO public
  USING (((EXISTS ( SELECT 1
   FROM company_users
  WHERE ((company_users.company_id = vehicles.company_id) AND (company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Users can update vehicles for their companies" ON public.vehicles;
CREATE POLICY "Users can update vehicles for their companies" ON public.vehicles AS PERMISSIVE FOR UPDATE TO public
  USING (((EXISTS ( SELECT 1
   FROM company_users
  WHERE ((company_users.company_id = vehicles.company_id) AND (company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM company_users
  WHERE ((company_users.company_id = vehicles.company_id) AND (company_users.user_id = (select auth.uid())) AND (company_users.role = ANY (ARRAY['owner'::company_role, 'super_user'::company_role, 'employee'::company_role]))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));

DROP POLICY IF EXISTS "Users can view vehicles for their companies" ON public.vehicles;
CREATE POLICY "Users can view vehicles for their companies" ON public.vehicles AS PERMISSIVE FOR SELECT TO public
  USING (((EXISTS ( SELECT 1
   FROM company_users
  WHERE ((company_users.company_id = vehicles.company_id) AND (company_users.user_id = (select auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (profiles.superuser = true))))));
