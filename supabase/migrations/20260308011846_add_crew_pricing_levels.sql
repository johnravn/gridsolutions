-- Migration: Add crew_pricing_levels table and crew_pricing_level_id to customers
-- Created: 2026-03-08
--
-- Allows customer-specific crew pricing levels. Standard rate stays on company_expansions.
-- Additional levels (e.g. "Premium", "Discounted") stored here. Customers can be
-- assigned to a level; null = standard rate.

-- Create crew_pricing_levels table
CREATE TABLE IF NOT EXISTS crew_pricing_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  crew_rate_per_day NUMERIC(10, 2),
  crew_rate_per_hour NUMERIC(10, 2),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crew_pricing_levels_company_id ON crew_pricing_levels(company_id);

COMMENT ON TABLE crew_pricing_levels IS 'Additional crew pricing levels for customers beyond the standard rate';
COMMENT ON COLUMN crew_pricing_levels.name IS 'Display name e.g. Premium, Partner discount';
COMMENT ON COLUMN crew_pricing_levels.crew_rate_per_day IS 'Daily rate for this level';
COMMENT ON COLUMN crew_pricing_levels.crew_rate_per_hour IS 'Hourly rate for this level';

-- Add crew_pricing_level_id to customers
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS crew_pricing_level_id UUID REFERENCES crew_pricing_levels(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_customers_crew_pricing_level_id ON customers(crew_pricing_level_id);

COMMENT ON COLUMN customers.crew_pricing_level_id IS 'Pricing level for crew rates; null = standard rate from company_expansions';

-- RLS for crew_pricing_levels
ALTER TABLE crew_pricing_levels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view crew_pricing_levels for their companies" ON crew_pricing_levels;
CREATE POLICY "Users can view crew_pricing_levels for their companies"
  ON crew_pricing_levels
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM company_users
      WHERE company_users.company_id = crew_pricing_levels.company_id
        AND company_users.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

DROP POLICY IF EXISTS "Users can create crew_pricing_levels for their companies" ON crew_pricing_levels;
CREATE POLICY "Users can create crew_pricing_levels for their companies"
  ON crew_pricing_levels
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_users
      WHERE company_users.company_id = crew_pricing_levels.company_id
        AND company_users.user_id = auth.uid()
        AND company_users.role IN ('owner', 'super_user', 'employee')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

DROP POLICY IF EXISTS "Users can update crew_pricing_levels for their companies" ON crew_pricing_levels;
CREATE POLICY "Users can update crew_pricing_levels for their companies"
  ON crew_pricing_levels
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM company_users
      WHERE company_users.company_id = crew_pricing_levels.company_id
        AND company_users.user_id = auth.uid()
        AND company_users.role IN ('owner', 'super_user', 'employee')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_users
      WHERE company_users.company_id = crew_pricing_levels.company_id
        AND company_users.user_id = auth.uid()
        AND company_users.role IN ('owner', 'super_user', 'employee')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );

DROP POLICY IF EXISTS "Users can delete crew_pricing_levels for their companies" ON crew_pricing_levels;
CREATE POLICY "Users can delete crew_pricing_levels for their companies"
  ON crew_pricing_levels
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM company_users
      WHERE company_users.company_id = crew_pricing_levels.company_id
        AND company_users.user_id = auth.uid()
        AND company_users.role IN ('owner', 'super_user', 'employee')
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );
