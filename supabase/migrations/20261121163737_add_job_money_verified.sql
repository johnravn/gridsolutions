-- Project-lead Money verification for Reporting (verified-only chart/KPI totals).

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS money_verified_at TIMESTAMPTZ;

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS money_verified_by UUID REFERENCES public.profiles (user_id);

COMMENT ON COLUMN public.jobs.money_verified_at IS
  'When the project lead marked Money as correct; null = not verified.';

COMMENT ON COLUMN public.jobs.money_verified_by IS
  'profiles.user_id of who verified Money; cleared when ledger changes.';

CREATE INDEX IF NOT EXISTS jobs_money_verified_at_idx
  ON public.jobs (company_id, money_verified_at)
  WHERE money_verified_at IS NOT NULL;

-- Any confirmed ledger change invalidates verification.
CREATE OR REPLACE FUNCTION public.clear_job_money_verified()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_job_id UUID;
BEGIN
  target_job_id := COALESCE(NEW.job_id, OLD.job_id);
  IF target_job_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  UPDATE public.jobs
  SET
    money_verified_at = NULL,
    money_verified_by = NULL
  WHERE id = target_job_id
    AND money_verified_at IS NOT NULL;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS job_money_items_clear_money_verified ON public.job_money_items;
CREATE TRIGGER job_money_items_clear_money_verified
  AFTER INSERT OR UPDATE OR DELETE ON public.job_money_items
  FOR EACH ROW
  EXECUTE FUNCTION public.clear_job_money_verified();
