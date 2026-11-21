-- Add Norwegian organization / VAT number on company crew members.
-- Used for Conta received-invoice expense matching on Accounting.

ALTER TABLE public.company_users
ADD COLUMN IF NOT EXISTS vat_number TEXT;

COMMENT ON COLUMN public.company_users.vat_number IS
  'Norwegian organization number (orgnr) for Conta supplier invoice matching';

-- Recreate view so vat_number is exposed (CREATE OR REPLACE cannot reorder/rename columns).
DROP VIEW IF EXISTS public.company_user_profiles;

CREATE VIEW public.company_user_profiles
WITH (security_invoker = on) AS
SELECT
  cu.company_id,
  cu.user_id,
  cu.role,
  cu.rate_type,
  cu.rate,
  cu.rate_updated_at,
  cu.vat_number,
  p.email,
  p.display_name,
  p.first_name,
  p.last_name,
  p.phone,
  p.avatar_url,
  p.created_at
FROM public.company_users cu
JOIN public.profiles p ON p.user_id = cu.user_id;

ALTER VIEW public.company_user_profiles OWNER TO postgres;
