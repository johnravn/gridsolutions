-- Column layout block: multi-column container for nested content blocks

DO $$ BEGIN
  ALTER TYPE public.pretty_module_block_type ADD VALUE 'column_layout';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
