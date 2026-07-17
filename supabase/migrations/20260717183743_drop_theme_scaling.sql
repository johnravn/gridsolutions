-- Remove company theme scaling (density is now fixed Apple tokens by breakpoint).
ALTER TABLE public.companies
  DROP CONSTRAINT IF EXISTS companies_theme_scaling_check;

ALTER TABLE public.companies
  DROP COLUMN IF EXISTS theme_scaling;
