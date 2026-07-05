-- Default subcontractor markup to 5% for all companies

UPDATE public.company_expansions
SET subcontractor_markup_percent = 5
WHERE subcontractor_markup_percent IS NULL;

ALTER TABLE public.company_expansions
  ALTER COLUMN subcontractor_markup_percent SET DEFAULT 5;
