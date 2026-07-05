-- Scheduled job run history for super admin monitoring.

CREATE TABLE IF NOT EXISTS public.scheduled_job_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_key text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL CHECK (status IN ('running', 'success', 'partial', 'failed')),
  trigger_source text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_job_runs_job_key_started
  ON public.scheduled_job_runs (job_key, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_scheduled_job_runs_started
  ON public.scheduled_job_runs (started_at DESC);

COMMENT ON TABLE public.scheduled_job_runs IS
  'Execution history for scheduled jobs (Conta sync, notification dispatch, job status auto-update). Written by service role / SECURITY DEFINER; readable by global superusers.';

ALTER TABLE public.scheduled_job_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Superusers can read scheduled job runs" ON public.scheduled_job_runs;
CREATE POLICY "Superusers can read scheduled job runs"
  ON public.scheduled_job_runs
  FOR SELECT
  USING (public.is_superuser(auth.uid()));

-- Log job status auto-update runs from pg_cron.
CREATE OR REPLACE FUNCTION public.auto_update_jobs_to_in_progress()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows_updated integer;
  v_run_id uuid;
BEGIN
  UPDATE jobs
  SET status = 'in_progress'
  WHERE
    start_at IS NOT NULL
    AND start_at <= NOW()
    AND status IN ('confirmed', 'planned', 'requested')
    AND status != 'in_progress';

  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;

  INSERT INTO public.scheduled_job_runs (
    job_key,
    started_at,
    finished_at,
    status,
    trigger_source,
    details
  ) VALUES (
    'job_status_auto_update',
    NOW(),
    NOW(),
    'success',
    'pg_cron',
    jsonb_build_object('rowsUpdated', v_rows_updated)
  )
  RETURNING id INTO v_run_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.auto_update_jobs_to_in_progress() TO authenticated;

-- Aggregated snapshot for the Super Monitor tab.
CREATE OR REPLACE FUNCTION public.get_system_monitor_snapshot()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_jobs jsonb;
  v_recent_runs jsonb;
  v_conta_companies jsonb;
  v_notification_backlog jsonb;
  v_platform_counts jsonb;
BEGIN
  IF NOT public.is_superuser(auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(lr)::jsonb ORDER BY lr.job_key), '[]'::jsonb)
  INTO v_jobs
  FROM (
    SELECT DISTINCT ON (r.job_key)
      r.job_key,
      r.id AS last_run_id,
      r.started_at AS last_started_at,
      r.finished_at AS last_finished_at,
      r.status AS last_status,
      r.trigger_source AS last_trigger_source,
      r.details AS last_details,
      r.error_message AS last_error_message
    FROM public.scheduled_job_runs r
    ORDER BY r.job_key, r.started_at DESC
  ) lr;

  SELECT COALESCE(jsonb_agg(row_to_json(rr)::jsonb ORDER BY rr.started_at DESC), '[]'::jsonb)
  INTO v_recent_runs
  FROM (
    SELECT
      id,
      job_key,
      started_at,
      finished_at,
      status,
      trigger_source,
      details,
      error_message
    FROM public.scheduled_job_runs
    ORDER BY started_at DESC
    LIMIT 30
  ) rr;

  SELECT COALESCE(jsonb_agg(row_to_json(cc)::jsonb ORDER BY cc.company_name), '[]'::jsonb)
  INTO v_conta_companies
  FROM (
    SELECT
      ce.company_id,
      c.name AS company_name,
      COALESCE(ce.accounting_api_key_active, true) AS api_key_active,
      ce.accounting_organization_id,
      ce.accounting_api_environment,
      (
        SELECT MAX(cust.conta_last_synced_at)
        FROM customers cust
        WHERE cust.company_id = ce.company_id
          AND cust.conta_customer_id IS NOT NULL
          AND (cust.deleted IS NULL OR cust.deleted = false)
      ) AS last_customer_sync_at,
      (
        SELECT COUNT(*)::integer
        FROM customers cust
        WHERE cust.company_id = ce.company_id
          AND cust.conta_customer_id IS NOT NULL
          AND (cust.deleted IS NULL OR cust.deleted = false)
      ) AS linked_customer_count,
      (
        SELECT COUNT(*)::integer
        FROM customers cust
        WHERE cust.company_id = ce.company_id
          AND cust.conta_customer_id IS NOT NULL
          AND (cust.deleted IS NULL OR cust.deleted = false)
          AND (
            cust.conta_last_synced_at IS NULL
            OR cust.conta_last_synced_at < now() - interval '7 days'
          )
      ) AS stale_customer_count
    FROM company_expansions ce
    JOIN companies c ON c.id = ce.company_id
    WHERE ce.accounting_software = 'conta'
      AND ce.accounting_organization_id IS NOT NULL
  ) cc;

  SELECT jsonb_build_object(
    'pendingCount', (
      SELECT COUNT(*)::integer
      FROM notifications n
      WHERE n.email_sent_at IS NULL
    ),
    'oldestPendingAt', (
      SELECT MIN(n.created_at)
      FROM notifications n
      WHERE n.email_sent_at IS NULL
    )
  )
  INTO v_notification_backlog;

  SELECT jsonb_build_object(
    'companies', (
      SELECT COUNT(*)::integer
      FROM companies
    ),
    'users', (
      SELECT COUNT(*)::integer
      FROM profiles
    ),
    'inProgressJobs', (
      SELECT COUNT(*)::integer
      FROM jobs j
      WHERE j.status = 'in_progress'
        AND j.archived = false
    )
  )
  INTO v_platform_counts;

  RETURN jsonb_build_object(
    'jobs', v_jobs,
    'recentRuns', v_recent_runs,
    'contaCompanies', v_conta_companies,
    'notificationBacklog', v_notification_backlog,
    'platformCounts', v_platform_counts
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_system_monitor_snapshot() TO authenticated;
