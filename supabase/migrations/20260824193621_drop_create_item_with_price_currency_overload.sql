-- PostgREST cannot pick between create_item_with_price overloads (PGRST203)
-- when nicknames / effective_from are omitted. Keep the nicknames signature.
DROP FUNCTION IF EXISTS public.create_item_with_price(
  uuid,
  text,
  uuid,
  uuid,
  text,
  boolean,
  numeric,
  boolean,
  text,
  numeric,
  text
);
