-- Allow public offer viewers to resolve item details.
-- This mirrors existing public offer access patterns for offer_* tables.

-- Items referenced in non-draft offers
DROP POLICY IF EXISTS "Public can view items from accessible offers" ON items;
CREATE POLICY "Public can view items from accessible offers"
  ON items
  FOR SELECT
  TO anon, authenticated
  USING (
    id IN (
      SELECT oei.item_id
      FROM offer_equipment_items oei
      JOIN offer_equipment_groups oeg ON oei.offer_group_id = oeg.id
      JOIN job_offers o ON oeg.offer_id = o.id
      WHERE o.status != 'draft'
        AND oei.item_id IS NOT NULL
    )
  );

-- Item groups referenced in non-draft offers
DROP POLICY IF EXISTS "Public can view item groups from accessible offers" ON item_groups;
CREATE POLICY "Public can view item groups from accessible offers"
  ON item_groups
  FOR SELECT
  TO anon, authenticated
  USING (
    id IN (
      SELECT oei.group_id
      FROM offer_equipment_items oei
      JOIN offer_equipment_groups oeg ON oei.offer_group_id = oeg.id
      JOIN job_offers o ON oeg.offer_id = o.id
      WHERE o.status != 'draft'
        AND oei.group_id IS NOT NULL
    )
  );

-- Item brands referenced by items in non-draft offers
DROP POLICY IF EXISTS "Public can view item brands from accessible offers" ON item_brands;
CREATE POLICY "Public can view item brands from accessible offers"
  ON item_brands
  FOR SELECT
  TO anon, authenticated
  USING (
    id IN (
      SELECT i.brand_id
      FROM items i
      JOIN offer_equipment_items oei ON oei.item_id = i.id
      JOIN offer_equipment_groups oeg ON oei.offer_group_id = oeg.id
      JOIN job_offers o ON oeg.offer_id = o.id
      WHERE o.status != 'draft'
        AND i.brand_id IS NOT NULL
    )
  );
