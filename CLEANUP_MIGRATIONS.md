# Migration Cleanup Guide

## Problem

Your local migration files don't match what's actually applied in the remote database, causing conflicts when trying to push migrations.

## Solution

### Step 1: Mark Applied Migrations

Run this SQL in your Supabase Dashboard SQL Editor:

```sql
-- Mark migrations that are already applied but missing from history
INSERT INTO supabase_migrations.schema_migrations (version, statements, name)
VALUES
  ('20250105000000', ARRAY[]::text[], 'add_offers_system'),
  ('20250106000000', ARRAY[]::text[], 'add_theme_properties'),
  ('20250107000000', ARRAY[]::text[], 'add_terms_and_conditions'),
  ('20250107010000', ARRAY[]::text[], 'create_company_files_bucket'),
  ('20250108000000', ARRAY[]::text[], 'add_show_price_per_line_to_offers'),
  ('20250109000000', ARRAY[]::text[], 'add_logo_paths'),
  ('20250110000000', ARRAY[]::text[], 'add_vehicle_categories'),
  ('20250111000000', ARRAY[]::text[], 'add_offer_rejection_and_revision'),
  ('20250112000000', ARRAY[]::text[], 'add_vehicle_rates_fields'),
  ('20250113000000', ARRAY[]::text[], 'remove_transport_rate_fields'),
  ('20250114000000', ARRAY[]::text[], 'add_activity_notifications'),
  ('20251202000000', ARRAY[]::text[], 'handle_offer_acceptance_followup')
ON CONFLICT (version) DO NOTHING;
```

### Step 2: Apply the Conta API Key Migration

If you haven't already, run the migration SQL from `20250115000000_fix_conta_api_key_permissions.sql` in the SQL Editor, then mark it as applied:

```sql
INSERT INTO supabase_migrations.schema_migrations (version, statements, name)
VALUES ('20250115000000', ARRAY[]::text[], 'fix_conta_api_key_permissions')
ON CONFLICT (version) DO NOTHING;
```

### Step 3: Verify

Run this to check your migration status:

```bash
npx supabase migration list --linked
```

All migrations should now show as synced (both Local and Remote columns filled).

### Step 4: Future Migrations

Going forward, you can push new migrations with:

```bash
npm run db:push
```

## What Was Fixed

- ✅ Removed duplicate `20250105000000_add_offers_system.sql` (20251201000000 is the actual one)
- ✅ Created cleanup script to mark applied migrations
- ✅ Migration history should now be in sync
