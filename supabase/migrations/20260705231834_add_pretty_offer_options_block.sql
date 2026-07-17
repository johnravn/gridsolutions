-- Options block for pretty offers + persist selected options on accept

DO $$ BEGIN
  ALTER TYPE public.pretty_module_block_type ADD VALUE 'options';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE public.job_offers
  ADD COLUMN IF NOT EXISTS accepted_option_selections JSONB,
  ADD COLUMN IF NOT EXISTS accepted_options_subtotal NUMERIC(12,2);

COMMENT ON COLUMN public.job_offers.accepted_option_selections IS
  'Snapshot of customer-selected pretty offer options at acceptance time.';
COMMENT ON COLUMN public.job_offers.accepted_options_subtotal IS
  'Sum of selected option prices (excl. VAT) at acceptance time.';

-- Collect flat option entries from top-level and column-layout nested options blocks.
CREATE OR REPLACE FUNCTION public.collect_offer_options(p_offer_id uuid)
RETURNS TABLE (
  option_id text,
  block_id uuid,
  module_id uuid,
  label text,
  price numeric
)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_group record;
  v_opt jsonb;
  v_col record;
  v_nested_block jsonb;
  v_nested_group jsonb;
BEGIN
  -- Top-level options blocks
  FOR v_group IN
    SELECT
      b.id AS block_id,
      b.module_id,
      bi.detail
    FROM public.pretty_offer_module_blocks b
    JOIN public.pretty_offer_modules m ON m.id = b.module_id
    JOIN public.pretty_offer_module_block_items bi ON bi.block_id = b.id
    WHERE m.offer_id = p_offer_id
      AND b.block_type = 'options'
    ORDER BY bi.sort_order
  LOOP
    IF v_group.detail IS NULL OR v_group.detail = '' THEN
      CONTINUE;
    END IF;

    BEGIN
      FOR v_opt IN
        SELECT value
        FROM jsonb_array_elements(
          COALESCE((v_group.detail::jsonb)->'options', '[]'::jsonb)
        )
      LOOP
        option_id := v_opt->>'id';
        IF option_id IS NULL OR option_id = '' THEN
          CONTINUE;
        END IF;
        block_id := v_group.block_id;
        module_id := v_group.module_id;
        label := COALESCE(v_opt->>'label', '');
        price := COALESCE(NULLIF(v_opt->>'price', '')::numeric, 0);
        RETURN NEXT;
      END LOOP;
    EXCEPTION
      WHEN OTHERS THEN
        CONTINUE;
    END;
  END LOOP;

  -- Options blocks nested inside column layouts
  FOR v_col IN
    SELECT
      b.module_id,
      bi.detail
    FROM public.pretty_offer_module_blocks b
    JOIN public.pretty_offer_modules m ON m.id = b.module_id
    JOIN public.pretty_offer_module_block_items bi ON bi.block_id = b.id
    WHERE m.offer_id = p_offer_id
      AND b.block_type = 'column_layout'
  LOOP
    IF v_col.detail IS NULL OR v_col.detail = '' THEN
      CONTINUE;
    END IF;

    BEGIN
      FOR v_nested_block IN
        SELECT value
        FROM jsonb_array_elements(
          COALESCE((v_col.detail::jsonb)->'blocks', '[]'::jsonb)
        )
      LOOP
        IF v_nested_block->>'block_type' <> 'options' THEN
          CONTINUE;
        END IF;

        FOR v_nested_group IN
          SELECT value
          FROM jsonb_array_elements(
            COALESCE(v_nested_block->'items', '[]'::jsonb)
          )
        LOOP
          IF v_nested_group->>'detail' IS NULL OR v_nested_group->>'detail' = '' THEN
            CONTINUE;
          END IF;

          FOR v_opt IN
            SELECT value
            FROM jsonb_array_elements(
              COALESCE((v_nested_group->>'detail')::jsonb->'options', '[]'::jsonb)
            )
          LOOP
            option_id := v_opt->>'id';
            IF option_id IS NULL OR option_id = '' THEN
              CONTINUE;
            END IF;
            block_id := NULLIF(v_nested_block->>'id', '')::uuid;
            module_id := v_col.module_id;
            label := COALESCE(v_opt->>'label', '');
            price := COALESCE(NULLIF(v_opt->>'price', '')::numeric, 0);
            RETURN NEXT;
          END LOOP;
        END LOOP;
      END LOOP;
    EXCEPTION
      WHEN OTHERS THEN
        CONTINUE;
    END;
  END LOOP;
END;
$$;

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

  v_adjusted_before_discount := COALESCE(v_offer.total_before_discount, 0) + v_options_subtotal;
  v_discount_amount := v_adjusted_before_discount * COALESCE(v_offer.discount_percent, 0) / 100;
  v_after_discount := v_adjusted_before_discount - v_discount_amount;
  v_with_vat := v_after_discount * (1 + COALESCE(v_offer.vat_percent, 25) / 100);

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
