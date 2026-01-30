# RLS Policy Worksheet

Fill in access rules for each table. Use natural language.

Legend (access levels you can apply):

- 1 no access
- 2 self-only (user_id = auth.uid())
- 3 company-member (company_id in user's company_users)
- 4 company-admin (role in admin/owner for company)
- 5 company-manager (if applicable)
- 6 superuser (profiles.superuser = true)
- 7 invitee-only (email/token match)
- 8 public/anon (rare)
- 9 service-only (service key / backend)

Template per table:

```
Table: <name>
- SELECT:
- INSERT:
- UPDATE:
- DELETE:
- Notes:
```

---

Table: activity_comments

- SELECT: company users (owner/employee/super_user) can view comments on their company activities when activity deleted = false; freelancers can view when latest_feed_open_to_freelancers = true
- INSERT: company users (owner/employee/super_user) can create comments on accessible activities; freelancers can create when latest_feed_open_to_freelancers = true; must set created_by_user_id = auth.uid()
- UPDATE: comment creator can update their own comments (used for soft-delete too)
- DELETE: no policy (no hard delete)
- Notes: access is tied to activity_log + company_expansions.latest_feed_open_to_freelancers

Table: activity_likes

- SELECT: company users (owner/employee/super_user) can view likes on their company activities; freelancers can view when latest_feed_open_to_freelancers = true
- INSERT: user can like activities they can access; user_id must equal auth.uid()
- UPDATE: allowed when user_id = auth.uid() and activity is accessible
- DELETE: allowed when user_id = auth.uid() and activity is accessible
- Notes: policy is defined without FOR, so it applies to all commands (subject to user_id + activity access)

Table: activity_log

- SELECT: company users (owner/employee/super_user) can view their company activities where deleted = false; freelancers can view if latest_feed_open_to_freelancers = true
- INSERT: owner/employee/super_user can create activities for their company; created_by_user_id = auth.uid()
- UPDATE: owners/super_user of company can update (used for soft delete)
- DELETE: no policy (no hard delete)
- Notes: access checks company_expansions.latest_feed_open_to_freelancers for freelancers

Table: addresses

- SELECT: company members can view company addresses; users can view their own personal addresses; company members can view personal addresses of users in same company; superusers can view all
- INSERT: company members (owner/super_user/employee) can create company addresses; users can create their own personal addresses; superusers can create any
- UPDATE: company members (owner/super_user/employee) can update company addresses; users can update their own personal addresses; superusers can update any
- DELETE: company members (owner/super_user/employee) can delete company addresses; users can delete their own personal addresses; superusers can delete any
- Notes: personal addresses are identified by is_personal = true and profiles.primary_address_id

Table: companies

- SELECT: company members can view their companies; superusers can view all
- INSERT: superusers only
- UPDATE: owners/super_user of the company or global superusers
- DELETE: superusers only
- Notes:

Table: company_expansions

- SELECT: company members can view expansions for their companies
- INSERT: owners/super_user of company or global superusers
- UPDATE: owners/super_user of company or global superusers
- DELETE: owners/super_user of company or global superusers
- Notes: "Company owners can manage expansions" policy applies to all commands; separate INSERT policy exists

Table: company_users

- SELECT: users can view their own rows or any company they belong to; global superusers can view all
- INSERT: owners/super_user of company or global superusers
- UPDATE: owners/super_user/employee of company or global superusers
- DELETE: owners/super_user of company or global superusers
- Notes: uses security definer helpers to avoid recursion

Table: contacts

- SELECT: company members can view contacts for their companies; global superusers can view all
- INSERT: owner/super_user/employee of company or global superusers
- UPDATE: owner/super_user/employee of company or global superusers
- DELETE: owner/super_user/employee of company or global superusers
- Notes:

Table: customers

- SELECT: company members can view customers for their companies; global superusers can view all
- INSERT: owner/super_user/employee of company or global superusers
- UPDATE: owner/super_user/employee of company or global superusers
- DELETE: owner/super_user/employee of company or global superusers
- Notes:

Table: dev_auth_logs

- SELECT: user can view their own logs; global superusers can view all
- INSERT: system can insert (with check true)
- UPDATE: no policy
- DELETE: no policy
- Notes: read-only audit log (no update/delete)

Table: group_items

- SELECT: company members can view group_items via item_groups.company_id; global superusers can view all
- INSERT: owner/super_user/employee of company or global superusers
- UPDATE: owner/super_user/employee of company or global superusers
- DELETE: owner/super_user/employee of company or global superusers
- Notes:

Table: group_price_history

- SELECT: company members can view group_price_history for their companies; global superusers can view all
- INSERT: owner/super_user/employee of company or global superusers
- UPDATE: owner/super_user/employee of company or global superusers
- DELETE: owner/super_user/employee of company or global superusers
- Notes:

Table: item_brands

- SELECT: company members can view item_brands for their companies; global superusers can view all
- INSERT: owner/super_user/employee of company or global superusers
- UPDATE: owner/super_user/employee of company or global superusers
- DELETE: owner/super_user/employee of company or global superusers
- Notes:

Table: item_categories

- SELECT: company members can view item_categories for their companies; global superusers can view all
- INSERT: owner/super_user/employee of company or global superusers
- UPDATE: owner/super_user/employee of company or global superusers
- DELETE: owner/super_user/employee of company or global superusers
- Notes:

Table: item_groups

- SELECT: company members can view item_groups for their companies; global superusers can view all
- INSERT: owner/super_user/employee of company or global superusers
- UPDATE: owner/super_user/employee of company or global superusers
- DELETE: owner/super_user/employee of company or global superusers
- Notes:

Table: item_price_history

- SELECT: company members can view item_price_history for their companies; global superusers can view all
- INSERT: owner/super_user/employee of company or global superusers
- UPDATE: owner/super_user/employee of company or global superusers
- DELETE: owner/super_user/employee of company or global superusers
- Notes:

Table: item_related

- SELECT: company members can view item_related for company of item_a_id; global superusers can view all
- INSERT: owner/super_user/employee of item_a_id company or global superusers
- UPDATE: owner/super_user/employee of item_a_id company or global superusers
- DELETE: owner/super_user/employee of item_a_id company or global superusers
- Notes: access is checked through items (item_a_id)

Table: items

- SELECT: company members can view items for their companies; global superusers can view all
- INSERT: owner/super_user/employee of company or global superusers
- UPDATE: owner/super_user/employee of company or global superusers
- DELETE: owner/super_user/employee of company or global superusers
- Notes:

Table: job_contacts

- SELECT: company members can view job_contacts for their company jobs; global superusers can view all
- INSERT: owner/super_user/employee of job's company or global superusers
- UPDATE: owner/super_user/employee of job's company or global superusers
- DELETE: owner/super_user/employee of job's company or global superusers
- Notes:

Table: job_files

- SELECT: company members can view job_files for their company jobs; global superusers can view all
- INSERT: owner/super_user/employee of job's company or global superusers
- UPDATE: owner/super_user/employee of job's company or global superusers
- DELETE: owner/super_user/employee of job's company or global superusers
- Notes:

Table: job_invoices

- SELECT: company members can view invoices for their company jobs
- INSERT: owner/super_user/employee of job's company
- UPDATE: owner/super_user/employee of job's company
- DELETE: no policy
- Notes:

Table: job_notes

- SELECT: company members can view job_notes for their company jobs; global superusers can view all
- INSERT: owner/super_user/employee of job's company or global superusers
- UPDATE: owner/super_user/employee of job's company or global superusers
- DELETE: owner/super_user/employee of job's company or global superusers
- Notes:

Table: job_offers

- SELECT: company members can view their company offers; public can view non-draft offers via access_token
- INSERT: company members can create offers for their company
- UPDATE: company members can update offers; public can update when status = sent to accepted/rejected/viewed
- DELETE: company members can delete offers
- Notes: public policies apply to anon/authenticated

Table: job_status_history

- SELECT: company members can view job_status_history for their company jobs; global superusers can view all
- INSERT: owner/super_user/employee of job's company or global superusers
- UPDATE: owner/super_user/employee of job's company or global superusers
- DELETE: owner/super_user/employee of job's company or global superusers
- Notes:

Table: jobs

- SELECT: company members can view jobs for their companies; global superusers can view all
- INSERT: owner/super_user/employee of company or global superusers
- UPDATE: owner/super_user/employee of company or global superusers
- DELETE: owner/super_user/employee of company or global superusers
- Notes:

Table: matter_files

- SELECT: company members can view matter files for their company matters; global superusers can view all
- INSERT: user_id must be auth.uid() and user must belong to matter's company
- UPDATE: uploader can update their own files
- DELETE: uploader can delete their own files
- Notes:

Table: matter_messages

- SELECT: company members can view matter messages for their company matters; global superusers can view all
- INSERT: user_id must be auth.uid() and user must belong to matter's company
- UPDATE: author can update their own messages
- DELETE: no policy
- Notes:

Table: matter_recipients

- SELECT: company members can view matter recipients for their company matters; global superusers can view all
- INSERT: system can insert (with check true)
- UPDATE: recipient can update their own status (user_id = auth.uid())
- DELETE: no policy
- Notes:

Table: matter_responses

- SELECT: company members can view matter responses for their company matters; global superusers can view all
- INSERT: user_id must be auth.uid()
- UPDATE: user can update their own responses
- DELETE: no policy
- Notes:

Table: matters

- SELECT: company members can view matters for their company; global superusers can view all
- INSERT: company users with role owner/employee/super_user/freelancer can create; created_by_user_id = auth.uid(); global superusers allowed
- UPDATE: creator can update; company owner/super_user can update; global superusers can update
- DELETE: creator can delete; company owner/super_user can delete; global superusers can delete
- Notes: uses public.is_superuser helper

Table: offer_crew_items

- SELECT: company members can view crew items for their company offers; public can view via non-draft offers
- INSERT: company members can create crew items
- UPDATE: company members can update crew items
- DELETE: company members can delete crew items
- Notes:

Table: offer_equipment_groups

- SELECT: company members can view equipment groups for their company offers; public can view via non-draft offers
- INSERT: company members can create equipment groups
- UPDATE: company members can update equipment groups
- DELETE: company members can delete equipment groups
- Notes:

Table: offer_equipment_items

- SELECT: company members can view equipment items for their company offers; public can view via non-draft offers
- INSERT: company members can create equipment items
- UPDATE: company members can update equipment items
- DELETE: company members can delete equipment items
- Notes:

Table: offer_pretty_sections

- SELECT: company members can view pretty sections for their company offers; public can view via non-draft offers
- INSERT: company members can create pretty sections
- UPDATE: company members can update pretty sections
- DELETE: company members can delete pretty sections
- Notes:

Table: offer_transport_items

- SELECT: company members can view transport items for their company offers; public can view via non-draft offers
- INSERT: company members can create transport items
- UPDATE: company members can update transport items
- DELETE: company members can delete transport items
- Notes:

Table: pending_invites

- SELECT: company members (owner/super_user/employee) can view invites for their companies; global superusers can view all
- INSERT: company members (owner/super_user/employee) can create invites; global superusers allowed
- UPDATE: company members (owner/super_user/employee) can update invites; global superusers allowed
- DELETE: company members (owner/super_user/employee) can delete invites; global superusers allowed
- Notes:

Table: profiles

- SELECT: user can view own profile; company members can view each other; global superusers can view all
- INSERT: no explicit policy (except dev_allow_all)
- UPDATE: user can update own profile
- DELETE: no explicit policy (except dev_allow_all)
- Notes: dev_allow_all policy exists on profiles and grants full access to all commands

Table: reserved_crew

- SELECT: company members can view reserved_crew for their company time_periods; global superusers can view all
- INSERT: owner/super_user/employee of company or global superusers
- UPDATE: owner/super_user/employee of company, OR reserved_crew.user_id = auth.uid(), OR global superusers
- DELETE: owner/super_user/employee of company or global superusers
- Notes:

Table: reserved_items

- SELECT: company members can view reserved_items for their company time_periods; global superusers can view all
- INSERT: owner/super_user/employee of company or global superusers
- UPDATE: owner/super_user/employee of company or global superusers
- DELETE: owner/super_user/employee of company or global superusers
- Notes:

Table: reserved_vehicles

- SELECT: company members can view reserved_vehicles for their company time_periods; global superusers can view all
- INSERT: owner/super_user/employee of company or global superusers
- UPDATE: owner/super_user/employee of company or global superusers
- DELETE: owner/super_user/employee of company or global superusers
- Notes:

Table: time_entries

- SELECT: user can view own time entries when they belong to company as owner/employee/super_user; global superusers can view all
- INSERT: user can create own time entries when they belong to company as owner/employee/super_user; global superusers can insert
- UPDATE: user can update own time entries when they belong to company as owner/employee/super_user; global superusers can update
- DELETE: user can delete own time entries when they belong to company as owner/employee/super_user; global superusers can delete
- Notes:

Table: time_periods

- SELECT: company members can view time_periods for their companies; global superusers can view all
- INSERT: owner/super_user/employee of company or global superusers
- UPDATE: owner/super_user/employee of company or global superusers
- DELETE: owner/super_user/employee of company or global superusers
- Notes:

Table: vehicles

- SELECT: company members can view vehicles for their companies; global superusers can view all
- INSERT: owner/super_user/employee of company or global superusers
- UPDATE: owner/super_user/employee of company or global superusers
- DELETE: owner/super_user/employee of company or global superusers
- Notes:
