ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_seen_release_version text;

COMMENT ON COLUMN public.profiles.last_seen_release_version IS
  'Semver of the last app release notes the user dismissed (What''s New).';
