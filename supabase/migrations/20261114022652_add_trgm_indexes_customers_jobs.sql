-- Speed up leading-wildcard ILIKE on customer names and job titles
-- (mirrors items_name_trgm / vehicles_name_trgm_idx).
-- Hosted Supabase keeps pg_trgm in the `extensions` schema.

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

CREATE INDEX IF NOT EXISTS customers_name_trgm_idx
  ON public.customers
  USING gin (name extensions.gin_trgm_ops);

CREATE INDEX IF NOT EXISTS jobs_title_trgm_idx
  ON public.jobs
  USING gin (title extensions.gin_trgm_ops);
