-- Add custom line description for one-off equipment lines in offers.
-- When item_id and group_id are both null, this text is shown as the line description.
ALTER TABLE public.offer_equipment_items
  ADD COLUMN IF NOT EXISTS custom_line_description TEXT;

COMMENT ON COLUMN public.offer_equipment_items.custom_line_description IS
  'Free-text description for custom/one-off lines when item_id and group_id are null.';
