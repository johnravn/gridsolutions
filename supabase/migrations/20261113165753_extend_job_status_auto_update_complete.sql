-- Extend hourly job-status auto-update:
-- - confirmed → in_progress only while inside [start_at, end_at]
-- - confirmed | in_progress → completed when end_at < now()
-- - no longer auto-promotes planned/requested
-- Backfill of stuck past in_progress rows happens on the next cron/manual run.

CREATE OR REPLACE FUNCTION public.auto_update_jobs_to_in_progress(
  p_trigger_source text DEFAULT 'pg_cron'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows_to_in_progress integer := 0;
  v_rows_to_completed integer := 0;
BEGIN
  UPDATE public.jobs
  SET status = 'in_progress'
  WHERE start_at IS NOT NULL
    AND end_at IS NOT NULL
    AND start_at <= NOW()
    AND end_at >= NOW()
    AND status = 'confirmed';

  GET DIAGNOSTICS v_rows_to_in_progress = ROW_COUNT;

  UPDATE public.jobs
  SET status = 'completed'
  WHERE end_at IS NOT NULL
    AND end_at < NOW()
    AND status IN ('in_progress', 'confirmed');

  GET DIAGNOSTICS v_rows_to_completed = ROW_COUNT;

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
    COALESCE(NULLIF(trim(p_trigger_source), ''), 'pg_cron'),
    jsonb_build_object(
      'rowsToInProgress', v_rows_to_in_progress,
      'rowsToCompleted', v_rows_to_completed,
      'rowsUpdated', v_rows_to_in_progress + v_rows_to_completed
    )
  );
END;
$$;

COMMENT ON FUNCTION public.auto_update_jobs_to_in_progress(text) IS
  'Hourly job status sync: confirmed→in_progress inside window; confirmed|in_progress→completed after end_at. Logs scheduled_job_runs.';

GRANT EXECUTE ON FUNCTION public.auto_update_jobs_to_in_progress(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.auto_update_jobs_to_in_progress(text) TO service_role;

CREATE OR REPLACE FUNCTION public.trigger_job_status_auto_update()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows_to_in_progress integer := 0;
  v_rows_to_completed integer := 0;
BEGIN
  IF NOT public.is_superuser(auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  UPDATE public.jobs
  SET status = 'in_progress'
  WHERE start_at IS NOT NULL
    AND end_at IS NOT NULL
    AND start_at <= NOW()
    AND end_at >= NOW()
    AND status = 'confirmed';

  GET DIAGNOSTICS v_rows_to_in_progress = ROW_COUNT;

  UPDATE public.jobs
  SET status = 'completed'
  WHERE end_at IS NOT NULL
    AND end_at < NOW()
    AND status IN ('in_progress', 'confirmed');

  GET DIAGNOSTICS v_rows_to_completed = ROW_COUNT;

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
    'manual',
    jsonb_build_object(
      'rowsToInProgress', v_rows_to_in_progress,
      'rowsToCompleted', v_rows_to_completed,
      'rowsUpdated', v_rows_to_in_progress + v_rows_to_completed
    )
  );

  RETURN jsonb_build_object(
    'rowsToInProgress', v_rows_to_in_progress,
    'rowsToCompleted', v_rows_to_completed,
    'rowsUpdated', v_rows_to_in_progress + v_rows_to_completed
  );
END;
$$;

COMMENT ON FUNCTION public.trigger_job_status_auto_update() IS
  'Superuser-only manual run of job status auto-update (in_progress + completed); logs trigger_source = manual.';

REVOKE ALL ON FUNCTION public.trigger_job_status_auto_update() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.trigger_job_status_auto_update() TO authenticated;
GRANT EXECUTE ON FUNCTION public.trigger_job_status_auto_update() TO service_role;

-- Ensure hourly cron is present (idempotent).
DO $restore_cron$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid)
    FROM cron.job
    WHERE jobname IN (
      'auto-update-jobs-to-in-progress-hourly',
      'auto_update_jobs_to_in_progress',
      'auto-update-jobs-in-progress'
    );

    PERFORM cron.schedule(
      'auto-update-jobs-to-in-progress-hourly',
      '0 * * * *',
      $cmd$SELECT public.auto_update_jobs_to_in_progress();$cmd$
    );
  ELSE
    RAISE NOTICE 'pg_cron not found; auto-update-jobs-to-in-progress-hourly was not scheduled.';
  END IF;
END
$restore_cron$;
