-- Add a sync marker so the UI can indicate whether an offer is synced to bookings.

ALTER TABLE public.job_offers
  ADD COLUMN IF NOT EXISTS bookings_synced_at timestamp with time zone;

COMMENT ON COLUMN public.job_offers.bookings_synced_at IS
  'Timestamp when bookings were last synced (generated) from this offer.';

-- Mark an offer as synced using a DB-side timestamp so it aligns with updated_at.
CREATE OR REPLACE FUNCTION public.mark_job_offer_bookings_synced(p_offer_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.job_offers
     SET bookings_synced_at = now()
   WHERE id = p_offer_id;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_job_offer_bookings_synced(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_job_offer_bookings_synced(uuid) TO authenticated;

