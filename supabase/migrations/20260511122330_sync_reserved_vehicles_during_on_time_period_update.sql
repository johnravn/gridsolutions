-- Keep reserved_vehicles.during in sync with time_periods changes
-- so the no_overlapping_vehicle_bookings exclusion constraint remains correct.
--
-- Problem: reserved_vehicles.during is set via triggers on reserved_vehicles,
-- but if time_periods.start_at/end_at is edited later, reserved_vehicles.during
-- becomes stale. That can allow double-booking by moving bookings around.
--
-- Fix: whenever a time_period changes its start/end, recompute `during` for all
-- linked reserved_vehicles rows based on:
--   [coalesce(rv.start_at, tp.start_at), coalesce(rv.end_at, tp.end_at))
--
-- This makes overlap checks correct for both job-based and personal bookings.

CREATE OR REPLACE FUNCTION public.sync_reserved_vehicles_during_from_time_period()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  -- Only recompute when relevant fields change
  IF NEW.start_at IS NOT DISTINCT FROM OLD.start_at
     AND NEW.end_at   IS NOT DISTINCT FROM OLD.end_at THEN
    RETURN NEW;
  END IF;

  UPDATE public.reserved_vehicles rv
  SET during = tstzrange(
    COALESCE(rv.start_at, NEW.start_at),
    COALESCE(rv.end_at,   NEW.end_at),
    '[)'
  )
  WHERE rv.time_period_id = NEW.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_reserved_vehicles_during_from_time_period
  ON public.time_periods;

CREATE TRIGGER trg_sync_reserved_vehicles_during_from_time_period
  AFTER UPDATE OF start_at, end_at
  ON public.time_periods
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_reserved_vehicles_during_from_time_period();

COMMENT ON FUNCTION public.sync_reserved_vehicles_during_from_time_period()
  IS 'Recomputes reserved_vehicles.during when time_periods.start_at/end_at changes to keep overlap exclusion constraint correct';

