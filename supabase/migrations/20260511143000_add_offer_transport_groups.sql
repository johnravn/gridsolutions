-- Add transport groups for offers so transport items can be organized and ordered.
-- Backfills existing offers by creating a default "Transport" group and assigning items.

-- ============================================================================
-- 1) New groups table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.offer_transport_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id UUID NOT NULL REFERENCES public.job_offers(id) ON DELETE CASCADE,
  group_name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_offer_transport_groups_offer_id
  ON public.offer_transport_groups(offer_id);

ALTER TABLE public.offer_transport_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Company members can manage their company's transport groups"
  ON public.offer_transport_groups;
CREATE POLICY "Company members can manage their company's transport groups"
  ON public.offer_transport_groups
  FOR ALL
  USING (
    offer_id IN (
      SELECT o.id
      FROM public.job_offers o
      JOIN public.company_users cu ON o.company_id = cu.company_id
      WHERE cu.user_id = auth.uid()
    )
  );

COMMENT ON TABLE public.offer_transport_groups IS
  'Groups for organizing transport lines in offers (e.g., Start day vehicles, End day vehicles).';

-- ============================================================================
-- 2) Attach transport items to groups (nullable -> backfill -> enforce)
-- ============================================================================

ALTER TABLE public.offer_transport_items
  ADD COLUMN IF NOT EXISTS transport_group_id UUID;

-- Create a default group per offer (only where there are transport items and no group exists yet)
INSERT INTO public.offer_transport_groups (offer_id, group_name, sort_order)
SELECT DISTINCT ti.offer_id, 'Transport', 0
FROM public.offer_transport_items ti
LEFT JOIN public.offer_transport_groups tg ON tg.offer_id = ti.offer_id
WHERE tg.id IS NULL;

-- Assign existing transport items to their offer's default group when missing
UPDATE public.offer_transport_items ti
SET transport_group_id = tg.id
FROM public.offer_transport_groups tg
WHERE tg.offer_id = ti.offer_id
  AND tg.sort_order = 0
  AND tg.group_name = 'Transport'
  AND ti.transport_group_id IS NULL;

-- Enforce FK and non-null after backfill
ALTER TABLE public.offer_transport_items
  ALTER COLUMN transport_group_id SET NOT NULL;

DO $$ BEGIN
  ALTER TABLE public.offer_transport_items
    ADD CONSTRAINT fk_offer_transport_items_transport_group
    FOREIGN KEY (transport_group_id)
    REFERENCES public.offer_transport_groups(id)
    ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_offer_transport_items_transport_group_id
  ON public.offer_transport_items(transport_group_id);

