-- Phase C: Index group_items(child_group_id) for kit lineage ancestor walks.
-- Unique index group_items_unique_group leads with (group_id, child_group_id),
-- so parent lookups WHERE child_group_id = ANY(...) cannot use it efficiently.

CREATE INDEX IF NOT EXISTS group_items_child_group_id_idx
  ON public.group_items (child_group_id)
  WHERE child_group_id IS NOT NULL;
