-- Migration: Add default_crew_billing_unit to company_expansions and crew_pricing_levels
-- Created: 2026-03-08
--
-- Allows each pricing level to specify whether the default customer billing for crew is per day or per hour.
-- Used as default in Technical Offer Editor when adding crew items and in Invoice Tab when invoicing from bookings.

-- Add to company_expansions (Standard level)
ALTER TABLE company_expansions
  ADD COLUMN IF NOT EXISTS default_crew_billing_unit TEXT NOT NULL DEFAULT 'day'
    CHECK (default_crew_billing_unit IN ('day', 'hour'));

COMMENT ON COLUMN company_expansions.default_crew_billing_unit IS 'Default billing unit for crew (Standard level): day or hour';

-- Add to crew_pricing_levels (each additional level)
ALTER TABLE crew_pricing_levels
  ADD COLUMN IF NOT EXISTS default_crew_billing_unit TEXT NOT NULL DEFAULT 'day'
    CHECK (default_crew_billing_unit IN ('day', 'hour'));

COMMENT ON COLUMN crew_pricing_levels.default_crew_billing_unit IS 'Default billing unit for crew at this pricing level: day or hour';
