-- Phase C: Index company_users(user_id) for RLS / membership lookups.
-- PK is (company_id, user_id), so filters on user_id alone (auth.uid()) cannot
-- use the leading PK column efficiently.

CREATE INDEX IF NOT EXISTS company_users_user_id_idx
  ON public.company_users (user_id);
