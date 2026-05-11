-- Add explicit transport usage counters for offer editor.
-- These are used to calculate totals independent of date range:
-- - days_used: how many days the vehicle is used
-- - daily_rate_count: how many daily rates to charge

ALTER TABLE public.offer_transport_items
ADD COLUMN IF NOT EXISTS days_used INTEGER;

ALTER TABLE public.offer_transport_items
ADD COLUMN IF NOT EXISTS daily_rate_count INTEGER;

COMMENT ON COLUMN public.offer_transport_items.days_used IS
  'How many days the vehicle is used for this offer line; NULL means derive from start/end date.';

COMMENT ON COLUMN public.offer_transport_items.daily_rate_count IS
  'How many daily rates to charge for this offer line; NULL means use derived days (or days_used when set).';
