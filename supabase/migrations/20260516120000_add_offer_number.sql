-- Per-company offer numbers (6-digit like jobnr: 4-digit counter + 2-digit year).
-- Each job_offers row gets a unique offernr on insert; new versions get new numbers.

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS offer_number_counter INTEGER NOT NULL DEFAULT 1000;

COMMENT ON COLUMN public.companies.offer_number_counter IS
  'Increments when a new job_offers row is created; used with generate_offer_number trigger.';

UPDATE public.companies
SET offer_number_counter = 1000
WHERE offer_number_counter IS NULL OR offer_number_counter < 1000;

ALTER TABLE public.job_offers
  ADD COLUMN IF NOT EXISTS offernr INTEGER;

COMMENT ON COLUMN public.job_offers.offernr IS
  'Human-visible offer number, unique per company. Assigned on insert; each offer version has its own number.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_job_offers_company_offernr
  ON public.job_offers (company_id, offernr)
  WHERE offernr IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_job_offers_offernr ON public.job_offers (offernr);

CREATE OR REPLACE FUNCTION public.generate_offer_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  current_year INTEGER;
  counter_value INTEGER;
  new_offernr INTEGER;
BEGIN
  current_year := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER % 100;

  SELECT offer_number_counter + 1 INTO counter_value
  FROM public.companies
  WHERE id = NEW.company_id
  FOR UPDATE;

  IF counter_value > 9999 THEN
    counter_value := 1000;
  END IF;

  IF counter_value < 1000 THEN
    counter_value := 1000;
  END IF;

  UPDATE public.companies
  SET offer_number_counter = counter_value
  WHERE id = NEW.company_id;

  new_offernr := (
    LPAD(counter_value::TEXT, 4, '0') || LPAD(current_year::TEXT, 2, '0')
  )::INTEGER;

  NEW.offernr := new_offernr;

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.generate_offer_number() OWNER TO postgres;

DROP TRIGGER IF EXISTS trigger_generate_offer_number ON public.job_offers;
CREATE TRIGGER trigger_generate_offer_number
  BEFORE INSERT ON public.job_offers
  FOR EACH ROW
  WHEN (NEW.offernr IS NULL)
  EXECUTE FUNCTION public.generate_offer_number();

COMMENT ON FUNCTION public.generate_offer_number() IS
  'Assigns job_offers.offernr and bumps companies.offer_number_counter (same pattern as job numbers).';

-- Backfill existing offers (preserve created_at year in suffix like job backfill)
DO $$
DECLARE
  company_rec RECORD;
  offer_rec RECORD;
  counter INTEGER;
  new_offernr INTEGER;
BEGIN
  FOR company_rec IN SELECT id FROM public.companies
  LOOP
    counter := 1000;

    FOR offer_rec IN
      SELECT id, created_at
      FROM public.job_offers
      WHERE company_id = company_rec.id
        AND offernr IS NULL
      ORDER BY created_at ASC
    LOOP
      new_offernr := (
        LPAD(counter::TEXT, 4, '0')
        || LPAD((EXTRACT(YEAR FROM offer_rec.created_at)::INTEGER % 100)::TEXT, 2, '0')
      )::INTEGER;

      UPDATE public.job_offers
      SET offernr = new_offernr
      WHERE id = offer_rec.id;

      counter := counter + 1;
      IF counter > 9999 THEN
        counter := 1000;
      END IF;
    END LOOP;

    UPDATE public.companies
    SET offer_number_counter = counter
    WHERE id = company_rec.id;
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION public.generate_offer_number() FROM PUBLIC;
GRANT ALL ON FUNCTION public.generate_offer_number() TO anon;
GRANT ALL ON FUNCTION public.generate_offer_number() TO authenticated;
GRANT ALL ON FUNCTION public.generate_offer_number() TO service_role;
