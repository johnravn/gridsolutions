-- Add an email field for placeholder crew rows.
-- This enables inviting crew by email (without an existing user account)
-- while still creating a reserved_crew booking row.

ALTER TABLE public.reserved_crew
ADD COLUMN IF NOT EXISTS placeholder_email text;

-- Optional: basic index to make lookups cheaper (e.g. matching placeholders to users later)
CREATE INDEX IF NOT EXISTS reserved_crew_placeholder_email_idx
  ON public.reserved_crew (placeholder_email);

