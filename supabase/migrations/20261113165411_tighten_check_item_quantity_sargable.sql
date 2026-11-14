-- Phase C: Make check_item_quantity overlap scan sargable via reserved_items.during.
-- Preserves forced/subrental skips and capacity semantics from prior definition.
-- Requires reserved_items.during (see add_reserved_items_during_and_gist).

CREATE OR REPLACE FUNCTION public.check_item_quantity()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  hdr_start timestamptz;
  hdr_end   timestamptz;
  eff_start timestamptz;
  eff_end   timestamptz;
  overlap_sum integer;
  capacity  integer;
  v_item_kind public.inventory_item_kind;
BEGIN
  IF NEW.forced THEN
    RETURN NEW;
  END IF;

  SELECT i.item_kind, i.total_quantity
  INTO v_item_kind, capacity
  FROM public.items i
  WHERE i.id = NEW.item_id;

  IF v_item_kind IS NULL THEN
    RAISE EXCEPTION 'Item % does not exist', NEW.item_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  IF v_item_kind = 'subrental' THEN
    RETURN NEW;
  END IF;

  SELECT r.start_at, r.end_at INTO hdr_start, hdr_end
  FROM public.time_periods r
  WHERE r.id = NEW.time_period_id;

  IF hdr_start IS NULL OR hdr_end IS NULL THEN
    RAISE EXCEPTION 'Reservation % must have start_at and end_at before adding items',
      NEW.time_period_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  -- Always derive NEW's probe window from start/end + period (not NEW.during),
  -- so correctness does not depend on BEFORE-trigger ordering vs during_set.
  eff_start := COALESCE(NEW.start_at, hdr_start);
  eff_end   := COALESCE(NEW.end_at,   hdr_end);

  -- Sargable: item_id equality + during && uses reserved_items_item_during_gist
  SELECT COALESCE(SUM(ri.quantity), 0) INTO overlap_sum
  FROM public.reserved_items ri
  WHERE ri.item_id = NEW.item_id
    AND NOT ri.forced
    AND ri.during && tstzrange(eff_start, eff_end, '[)')
    AND (TG_OP <> 'UPDATE' OR ri.id <> NEW.id);

  IF overlap_sum + NEW.quantity > capacity THEN
    RAISE EXCEPTION
      'Not enough quantity for item %, requested=% / capacity=% in period',
      NEW.item_id, (overlap_sum + NEW.quantity), capacity
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

-- Ensure qty guard still fires on forced flips and window changes.
DROP TRIGGER IF EXISTS reserved_items_qty_guard ON public.reserved_items;
CREATE TRIGGER reserved_items_qty_guard
  BEFORE INSERT OR UPDATE OF item_id, quantity, start_at, end_at, time_period_id, forced
  ON public.reserved_items
  FOR EACH ROW
  EXECUTE FUNCTION public.check_item_quantity();

COMMENT ON FUNCTION public.check_item_quantity()
  IS 'Enforces item capacity against overlapping reserved_items using sargable during &&';
