-- Calendar subscriptions: premade kinds (all_jobs, project_lead_jobs, crew_jobs,
-- transport_vehicle, transport_all). Up to 3 subscriptions per user per company.

-- Add new columns
ALTER TABLE public.calendar_subscriptions
  ADD COLUMN IF NOT EXISTS kind text,
  ADD COLUMN IF NOT EXISTS vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL;

-- Backfill kind and vehicle_id from existing columns
UPDATE public.calendar_subscriptions cs
SET
  kind = CASE
    WHEN cs.only_my_assignments = true
         AND (cs.categories IS NULL OR 'crew' = ANY(cs.categories))
    THEN 'crew_jobs'
    WHEN cs.include_project_lead_jobs = true
         AND (cs.categories IS NULL OR 'program' = ANY(cs.categories))
    THEN 'project_lead_jobs'
    WHEN cs.categories IS NOT NULL AND 'transport' = ANY(cs.categories) THEN
      CASE
        WHEN cs.vehicle_ids IS NOT NULL AND array_length(cs.vehicle_ids, 1) = 1
        THEN 'transport_vehicle'
        ELSE 'transport_all'
      END
    ELSE 'all_jobs'
  END,
  vehicle_id = CASE
    WHEN cs.vehicle_ids IS NOT NULL AND array_length(cs.vehicle_ids, 1) = 1
    THEN cs.vehicle_ids[1]
    ELSE NULL
  END
WHERE cs.kind IS NULL;

-- Set default and NOT NULL for kind
ALTER TABLE public.calendar_subscriptions
  ALTER COLUMN kind SET DEFAULT 'all_jobs';
UPDATE public.calendar_subscriptions SET kind = 'all_jobs' WHERE kind IS NULL;
ALTER TABLE public.calendar_subscriptions
  ALTER COLUMN kind SET NOT NULL;

-- Drop old unique constraint (allow multiple subscriptions per user)
ALTER TABLE public.calendar_subscriptions
  DROP CONSTRAINT IF EXISTS calendar_subscriptions_company_user_unique;

-- Drop old columns
ALTER TABLE public.calendar_subscriptions
  DROP COLUMN IF EXISTS categories,
  DROP COLUMN IF EXISTS only_my_assignments,
  DROP COLUMN IF EXISTS include_project_lead_jobs,
  DROP COLUMN IF EXISTS vehicle_ids;

-- Constraint: at most 3 subscriptions per (company_id, user_id)
CREATE OR REPLACE FUNCTION public.calendar_subscriptions_max_3_per_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n bigint;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT count(*) INTO n
    FROM public.calendar_subscriptions
    WHERE company_id = NEW.company_id AND user_id = NEW.user_id;
    IF n >= 3 THEN
      RAISE EXCEPTION 'At most 3 calendar subscriptions per user per company';
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.company_id = NEW.company_id AND OLD.user_id = NEW.user_id THEN
      RETURN NEW;
    END IF;
    SELECT count(*) INTO n
    FROM public.calendar_subscriptions
    WHERE company_id = NEW.company_id AND user_id = NEW.user_id
      AND id != OLD.id;
    IF n >= 2 THEN
      RAISE EXCEPTION 'At most 3 calendar subscriptions per user per company';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_calendar_subscriptions_max_3 ON public.calendar_subscriptions;
CREATE TRIGGER trg_calendar_subscriptions_max_3
  BEFORE INSERT OR UPDATE ON public.calendar_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.calendar_subscriptions_max_3_per_user();

-- Validate kind values
ALTER TABLE public.calendar_subscriptions
  ADD CONSTRAINT calendar_subscriptions_kind_check
  CHECK (kind IN ('all_jobs', 'project_lead_jobs', 'crew_jobs', 'transport_vehicle', 'transport_all'));

COMMENT ON COLUMN public.calendar_subscriptions.kind
  IS 'Premade feed type: all_jobs, project_lead_jobs, crew_jobs, transport_vehicle, transport_all.';
COMMENT ON COLUMN public.calendar_subscriptions.vehicle_id
  IS 'For kind=transport_vehicle: the single vehicle to show. NULL for other kinds.';
