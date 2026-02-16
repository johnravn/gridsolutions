-- Add per-item distance_rate to offer_transport_items so stored totals match
-- the technical offer dialog (which uses per-item rate when set).
-- Without this column, recalculateOfferTotals used only company default and
-- stored total was 1000 kr (or more) less than the dialog total.

ALTER TABLE public.offer_transport_items
ADD COLUMN IF NOT EXISTS distance_rate NUMERIC(10, 2);

COMMENT ON COLUMN public.offer_transport_items.distance_rate IS
  'Rate per distance increment for this transport item; NULL means use company default.';
