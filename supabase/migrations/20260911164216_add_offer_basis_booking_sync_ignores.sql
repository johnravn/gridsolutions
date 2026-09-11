-- Persist items the user chose to skip when syncing bookings from an offer basis.
ALTER TABLE public.offer_bases
  ADD COLUMN IF NOT EXISTS booking_sync_ignores jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.offer_bases.booking_sync_ignores IS
  'Leaf keys skipped on the last booking sync (additions not booked, removals kept).';
