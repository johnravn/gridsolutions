-- Timeline block type for pretty offer modules (snapshot of job program)

DO $$ BEGIN
  ALTER TYPE public.pretty_module_block_type ADD VALUE 'timeline';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE public.pretty_offer_module_block_items
  ADD COLUMN IF NOT EXISTS start_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS end_at TIMESTAMPTZ;
