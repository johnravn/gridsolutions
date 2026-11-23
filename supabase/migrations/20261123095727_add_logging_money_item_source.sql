-- Allow job_money_items.source = 'logging' for expenses added from time entries.

ALTER TABLE public.job_money_items
  DROP CONSTRAINT IF EXISTS job_money_items_source_check;

ALTER TABLE public.job_money_items
  ADD CONSTRAINT job_money_items_source_check
  CHECK (source IN ('offer', 'crew', 'conta', 'manual', 'logging'));

-- Backfill rows previously saved as manual with a logging- source_id.
UPDATE public.job_money_items
SET source = 'logging'
WHERE source = 'manual'
  AND source_id IS NOT NULL
  AND source_id LIKE 'logging-%';

COMMENT ON COLUMN public.job_money_items.source IS
  'Origin of the money item: offer, crew booking, conta, manual entry, or logging time entry.';
