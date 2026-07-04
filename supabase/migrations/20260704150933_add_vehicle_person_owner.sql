-- Allow company employees, freelancers, and owners to own vehicles personally.

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS owner_user_id uuid;

ALTER TABLE public.vehicles
  DROP CONSTRAINT IF EXISTS vehicles_owner_user_id_fkey;

ALTER TABLE public.vehicles
  ADD CONSTRAINT vehicles_owner_user_id_fkey
  FOREIGN KEY (owner_user_id)
  REFERENCES public.profiles(user_id)
  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS vehicles_owner_user_id_idx
  ON public.vehicles (owner_user_id)
  WHERE owner_user_id IS NOT NULL;

ALTER TABLE public.vehicles
  DROP CONSTRAINT IF EXISTS vehicles_owner_chk;

ALTER TABLE public.vehicles
  ADD CONSTRAINT vehicles_owner_chk CHECK (
    (
      internally_owned = true
      AND external_owner_id IS NULL
      AND owner_user_id IS NULL
    )
    OR (
      internally_owned = false
      AND external_owner_id IS NOT NULL
      AND owner_user_id IS NULL
    )
    OR (
      internally_owned = false
      AND external_owner_id IS NULL
      AND owner_user_id IS NOT NULL
    )
  );

-- vehicle_detail
DROP VIEW IF EXISTS public.vehicle_detail;

CREATE VIEW public.vehicle_detail WITH (security_invoker = 'on') AS
SELECT
  v.id,
  v.company_id,
  v.name,
  v.registration_no,
  v.fuel,
  v.active,
  v.deleted,
  v.notes,
  v.image_path,
  v.internally_owned,
  v.external_owner_id,
  v.owner_user_id,
  CASE
    WHEN v.internally_owned THEN 'internal'::text
    WHEN v.owner_user_id IS NOT NULL THEN 'personal'::text
    ELSE 'external'::text
  END AS owner_kind,
  CASE
    WHEN v.internally_owned THEN comp.name
    WHEN v.owner_user_id IS NOT NULL THEN COALESCE(p.display_name, p.email)
    ELSE cust.name
  END AS owner_name,
  CASE
    WHEN v.internally_owned OR v.owner_user_id IS NOT NULL THEN NULL::boolean
    ELSE cust.is_partner
  END AS external_owner_is_partner,
  CASE
    WHEN v.internally_owned OR v.owner_user_id IS NOT NULL THEN NULL::text
    ELSE cust.email
  END AS external_owner_email,
  CASE
    WHEN v.internally_owned OR v.owner_user_id IS NOT NULL THEN NULL::text
    ELSE cust.phone
  END AS external_owner_phone,
  v.created_at,
  next_res.reservation_id AS next_reservation_id,
  next_res.start_at AS next_reservation_start_at,
  next_res.end_at AS next_reservation_end_at,
  next_res.job_id AS next_reservation_job_id,
  next_res.title AS next_reservation_title
FROM public.vehicles v
JOIN public.companies comp ON comp.id = v.company_id
LEFT JOIN public.customers cust ON cust.id = v.external_owner_id
LEFT JOIN public.profiles p ON p.user_id = v.owner_user_id
LEFT JOIN LATERAL (
  SELECT
    r.id AS reservation_id,
    r.start_at,
    r.end_at,
    r.job_id,
    COALESCE(r.title, 'Reservation'::text) AS title
  FROM public.time_periods r
  JOIN public.reserved_vehicles rv ON rv.time_period_id = r.id
  WHERE rv.vehicle_id = v.id
    AND r.company_id = v.company_id
    AND r.end_at > now()
  ORDER BY r.start_at
  LIMIT 1
) next_res ON true;

-- vehicle_index
DROP VIEW IF EXISTS public.vehicle_index;

CREATE VIEW public.vehicle_index WITH (security_invoker = 'on') AS
SELECT
  v.id,
  v.company_id,
  v.name,
  v.registration_no AS reg_number,
  v.image_path,
  v.fuel,
  v.internally_owned,
  v.external_owner_id,
  v.owner_user_id,
  c.name AS external_owner_name,
  COALESCE(p.display_name, p.email) AS owner_user_name,
  v.active,
  v.deleted,
  v.created_at
FROM public.vehicles v
LEFT JOIN public.customers c ON c.id = v.external_owner_id
LEFT JOIN public.profiles p ON p.user_id = v.owner_user_id;

GRANT SELECT ON public.vehicle_detail TO anon, authenticated, service_role;
GRANT SELECT ON public.vehicle_index TO anon, authenticated, service_role;
