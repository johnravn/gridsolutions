-- Fix offer RLS after advisor consolidation:
-- 1) Company members lost SELECT on draft offer line tables (only public non-draft SELECT remained).
--    UPDATE/DELETE also need SELECT visibility, so basis save/copy broke.
-- 2) Global superusers can pick any company in the UI but offer policies only checked company_users.

-- ---------------------------------------------------------------------------
-- Helpers (inlined): company member OR global superuser
-- ---------------------------------------------------------------------------

-- job_offers
DROP POLICY IF EXISTS "Company members can manage their company's offers"
  ON public.job_offers;
CREATE POLICY "Company members can manage their company's offers"
  ON public.job_offers
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (
    company_id IN (
      SELECT cu.company_id
      FROM public.company_users cu
      WHERE cu.user_id = (SELECT auth.uid())
    )
    OR public.is_superuser((SELECT auth.uid()))
  )
  WITH CHECK (
    company_id IN (
      SELECT cu.company_id
      FROM public.company_users cu
      WHERE cu.user_id = (SELECT auth.uid())
    )
    OR public.is_superuser((SELECT auth.uid()))
  );

-- offer_bases
DROP POLICY IF EXISTS "Company members can manage their company's offer bases"
  ON public.offer_bases;
CREATE POLICY "Company members can manage their company's offer bases"
  ON public.offer_bases
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (
    company_id IN (
      SELECT cu.company_id
      FROM public.company_users cu
      WHERE cu.user_id = (SELECT auth.uid())
    )
    OR public.is_superuser((SELECT auth.uid()))
  )
  WITH CHECK (
    company_id IN (
      SELECT cu.company_id
      FROM public.company_users cu
      WHERE cu.user_id = (SELECT auth.uid())
    )
    OR public.is_superuser((SELECT auth.uid()))
  );

-- offer_pretty_sections
DROP POLICY IF EXISTS "Company members can manage their company's pretty sections"
  ON public.offer_pretty_sections;
CREATE POLICY "Company members can manage their company's pretty sections"
  ON public.offer_pretty_sections
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (
    offer_id IN (
      SELECT o.id
      FROM public.job_offers o
      JOIN public.company_users cu ON cu.company_id = o.company_id
      WHERE cu.user_id = (SELECT auth.uid())
    )
    OR public.is_superuser((SELECT auth.uid()))
  )
  WITH CHECK (
    offer_id IN (
      SELECT o.id
      FROM public.job_offers o
      JOIN public.company_users cu ON cu.company_id = o.company_id
      WHERE cu.user_id = (SELECT auth.uid())
    )
    OR public.is_superuser((SELECT auth.uid()))
  );

-- offer_transport_groups
DROP POLICY IF EXISTS "Company members can manage their company's transport groups"
  ON public.offer_transport_groups;
CREATE POLICY "Company members can manage their company's transport groups"
  ON public.offer_transport_groups
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (
    offer_basis_id IN (
      SELECT ob.id
      FROM public.offer_bases ob
      JOIN public.company_users cu ON cu.company_id = ob.company_id
      WHERE cu.user_id = (SELECT auth.uid())
    )
    OR public.is_superuser((SELECT auth.uid()))
  )
  WITH CHECK (
    offer_basis_id IN (
      SELECT ob.id
      FROM public.offer_bases ob
      JOIN public.company_users cu ON cu.company_id = ob.company_id
      WHERE cu.user_id = (SELECT auth.uid())
    )
    OR public.is_superuser((SELECT auth.uid()))
  );

