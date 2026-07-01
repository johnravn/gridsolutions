-- Gallery block type enum value (must be committed before use in next migration)

DO $$ BEGIN
  ALTER TYPE public.pretty_module_block_type ADD VALUE 'gallery';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
