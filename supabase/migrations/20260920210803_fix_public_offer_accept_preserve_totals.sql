-- Fix public_offer_accept rewriting locked offer totals with the wrong discount.
--
-- Technical offers discount equipment only (crew/transport are excluded). The
-- options-block accept RPC was always applying discount_percent to the full
-- total_before_discount (+ options), so accepting a technical offer with a
-- customer discount jumped the displayed/invoiced total away from the locked
-- public offer price.
--
-- Rules:
-- - technical + no options: keep locked totals exactly
-- - technical + options: keep equipment-only discount; add options at full price
-- - pretty (with or without options): discount applies to base + options
--   (matches the live public pretty-offer footer)

CREATE OR REPLACE FUNCTION public.public_offer_accept(
  p_access_token text,
  p_first_name text,
  p_last_name text,
  p_phone text,
  p_selected_option_ids jsonb DEFAULT '[]'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offer public.job_offers%ROWTYPE;
  v_newer_exists boolean;
  v_full_name text;
  v_updated int;
  v_option_id text;
  v_options_subtotal numeric(12,2) := 0;
  v_selections jsonb := '[]'::jsonb;
  v_known record;
  v_adjusted_before_discount numeric(12,2);
  v_discount_amount numeric(12,2);
  v_after_discount numeric(12,2);
  v_with_vat numeric(12,2);
  v_vat_percent numeric(5,2);
  v_discount_percent numeric(5,2);
BEGIN
  SELECT *
  INTO v_offer
  FROM public.job_offers
  WHERE access_token = p_access_token
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Offer not found';
  END IF;

  IF v_offer.status = 'superseded' THEN
    RAISE EXCEPTION 'This offer can no longer be accepted because a newer version has been sent.';
  END IF;

  IF v_offer.status <> 'sent' THEN
    RAISE EXCEPTION 'This offer can no longer be accepted.';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.job_offers o2
    WHERE o2.job_id = v_offer.job_id
      AND o2.version_number > v_offer.version_number
      AND o2.status IN ('sent', 'viewed', 'accepted')
  )
  INTO v_newer_exists;

  IF v_newer_exists THEN
    RAISE EXCEPTION 'This offer can no longer be accepted because a newer version has been sent.';
  END IF;

  IF p_selected_option_ids IS NOT NULL
     AND jsonb_typeof(p_selected_option_ids) = 'array'
     AND jsonb_array_length(p_selected_option_ids) > 0 THEN
    FOR v_option_id IN
      SELECT jsonb_array_elements_text(p_selected_option_ids)
    LOOP
      SELECT *
      INTO v_known
      FROM public.collect_offer_options(v_offer.id) o
      WHERE o.option_id = v_option_id
      LIMIT 1;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid option selection';
      END IF;

      v_options_subtotal := v_options_subtotal + COALESCE(v_known.price, 0);
      v_selections := v_selections || jsonb_build_array(
        jsonb_build_object(
          'option_id', v_known.option_id,
          'block_id', v_known.block_id,
          'module_id', v_known.module_id,
          'label', v_known.label,
          'price', v_known.price
        )
      );
    END LOOP;
  END IF;

  v_vat_percent := COALESCE(v_offer.vat_percent, 25);
  v_discount_percent := COALESCE(v_offer.discount_percent, 0);
  v_adjusted_before_discount :=
    COALESCE(v_offer.total_before_discount, 0) + v_options_subtotal;

  IF v_offer.offer_type = 'technical' AND v_options_subtotal = 0 THEN
    -- Locked technical totals already use equipment-only discount.
    v_after_discount := COALESCE(v_offer.total_after_discount, 0);
    v_with_vat := COALESCE(v_offer.total_with_vat, 0);
  ELSIF v_offer.offer_type = 'technical' THEN
    -- Options are add-ons at full price; do not re-discount crew/transport.
    v_discount_amount := round(
      COALESCE(v_offer.equipment_subtotal, 0) * v_discount_percent / 100,
      2
    );
    v_after_discount := round(v_adjusted_before_discount - v_discount_amount, 2);
    v_with_vat := round(v_after_discount * (1 + v_vat_percent / 100), 2);
  ELSE
    -- Pretty offers: discount applies to base + selected options.
    v_discount_amount := round(
      v_adjusted_before_discount * v_discount_percent / 100,
      2
    );
    v_after_discount := round(v_adjusted_before_discount - v_discount_amount, 2);
    v_with_vat := round(v_after_discount * (1 + v_vat_percent / 100), 2);
  END IF;

  v_full_name := btrim(concat_ws(' ', nullif(btrim(p_first_name), ''), nullif(btrim(p_last_name), '')));

  UPDATE public.job_offers
  SET
    status = 'accepted',
    accepted_at = NOW(),
    accepted_by_name = NULLIF(v_full_name, ''),
    accepted_by_phone = NULLIF(btrim(p_phone), ''),
    accepted_option_selections = CASE
      WHEN jsonb_array_length(v_selections) > 0 THEN v_selections
      ELSE NULL
    END,
    accepted_options_subtotal = CASE
      WHEN v_options_subtotal > 0 THEN v_options_subtotal
      ELSE NULL
    END,
    total_before_discount = v_adjusted_before_discount,
    total_after_discount = v_after_discount,
    total_with_vat = v_with_vat
  WHERE id = v_offer.id
    AND status = 'sent';

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN
    RAISE EXCEPTION 'This offer can no longer be accepted.';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.public_offer_accept(text, text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_offer_accept(text, text, text, text, jsonb) TO anon, authenticated;