-- ---------------------------------------------------------------------------
-- offer_crew_items: restore SELECT + superuser on writes
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Company members can view offer_crew_items" ON public.offer_crew_items;
CREATE POLICY "Company members can view offer_crew_items"
  ON public.offer_crew_items
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (
    offer_basis_id IN (
      SELECT ob.id
      FROM public.offer_bases ob
      JOIN public.company_users cu ON cu.company_id = ob.company_id
      WHERE cu.user_id = (SELECT auth.uid())
    )
    OR public.is_superuser((SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "Company members can insert offer_crew_items" ON public.offer_crew_items;
CREATE POLICY "Company members can insert offer_crew_items"
  ON public.offer_crew_items
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (
    offer_basis_id IN (
      SELECT ob.id
      FROM public.offer_bases ob
      JOIN public.company_users cu ON cu.company_id = ob.company_id
      WHERE cu.user_id = (SELECT auth.uid())
    )
    OR public.is_superuser((SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "Company members can update offer_crew_items" ON public.offer_crew_items;
CREATE POLICY "Company members can update offer_crew_items"
  ON public.offer_crew_items
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (
    offer_basis_id IN (
      SELECT ob.id
      FROM public.offer_bases ob
      JOIN public.company_users cu ON cu.company_id = ob.company_id
      WHERE cu.user_id = (SELECT auth.uid())
    )
    OR public.is_superuser((SELECT auth.uid()))
  )
  WITH CHECK (
    offer_basis_id IN (
      SELECT ob.id
      FROM public.offer_bases ob
      JOIN public.company_users cu ON cu.company_id = ob.company_id
      WHERE cu.user_id = (SELECT auth.uid())
    )
    OR public.is_superuser((SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "Company members can delete offer_crew_items" ON public.offer_crew_items;
CREATE POLICY "Company members can delete offer_crew_items"
  ON public.offer_crew_items
  AS PERMISSIVE
  FOR DELETE
  TO authenticated
  USING (
    offer_basis_id IN (
      SELECT ob.id
      FROM public.offer_bases ob
      JOIN public.company_users cu ON cu.company_id = ob.company_id
      WHERE cu.user_id = (SELECT auth.uid())
    )
    OR public.is_superuser((SELECT auth.uid()))
  );

-- ---------------------------------------------------------------------------
-- offer_equipment_groups
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Company members can view offer_equipment_groups"
  ON public.offer_equipment_groups;
CREATE POLICY "Company members can view offer_equipment_groups"
  ON public.offer_equipment_groups
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (
    offer_basis_id IN (
      SELECT ob.id
      FROM public.offer_bases ob
      JOIN public.company_users cu ON cu.company_id = ob.company_id
      WHERE cu.user_id = (SELECT auth.uid())
    )
    OR public.is_superuser((SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "Company members can insert offer_equipment_groups"
  ON public.offer_equipment_groups;
CREATE POLICY "Company members can insert offer_equipment_groups"
  ON public.offer_equipment_groups
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (
    offer_basis_id IN (
      SELECT ob.id
      FROM public.offer_bases ob
      JOIN public.company_users cu ON cu.company_id = ob.company_id
      WHERE cu.user_id = (SELECT auth.uid())
    )
    OR public.is_superuser((SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "Company members can update offer_equipment_groups"
  ON public.offer_equipment_groups;
CREATE POLICY "Company members can update offer_equipment_groups"
  ON public.offer_equipment_groups
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (
    offer_basis_id IN (
      SELECT ob.id
      FROM public.offer_bases ob
      JOIN public.company_users cu ON cu.company_id = ob.company_id
      WHERE cu.user_id = (SELECT auth.uid())
    )
    OR public.is_superuser((SELECT auth.uid()))
  )
  WITH CHECK (
    offer_basis_id IN (
      SELECT ob.id
      FROM public.offer_bases ob
      JOIN public.company_users cu ON cu.company_id = ob.company_id
      WHERE cu.user_id = (SELECT auth.uid())
    )
    OR public.is_superuser((SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "Company members can delete offer_equipment_groups"
  ON public.offer_equipment_groups;
CREATE POLICY "Company members can delete offer_equipment_groups"
  ON public.offer_equipment_groups
  AS PERMISSIVE
  FOR DELETE
  TO authenticated
  USING (
    offer_basis_id IN (
      SELECT ob.id
      FROM public.offer_bases ob
      JOIN public.company_users cu ON cu.company_id = ob.company_id
      WHERE cu.user_id = (SELECT auth.uid())
    )
    OR public.is_superuser((SELECT auth.uid()))
  );

-- ---------------------------------------------------------------------------
-- offer_equipment_items
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Company members can view offer_equipment_items"
  ON public.offer_equipment_items;
CREATE POLICY "Company members can view offer_equipment_items"
  ON public.offer_equipment_items
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (
    offer_group_id IN (
      SELECT og.id
      FROM public.offer_equipment_groups og
      JOIN public.offer_bases ob ON ob.id = og.offer_basis_id
      JOIN public.company_users cu ON cu.company_id = ob.company_id
      WHERE cu.user_id = (SELECT auth.uid())
    )
    OR public.is_superuser((SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "Company members can insert offer_equipment_items"
  ON public.offer_equipment_items;
CREATE POLICY "Company members can insert offer_equipment_items"
  ON public.offer_equipment_items
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (
    offer_group_id IN (
      SELECT og.id
      FROM public.offer_equipment_groups og
      JOIN public.offer_bases ob ON ob.id = og.offer_basis_id
      JOIN public.company_users cu ON cu.company_id = ob.company_id
      WHERE cu.user_id = (SELECT auth.uid())
    )
    OR public.is_superuser((SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "Company members can update offer_equipment_items"
  ON public.offer_equipment_items;
CREATE POLICY "Company members can update offer_equipment_items"
  ON public.offer_equipment_items
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (
    offer_group_id IN (
      SELECT og.id
      FROM public.offer_equipment_groups og
      JOIN public.offer_bases ob ON ob.id = og.offer_basis_id
      JOIN public.company_users cu ON cu.company_id = ob.company_id
      WHERE cu.user_id = (SELECT auth.uid())
    )
    OR public.is_superuser((SELECT auth.uid()))
  )
  WITH CHECK (
    offer_group_id IN (
      SELECT og.id
      FROM public.offer_equipment_groups og
      JOIN public.offer_bases ob ON ob.id = og.offer_basis_id
      JOIN public.company_users cu ON cu.company_id = ob.company_id
      WHERE cu.user_id = (SELECT auth.uid())
    )
    OR public.is_superuser((SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "Company members can delete offer_equipment_items"
  ON public.offer_equipment_items;
CREATE POLICY "Company members can delete offer_equipment_items"
  ON public.offer_equipment_items
  AS PERMISSIVE
  FOR DELETE
  TO authenticated
  USING (
    offer_group_id IN (
      SELECT og.id
      FROM public.offer_equipment_groups og
      JOIN public.offer_bases ob ON ob.id = og.offer_basis_id
      JOIN public.company_users cu ON cu.company_id = ob.company_id
      WHERE cu.user_id = (SELECT auth.uid())
    )
    OR public.is_superuser((SELECT auth.uid()))
  );

-- ---------------------------------------------------------------------------
-- offer_transport_items
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Company members can view offer_transport_items"
  ON public.offer_transport_items;
CREATE POLICY "Company members can view offer_transport_items"
  ON public.offer_transport_items
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (
    offer_basis_id IN (
      SELECT ob.id
      FROM public.offer_bases ob
      JOIN public.company_users cu ON cu.company_id = ob.company_id
      WHERE cu.user_id = (SELECT auth.uid())
    )
    OR public.is_superuser((SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "Company members can insert offer_transport_items"
  ON public.offer_transport_items;
CREATE POLICY "Company members can insert offer_transport_items"
  ON public.offer_transport_items
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (
    offer_basis_id IN (
      SELECT ob.id
      FROM public.offer_bases ob
      JOIN public.company_users cu ON cu.company_id = ob.company_id
      WHERE cu.user_id = (SELECT auth.uid())
    )
    OR public.is_superuser((SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "Company members can update offer_transport_items"
  ON public.offer_transport_items;
CREATE POLICY "Company members can update offer_transport_items"
  ON public.offer_transport_items
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (
    offer_basis_id IN (
      SELECT ob.id
      FROM public.offer_bases ob
      JOIN public.company_users cu ON cu.company_id = ob.company_id
      WHERE cu.user_id = (SELECT auth.uid())
    )
    OR public.is_superuser((SELECT auth.uid()))
  )
  WITH CHECK (
    offer_basis_id IN (
      SELECT ob.id
      FROM public.offer_bases ob
      JOIN public.company_users cu ON cu.company_id = ob.company_id
      WHERE cu.user_id = (SELECT auth.uid())
    )
    OR public.is_superuser((SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "Company members can delete offer_transport_items"
  ON public.offer_transport_items;
CREATE POLICY "Company members can delete offer_transport_items"
  ON public.offer_transport_items
  AS PERMISSIVE
  FOR DELETE
  TO authenticated
  USING (
    offer_basis_id IN (
      SELECT ob.id
      FROM public.offer_bases ob
      JOIN public.company_users cu ON cu.company_id = ob.company_id
      WHERE cu.user_id = (SELECT auth.uid())
    )
    OR public.is_superuser((SELECT auth.uid()))
  );

-- ---------------------------------------------------------------------------
-- pretty_offer_* ALL policies: add superuser bypass
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Company members can manage pretty offer modules"
  ON public.pretty_offer_modules;
CREATE POLICY "Company members can manage pretty offer modules"
  ON public.pretty_offer_modules
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (
    offer_id IN (
      SELECT o.id
      FROM public.job_offers o
      JOIN public.company_users cu ON cu.company_id = o.company_id
      WHERE cu.user_id = (SELECT auth.uid())
    )
    OR public.is_superuser((SELECT auth.uid()))
  )
  WITH CHECK (
    offer_id IN (
      SELECT o.id
      FROM public.job_offers o
      JOIN public.company_users cu ON cu.company_id = o.company_id
      WHERE cu.user_id = (SELECT auth.uid())
    )
    OR public.is_superuser((SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "Company members can manage pretty offer module blocks"
  ON public.pretty_offer_module_blocks;
CREATE POLICY "Company members can manage pretty offer module blocks"
  ON public.pretty_offer_module_blocks
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (
    module_id IN (
      SELECT m.id
      FROM public.pretty_offer_modules m
      JOIN public.job_offers o ON o.id = m.offer_id
      JOIN public.company_users cu ON cu.company_id = o.company_id
      WHERE cu.user_id = (SELECT auth.uid())
    )
    OR public.is_superuser((SELECT auth.uid()))
  )
  WITH CHECK (
    module_id IN (
      SELECT m.id
      FROM public.pretty_offer_modules m
      JOIN public.job_offers o ON o.id = m.offer_id
      JOIN public.company_users cu ON cu.company_id = o.company_id
      WHERE cu.user_id = (SELECT auth.uid())
    )
    OR public.is_superuser((SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "Company members can manage pretty offer module block items"
  ON public.pretty_offer_module_block_items;
CREATE POLICY "Company members can manage pretty offer module block items"
  ON public.pretty_offer_module_block_items
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (
    block_id IN (
      SELECT b.id
      FROM public.pretty_offer_module_blocks b
      JOIN public.pretty_offer_modules m ON m.id = b.module_id
      JOIN public.job_offers o ON o.id = m.offer_id
      JOIN public.company_users cu ON cu.company_id = o.company_id
      WHERE cu.user_id = (SELECT auth.uid())
    )
    OR public.is_superuser((SELECT auth.uid()))
  )
  WITH CHECK (
    block_id IN (
      SELECT b.id
      FROM public.pretty_offer_module_blocks b
      JOIN public.pretty_offer_modules m ON m.id = b.module_id
      JOIN public.job_offers o ON o.id = m.offer_id
      JOIN public.company_users cu ON cu.company_id = o.company_id
      WHERE cu.user_id = (SELECT auth.uid())
    )
    OR public.is_superuser((SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "Company members can manage pretty offer module media"
  ON public.pretty_offer_module_media;
CREATE POLICY "Company members can manage pretty offer module media"
  ON public.pretty_offer_module_media
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (
    module_id IN (
      SELECT m.id
      FROM public.pretty_offer_modules m
      JOIN public.job_offers o ON o.id = m.offer_id
      JOIN public.company_users cu ON cu.company_id = o.company_id
      WHERE cu.user_id = (SELECT auth.uid())
    )
    OR public.is_superuser((SELECT auth.uid()))
  )
  WITH CHECK (
    module_id IN (
      SELECT m.id
      FROM public.pretty_offer_modules m
      JOIN public.job_offers o ON o.id = m.offer_id
      JOIN public.company_users cu ON cu.company_id = o.company_id
      WHERE cu.user_id = (SELECT auth.uid())
    )
    OR public.is_superuser((SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "Company members can manage pretty offer module timeline items"
  ON public.pretty_offer_module_timeline_items;
CREATE POLICY "Company members can manage pretty offer module timeline items"
  ON public.pretty_offer_module_timeline_items
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (
    module_id IN (
      SELECT m.id
      FROM public.pretty_offer_modules m
      JOIN public.job_offers o ON o.id = m.offer_id
      JOIN public.company_users cu ON cu.company_id = o.company_id
      WHERE cu.user_id = (SELECT auth.uid())
    )
    OR public.is_superuser((SELECT auth.uid()))
  )
  WITH CHECK (
    module_id IN (
      SELECT m.id
      FROM public.pretty_offer_modules m
      JOIN public.job_offers o ON o.id = m.offer_id
      JOIN public.company_users cu ON cu.company_id = o.company_id
      WHERE cu.user_id = (SELECT auth.uid())
    )
    OR public.is_superuser((SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "Company members can manage pretty offer pricing bases"
  ON public.pretty_offer_pricing_bases;
CREATE POLICY "Company members can manage pretty offer pricing bases"
  ON public.pretty_offer_pricing_bases
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (
    offer_id IN (
      SELECT o.id
      FROM public.job_offers o
      JOIN public.company_users cu ON cu.company_id = o.company_id
      WHERE cu.user_id = (SELECT auth.uid())
    )
    OR public.is_superuser((SELECT auth.uid()))
  )
  WITH CHECK (
    offer_id IN (
      SELECT o.id
      FROM public.job_offers o
      JOIN public.company_users cu ON cu.company_id = o.company_id
      WHERE cu.user_id = (SELECT auth.uid())
    )
    OR public.is_superuser((SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "Company members can manage pretty offer pricing basis splits"
  ON public.pretty_offer_pricing_basis_splits;
CREATE POLICY "Company members can manage pretty offer pricing basis splits"
  ON public.pretty_offer_pricing_basis_splits
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (
    basis_id IN (
      SELECT pb.id
      FROM public.pretty_offer_pricing_bases pb
      JOIN public.job_offers o ON o.id = pb.offer_id
      JOIN public.company_users cu ON cu.company_id = o.company_id
      WHERE cu.user_id = (SELECT auth.uid())
    )
    OR public.is_superuser((SELECT auth.uid()))
  )
  WITH CHECK (
    basis_id IN (
      SELECT pb.id
      FROM public.pretty_offer_pricing_bases pb
      JOIN public.job_offers o ON o.id = pb.offer_id
      JOIN public.company_users cu ON cu.company_id = o.company_id
      WHERE cu.user_id = (SELECT auth.uid())
    )
    OR public.is_superuser((SELECT auth.uid()))
  );
