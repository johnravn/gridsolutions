-- Recurring series accounting mode: per_job (default) vs combined (series ledger).
-- Combined mode stores income/expense lines on job_money_items.recurring_job_id
-- and verification on recurring_jobs.money_verified_*.

-- ---------------------------------------------------------------------------
-- recurring_jobs: mode + series verification
-- ---------------------------------------------------------------------------

ALTER TABLE public.recurring_jobs
  ADD COLUMN IF NOT EXISTS accounting_mode TEXT NOT NULL DEFAULT 'per_job';

ALTER TABLE public.recurring_jobs
  DROP CONSTRAINT IF EXISTS recurring_jobs_accounting_mode_check;

ALTER TABLE public.recurring_jobs
  ADD CONSTRAINT recurring_jobs_accounting_mode_check
  CHECK (accounting_mode IN ('per_job', 'combined'));

COMMENT ON COLUMN public.recurring_jobs.accounting_mode IS
  'per_job = Accounting on each child job; combined = one series ledger (child Accounting deactivated).';

ALTER TABLE public.recurring_jobs
  ADD COLUMN IF NOT EXISTS money_verified_at TIMESTAMPTZ;

ALTER TABLE public.recurring_jobs
  ADD COLUMN IF NOT EXISTS money_verified_by UUID REFERENCES public.profiles (user_id);

COMMENT ON COLUMN public.recurring_jobs.money_verified_at IS
  'When the project lead verified combined-mode series Accounting for Reporting; null = not verified.';

COMMENT ON COLUMN public.recurring_jobs.money_verified_by IS
  'profiles.user_id of who verified combined-mode series Accounting.';

CREATE INDEX IF NOT EXISTS recurring_jobs_money_verified_at_idx
  ON public.recurring_jobs (company_id, money_verified_at)
  WHERE money_verified_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS recurring_jobs_accounting_mode_idx
  ON public.recurring_jobs (company_id, accounting_mode);

-- ---------------------------------------------------------------------------
-- job_money_items: optional series owner (exactly one of job_id / recurring_job_id)
-- ---------------------------------------------------------------------------

ALTER TABLE public.job_money_items
  ALTER COLUMN job_id DROP NOT NULL;

ALTER TABLE public.job_money_items
  ADD COLUMN IF NOT EXISTS recurring_job_id UUID REFERENCES public.recurring_jobs (id) ON DELETE CASCADE;

ALTER TABLE public.job_money_items
  DROP CONSTRAINT IF EXISTS job_money_items_owner_check;

