-- Migration: Change default_crew_billing_unit from day to hour
-- Created: 2026-03-08
--
-- System-wide default for crew bookings and invoicing is now hourly rates, not daily.

-- Update existing company_expansions to hourly
UPDATE company_expansions
SET default_crew_billing_unit = 'hour'
WHERE default_crew_billing_unit = 'day';

-- Update existing crew_pricing_levels to hourly
UPDATE crew_pricing_levels
SET default_crew_billing_unit = 'hour'
WHERE default_crew_billing_unit = 'day';

-- Change column default for new rows
ALTER TABLE company_expansions
  ALTER COLUMN default_crew_billing_unit SET DEFAULT 'hour';

ALTER TABLE crew_pricing_levels
  ALTER COLUMN default_crew_billing_unit SET DEFAULT 'hour';
