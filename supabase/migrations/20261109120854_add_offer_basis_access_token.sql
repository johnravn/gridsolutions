-- One shareable public offer link per offer basis.

ALTER TABLE public.offer_bases
  ADD COLUMN IF NOT EXISTS access_token text;

-- Prefer token from latest locked pretty offer on the basis; else latest locked
-- offer; else generate a new hex token (matches app generateSecureToken length).
UPDATE public.offer_bases ob
SET access_token = COALESCE(
  (
    SELECT jo.access_token
    FROM public.job_offers jo
    WHERE jo.offer_basis_id = ob.id
      AND jo.locked = true
      AND jo.offer_type = 'pretty'
      AND jo.access_token IS NOT NULL
      AND btrim(jo.access_token) <> ''
    ORDER BY jo.version_number DESC, jo.created_at DESC
    LIMIT 1
  ),
  (
    SELECT jo.access_token
    FROM public.job_offers jo
    WHERE jo.offer_basis_id = ob.id
      AND jo.locked = true
      AND jo.access_token IS NOT NULL
      AND btrim(jo.access_token) <> ''
    ORDER BY jo.version_number DESC, jo.created_at DESC
    LIMIT 1
  ),
  encode(gen_random_bytes(32), 'hex')
)
WHERE ob.access_token IS NULL OR btrim(ob.access_token) = '';

-- Any remaining null/blank (edge cases) get a fresh token.
UPDATE public.offer_bases
SET access_token = encode(gen_random_bytes(32), 'hex')
WHERE access_token IS NULL OR btrim(access_token) = '';

-- Ensure uniqueness before adding the constraint (regenerate collisions).
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT access_token, array_agg(id) AS ids
    FROM public.offer_bases
    GROUP BY access_token
    HAVING count(*) > 1
  LOOP
    UPDATE public.offer_bases
    SET access_token = encode(gen_random_bytes(32), 'hex')
    WHERE id = ANY (r.ids[2:]);
  END LOOP;
END $$;

ALTER TABLE public.offer_bases
  ALTER COLUMN access_token SET DEFAULT encode(gen_random_bytes(32), 'hex');

ALTER TABLE public.offer_bases
  ALTER COLUMN access_token SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS offer_bases_access_token_key
  ON public.offer_bases (access_token);

COMMENT ON COLUMN public.offer_bases.access_token IS
  'Public share token for the basis offer link (one link for all alternatives).';