ALTER TABLE public.job_money_items
  ADD CONSTRAINT job_money_items_owner_check
  CHECK (
    (job_id IS NOT NULL AND recurring_job_id IS NULL)
    OR (job_id IS NULL AND recurring_job_id IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS idx_job_money_items_recurring_job_id
  ON public.job_money_items (recurring_job_id)
  WHERE recurring_job_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_job_money_items_recurring_source_id
  ON public.job_money_items (recurring_job_id, source, source_id)
  WHERE recurring_job_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Clear verification when series ledger changes
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.clear_job_money_verified()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_job_id UUID;
  target_recurring_job_id UUID;
BEGIN
  target_job_id := COALESCE(NEW.job_id, OLD.job_id);
  target_recurring_job_id := COALESCE(NEW.recurring_job_id, OLD.recurring_job_id);

  IF target_job_id IS NOT NULL THEN
    UPDATE public.jobs
    SET
      money_verified_at = NULL,
      money_verified_by = NULL
    WHERE id = target_job_id
      AND money_verified_at IS NOT NULL;
  END IF;

  IF target_recurring_job_id IS NOT NULL THEN
    UPDATE public.recurring_jobs
    SET
      money_verified_at = NULL,
      money_verified_by = NULL
    WHERE id = target_recurring_job_id
      AND money_verified_at IS NOT NULL;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS job_money_items_clear_money_verified ON public.job_money_items;
CREATE TRIGGER job_money_items_clear_money_verified
  AFTER INSERT OR UPDATE OR DELETE ON public.job_money_items
  FOR EACH ROW
  EXECUTE FUNCTION public.clear_job_money_verified();

-- ---------------------------------------------------------------------------
-- RLS: allow series-scoped money items via recurring_jobs company membership
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Users can view money items for their company jobs" ON public.job_money_items;
CREATE POLICY "Users can view money items for their company jobs"
  ON public.job_money_items
  FOR SELECT
  USING (
    (
      job_money_items.job_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.jobs j
        JOIN public.company_users cu ON cu.company_id = j.company_id
        WHERE j.id = job_money_items.job_id
          AND cu.user_id = auth.uid()
      )
    )
    OR (
      job_money_items.recurring_job_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.recurring_jobs rj
        JOIN public.company_users cu ON cu.company_id = rj.company_id
        WHERE rj.id = job_money_items.recurring_job_id
          AND cu.user_id = auth.uid()
      )
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

DROP POLICY IF EXISTS "Users can create money items for their company jobs" ON public.job_money_items;
CREATE POLICY "Users can create money items for their company jobs"
  ON public.job_money_items
  FOR INSERT
  WITH CHECK (
    (
      job_money_items.job_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.jobs j
        JOIN public.company_users cu ON cu.company_id = j.company_id
        WHERE j.id = job_money_items.job_id
          AND cu.user_id = auth.uid()
          AND cu.role IN ('owner', 'super_user', 'employee')
      )
    )
    OR (
      job_money_items.recurring_job_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.recurring_jobs rj
        JOIN public.company_users cu ON cu.company_id = rj.company_id
        WHERE rj.id = job_money_items.recurring_job_id
          AND cu.user_id = auth.uid()
          AND cu.role IN ('owner', 'super_user', 'employee')
      )
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

DROP POLICY IF EXISTS "Users can update money items for their company jobs" ON public.job_money_items;
CREATE POLICY "Users can update money items for their company jobs"
  ON public.job_money_items
  FOR UPDATE
  USING (
    (
      job_money_items.job_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.jobs j
        JOIN public.company_users cu ON cu.company_id = j.company_id
        WHERE j.id = job_money_items.job_id
          AND cu.user_id = auth.uid()
          AND cu.role IN ('owner', 'super_user', 'employee')
      )
    )
    OR (
      job_money_items.recurring_job_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.recurring_jobs rj
        JOIN public.company_users cu ON cu.company_id = rj.company_id
        WHERE rj.id = job_money_items.recurring_job_id
          AND cu.user_id = auth.uid()
          AND cu.role IN ('owner', 'super_user', 'employee')
      )
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  )
  WITH CHECK (
    (
      job_money_items.job_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.jobs j
        JOIN public.company_users cu ON cu.company_id = j.company_id
        WHERE j.id = job_money_items.job_id
          AND cu.user_id = auth.uid()
          AND cu.role IN ('owner', 'super_user', 'employee')
      )
    )
    OR (
      job_money_items.recurring_job_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.recurring_jobs rj
        JOIN public.company_users cu ON cu.company_id = rj.company_id
        WHERE rj.id = job_money_items.recurring_job_id
          AND cu.user_id = auth.uid()
          AND cu.role IN ('owner', 'super_user', 'employee')
      )
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

DROP POLICY IF EXISTS "Users can delete money items for their company jobs" ON public.job_money_items;
CREATE POLICY "Users can delete money items for their company jobs"
  ON public.job_money_items
  FOR DELETE
  USING (
    (
      job_money_items.job_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.jobs j
        JOIN public.company_users cu ON cu.company_id = j.company_id
        WHERE j.id = job_money_items.job_id
          AND cu.user_id = auth.uid()
          AND cu.role IN ('owner', 'super_user', 'employee')
      )
    )
    OR (
      job_money_items.recurring_job_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.recurring_jobs rj
        JOIN public.company_users cu ON cu.company_id = rj.company_id
        WHERE rj.id = job_money_items.recurring_job_id
          AND cu.user_id = auth.uid()
          AND cu.role IN ('owner', 'super_user', 'employee')
      )
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );
