-- Weekly advance of demo company job timelines (+7 days) so sample data stays current.
-- Logged to scheduled_job_runs for Super Monitor.

CREATE OR REPLACE FUNCTION public.advance_demo_company_timeline(
  p_interval interval DEFAULT interval '7 days'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_started_at timestamptz := now();
  v_trigger text;
  v_demo_company_ids uuid[];
  v_jobs_updated integer := 0;
  v_time_periods_updated integer := 0;
  v_reserved_items_updated integer := 0;
  v_reserved_vehicles_updated integer := 0;
  v_offer_crew_updated integer := 0;
  v_offer_transport_updated integer := 0;
  v_offer_block_items_updated integer := 0;
  v_time_entries_updated integer := 0;
  v_details jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    v_trigger := 'pg_cron';
  ELSIF public.is_superuser(auth.uid()) THEN
    v_trigger := 'superuser_manual';
  ELSE
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT array_agg(c.id ORDER BY c.created_at)
  INTO v_demo_company_ids
  FROM public.companies c
  WHERE c.is_demo = true;

  IF v_demo_company_ids IS NULL OR cardinality(v_demo_company_ids) = 0 THEN
    v_details := jsonb_build_object(
      'intervalDays', EXTRACT(epoch FROM p_interval) / 86400,
      'jobsUpdated', 0,
      'timePeriodsUpdated', 0,
      'reservedItemsUpdated', 0,
      'reservedVehiclesUpdated', 0,
      'offerCrewItemsUpdated', 0,
      'offerTransportItemsUpdated', 0,
      'offerBlockItemsUpdated', 0,
      'timeEntriesUpdated', 0,
      'message', 'No demo companies configured'
    );

    INSERT INTO public.scheduled_job_runs (
      job_key,
      started_at,
      finished_at,
      status,
      trigger_source,
      details
    ) VALUES (
      'demo_timeline_advance',
      v_started_at,
      now(),
      'success',
      v_trigger,
      v_details
    );

    RETURN v_details;
  END IF;

  UPDATE public.jobs j
  SET
    start_at = CASE WHEN j.start_at IS NOT NULL THEN j.start_at + p_interval ELSE NULL END,
    end_at = CASE WHEN j.end_at IS NOT NULL THEN j.end_at + p_interval ELSE NULL END
  WHERE j.company_id = ANY (v_demo_company_ids)
    AND j.archived = false
    AND (j.start_at IS NOT NULL OR j.end_at IS NOT NULL);
  GET DIAGNOSTICS v_jobs_updated = ROW_COUNT;

  UPDATE public.time_periods tp
  SET
    start_at = tp.start_at + p_interval,
    end_at = tp.end_at + p_interval
  WHERE tp.company_id = ANY (v_demo_company_ids)
    AND tp.deleted = false
    AND tp.job_id IN (
      SELECT j.id
      FROM public.jobs j
      WHERE j.company_id = ANY (v_demo_company_ids)
        AND j.archived = false
    );
  GET DIAGNOSTICS v_time_periods_updated = ROW_COUNT;

  UPDATE public.reserved_items ri
  SET
    start_at = CASE WHEN ri.start_at IS NOT NULL THEN ri.start_at + p_interval ELSE NULL END,
    end_at = CASE WHEN ri.end_at IS NOT NULL THEN ri.end_at + p_interval ELSE NULL END
  WHERE ri.time_period_id IN (
      SELECT tp.id
      FROM public.time_periods tp
      WHERE tp.company_id = ANY (v_demo_company_ids)
        AND tp.deleted = false
    )
    AND (ri.start_at IS NOT NULL OR ri.end_at IS NOT NULL);
  GET DIAGNOSTICS v_reserved_items_updated = ROW_COUNT;

  UPDATE public.reserved_vehicles rv
  SET
    start_at = CASE WHEN rv.start_at IS NOT NULL THEN rv.start_at + p_interval ELSE NULL END,
    end_at = CASE WHEN rv.end_at IS NOT NULL THEN rv.end_at + p_interval ELSE NULL END
  WHERE rv.time_period_id IN (
      SELECT tp.id
      FROM public.time_periods tp
      WHERE tp.company_id = ANY (v_demo_company_ids)
        AND tp.deleted = false
    )
    AND (rv.start_at IS NOT NULL OR rv.end_at IS NOT NULL);
  GET DIAGNOSTICS v_reserved_vehicles_updated = ROW_COUNT;

  UPDATE public.offer_crew_items oci
  SET
    start_date = oci.start_date + p_interval,
    end_date = oci.end_date + p_interval
  FROM public.job_offers jo
  JOIN public.jobs j ON j.id = jo.job_id
  WHERE oci.offer_id = jo.id
    AND j.company_id = ANY (v_demo_company_ids)
    AND j.archived = false;
  GET DIAGNOSTICS v_offer_crew_updated = ROW_COUNT;

  UPDATE public.offer_transport_items oti
  SET
    start_date = oti.start_date + p_interval,
    end_date = oti.end_date + p_interval
  FROM public.job_offers jo
  JOIN public.jobs j ON j.id = jo.job_id
  WHERE oti.offer_id = jo.id
    AND j.company_id = ANY (v_demo_company_ids)
    AND j.archived = false;
  GET DIAGNOSTICS v_offer_transport_updated = ROW_COUNT;

  UPDATE public.pretty_offer_module_block_items pobi
  SET
    start_at = CASE WHEN pobi.start_at IS NOT NULL THEN pobi.start_at + p_interval ELSE NULL END,
    end_at = CASE WHEN pobi.end_at IS NOT NULL THEN pobi.end_at + p_interval ELSE NULL END
  FROM public.pretty_offer_module_blocks pob
  JOIN public.pretty_offer_modules pom ON pom.id = pob.module_id
  JOIN public.job_offers jo ON jo.id = pom.offer_id
  JOIN public.jobs j ON j.id = jo.job_id
  WHERE pobi.block_id = pob.id
    AND j.company_id = ANY (v_demo_company_ids)
    AND j.archived = false
    AND (pobi.start_at IS NOT NULL OR pobi.end_at IS NOT NULL);
  GET DIAGNOSTICS v_offer_block_items_updated = ROW_COUNT;

  UPDATE public.time_entries te
  SET
    start_at = te.start_at + p_interval,
    end_at = te.end_at + p_interval
  WHERE te.company_id = ANY (v_demo_company_ids);
  GET DIAGNOSTICS v_time_entries_updated = ROW_COUNT;

  v_details := jsonb_build_object(
    'intervalDays', EXTRACT(epoch FROM p_interval) / 86400,
    'jobsUpdated', v_jobs_updated,
    'timePeriodsUpdated', v_time_periods_updated,
    'reservedItemsUpdated', v_reserved_items_updated,
    'reservedVehiclesUpdated', v_reserved_vehicles_updated,
    'offerCrewItemsUpdated', v_offer_crew_updated,
    'offerTransportItemsUpdated', v_offer_transport_updated,
    'offerBlockItemsUpdated', v_offer_block_items_updated,
    'timeEntriesUpdated', v_time_entries_updated
  );

  INSERT INTO public.scheduled_job_runs (
    job_key,
    started_at,
    finished_at,
    status,
    trigger_source,
    details
  ) VALUES (
    'demo_timeline_advance',
    v_started_at,
    now(),
    'success',
    v_trigger,
    v_details
  );

  RETURN v_details;
EXCEPTION
  WHEN OTHERS THEN
    INSERT INTO public.scheduled_job_runs (
      job_key,
      started_at,
      finished_at,
      status,
      trigger_source,
      details,
      error_message
    ) VALUES (
      'demo_timeline_advance',
      v_started_at,
      now(),
      'failed',
      v_trigger,
      jsonb_build_object(
        'intervalDays', EXTRACT(epoch FROM p_interval) / 86400
      ),
      SQLERRM
    );
    RAISE;
END;
$$;

COMMENT ON FUNCTION public.advance_demo_company_timeline(interval) IS
  'Shifts demo company job timelines forward by the given interval (default 7 days). Callable by pg_cron or global superusers.';

REVOKE ALL ON FUNCTION public.advance_demo_company_timeline(interval) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.advance_demo_company_timeline(interval) TO authenticated;
GRANT EXECUTE ON FUNCTION public.advance_demo_company_timeline(interval) TO service_role;

DO $schedule$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid)
    FROM cron.job
    WHERE jobname = 'advance-demo-company-timeline-weekly';

    PERFORM cron.schedule(
      'advance-demo-company-timeline-weekly',
      '0 4 * * 1',
      $$SELECT public.advance_demo_company_timeline();$$
    );
  ELSE
    RAISE NOTICE 'pg_cron not found; advance_demo_company_timeline was created but not scheduled.';
  END IF;
END;
$schedule$;
