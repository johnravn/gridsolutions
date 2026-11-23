-- Accounting verification is only allowed when job status is
-- invoiced, paid, or canceled (client + DB enforcement).

CREATE OR REPLACE FUNCTION public.enforce_job_money_verified_status()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only when setting / changing verification to a non-null timestamp.
  IF NEW.money_verified_at IS NOT NULL
     AND NEW.money_verified_at IS DISTINCT FROM OLD.money_verified_at
     AND NEW.status NOT IN ('invoiced', 'paid', 'canceled') THEN
    RAISE EXCEPTION
      'Accounting can only be verified when job status is invoiced, paid, or canceled (current status: %)',
      NEW.status
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS jobs_enforce_money_verified_status ON public.jobs;
CREATE TRIGGER jobs_enforce_money_verified_status
  BEFORE UPDATE OF money_verified_at, money_verified_by ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_job_money_verified_status();

COMMENT ON FUNCTION public.enforce_job_money_verified_status() IS
  'Rejects money_verified_at writes unless jobs.status is invoiced, paid, or canceled.';
