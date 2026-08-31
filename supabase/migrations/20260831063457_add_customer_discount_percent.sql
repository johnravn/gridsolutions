-- Per-customer default discount % for new offer bases.
-- NULL means "use company customer/partner default" (existing customers RLS covers this column).

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS discount_percent NUMERIC(5, 2);

ALTER TABLE public.customers
  DROP CONSTRAINT IF EXISTS customers_discount_percent_check;

ALTER TABLE public.customers
  ADD CONSTRAINT customers_discount_percent_check CHECK (
    discount_percent IS NULL
    OR (discount_percent >= 0 AND discount_percent <= 100)
  );

COMMENT ON COLUMN public.customers.discount_percent IS
  'Customer-specific default discount % for new offer bases. NULL = use company customer/partner default.';
