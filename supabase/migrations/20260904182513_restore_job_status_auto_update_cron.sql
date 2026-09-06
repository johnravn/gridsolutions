-- Restore hourly job-status auto-update cron (missing on some local/remote setups).
-- Uses the updated auto_update_jobs_to_in_progress(text) signature with default trigger_source.

DO $restore_cron$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid)
    FROM cron.job
    WHERE jobname IN (
      'auto-update-jobs-to-in-progress-hourly',
      'auto_update_jobs_to_in_progress'
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
