-- Allow job-specific placeholder crew entries without users
ALTER TABLE public.reserved_crew
  ADD COLUMN IF NOT EXISTS placeholder_name text;

ALTER TABLE public.reserved_crew
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.reserved_crew
  DROP CONSTRAINT IF EXISTS reserved_crew_user_or_placeholder_check;

ALTER TABLE public.reserved_crew
  ADD CONSTRAINT reserved_crew_user_or_placeholder_check
  CHECK (user_id IS NOT NULL OR placeholder_name IS NOT NULL);

COMMENT ON COLUMN public.reserved_crew.placeholder_name IS 'Name for placeholders without a user account';
