-- Phase C: Store effective booking windows on reserved_items and GiST-index them.
-- Mirrors reserved_vehicles.during: COALESCE(row start/end, time_period start/end).
-- Enables sargable overlap checks (check_item_quantity) and future conflict SQL.

-- 1) Column
ALTER TABLE public.reserved_items
  ADD COLUMN IF NOT EXISTS during tstzrange;

-- 2) Backfill from current row + period windows
UPDATE public.reserved_items ri
SET during = tstzrange(
  COALESCE(ri.start_at, tp.start_at),
  COALESCE(ri.end_at,   tp.end_at),
  '[)'
)
FROM public.time_periods tp
WHERE tp.id = ri.time_period_id
  AND (
    ri.during IS NULL
    OR ri.during IS DISTINCT FROM tstzrange(
      COALESCE(ri.start_at, tp.start_at),
      COALESCE(ri.end_at,   tp.end_at),
      '[)'
    )
  );

-- 3) BEFORE INSERT/UPDATE: keep during fresh on the row itself
CREATE OR REPLACE FUNCTION public._ri_set_during()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  hdr_start timestamptz;
  hdr_end   timestamptz;
BEGIN
  SELECT r.start_at, r.end_at INTO hdr_start, hdr_end
  FROM public.time_periods r
  WHERE r.id = NEW.time_period_id;

  IF hdr_start IS NULL OR hdr_end IS NULL THEN
    RAISE EXCEPTION 'Reservation % must have start_at and end_at before adding items',
      NEW.time_period_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  IF NEW.start_at IS NULL AND NEW.end_at IS NULL THEN
    NEW.during := tstzrange(hdr_start, hdr_end, '[)');
  ELSE
    NEW.during := tstzrange(
      COALESCE(NEW.start_at, hdr_start),
      COALESCE(NEW.end_at,   hdr_end),
      '[)'
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ri_set_during_ins ON public.reserved_items;
DROP TRIGGER IF EXISTS reserved_items_during_set_ins ON public.reserved_items;
CREATE TRIGGER reserved_items_during_set_ins
  BEFORE INSERT ON public.reserved_items
  FOR EACH ROW
  EXECUTE FUNCTION public._ri_set_during();

DROP TRIGGER IF EXISTS ri_set_during_upd ON public.reserved_items;
DROP TRIGGER IF EXISTS reserved_items_during_set_upd ON public.reserved_items;
CREATE TRIGGER reserved_items_during_set_upd
  BEFORE UPDATE OF start_at, end_at, time_period_id
  ON public.reserved_items
  FOR EACH ROW
  EXECUTE FUNCTION public._ri_set_during();

COMMENT ON FUNCTION public._ri_set_during()
  IS 'Sets reserved_items.during from row overrides or parent time_periods window';

-- 4) When time_periods dates change, recompute linked reserved_items.during
CREATE OR REPLACE FUNCTION public.sync_reserved_items_during_from_time_period()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  IF NEW.start_at IS NOT DISTINCT FROM OLD.start_at
     AND NEW.end_at IS NOT DISTINCT FROM OLD.end_at THEN
    RETURN NEW;
  END IF;

  UPDATE public.reserved_items ri
  SET during = tstzrange(
    COALESCE(ri.start_at, NEW.start_at),
    COALESCE(ri.end_at,   NEW.end_at),
    '[)'
  )
  WHERE ri.time_period_id = NEW.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_reserved_items_during_from_time_period
  ON public.time_periods;

CREATE TRIGGER trg_sync_reserved_items_during_from_time_period
  AFTER UPDATE OF start_at, end_at
  ON public.time_periods
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_reserved_items_during_from_time_period();

COMMENT ON FUNCTION public.sync_reserved_items_during_from_time_period()
  IS 'Recomputes reserved_items.during when time_periods.start_at/end_at changes';

-- 5) GiST for item + effective window (btree_gist equality on uuid + range &&)
CREATE INDEX IF NOT EXISTS reserved_items_item_during_gist
  ON public.reserved_items
  USING gist (item_id, during);

GRANT ALL ON FUNCTION public._ri_set_during() TO anon, authenticated, service_role;
GRANT ALL ON FUNCTION public.sync_reserved_items_during_from_time_period() TO anon, authenticated, service_role;
