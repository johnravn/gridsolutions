-- PostgREST cannot pick between the 4-arg and 5-arg public_offer_accept
-- overloads when callers omit p_selected_option_ids (PGRST203). Keep only
-- the 5-arg version; its jsonb argument already defaults to [].

DROP FUNCTION IF EXISTS public.public_offer_accept(text, text, text, text);

NOTIFY pgrst, 'reload schema';
