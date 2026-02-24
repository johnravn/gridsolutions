-- Raise calendar subscription limit from 3 to 10 per user per company.

CREATE OR REPLACE FUNCTION public.calendar_subscriptions_max_3_per_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n bigint;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT count(*) INTO n
    FROM public.calendar_subscriptions
    WHERE company_id = NEW.company_id AND user_id = NEW.user_id;
    IF n >= 10 THEN
      RAISE EXCEPTION 'At most 10 calendar subscriptions per user per company';
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.company_id = NEW.company_id AND OLD.user_id = NEW.user_id THEN
      RETURN NEW;
    END IF;
    SELECT count(*) INTO n
    FROM public.calendar_subscriptions
    WHERE company_id = NEW.company_id AND user_id = NEW.user_id
      AND id != OLD.id;
    IF n >= 9 THEN
      RAISE EXCEPTION 'At most 10 calendar subscriptions per user per company';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
