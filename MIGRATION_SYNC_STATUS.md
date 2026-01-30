# Migration Sync Status

## Current Status

### Local Migration Files (17 total):

1. ✅ 20250102000000 - add_job_status_changed_activity_type
2. ✅ 20250103000000 - enable_fuzzy_search
3. ✅ 20250104000000 - add_job_number_system
4. ✅ 20250106000000 - add_theme_properties
5. ✅ 20250107000000 - add_terms_and_conditions
6. ✅ 20250107010000 - create_company_files_bucket
7. ✅ 20250108000000 - add_show_price_per_line_to_offers
8. ✅ 20250109000000 - add_logo_paths
9. ✅ 20250110000000 - add_vehicle_categories
10. ✅ 20250111000000 - add_offer_rejection_and_revision
11. ✅ 20250112000000 - add_vehicle_rates_fields
12. ✅ 20250113000000 - remove_transport_rate_fields
13. ✅ 20250114000000 - add_activity_notifications
14. ❌ **20250115000000 - fix_conta_api_key_permissions** (NOT in remote - needs to be applied)
15. ✅ 20251103130000 - add_accounting_organization_id
16. ✅ 20251201000000 - add_offers_system
17. ✅ 20251202000000 - handle_offer_acceptance_followup

### Remote Database Migrations (17 total):

All the above EXCEPT:

- ❌ Missing: 20250115000000 (needs to be applied)
- ⚠️ Extra: 20250105000000 (duplicate of 20251201000000, already deleted locally)

## How to Verify Sync

### Option 1: Run SQL Query (Recommended)

Run `verify_migrations_sync.sql` in Supabase SQL Editor to get a detailed comparison.

### Option 2: Use CLI (if working)

```bash
npx supabase migration list --linked
```

### Option 3: Manual Check

1. Run this in SQL Editor:

```sql
SELECT version, name
FROM supabase_migrations.schema_migrations
ORDER BY version;
```

2. Compare with local files:

```bash
find supabase/migrations -name "*.sql" | grep -E '[0-9]{14}' | sort
```

## To Complete Sync

1. **Apply the Conta migration:**
   - Run `20250115000000_fix_conta_api_key_permissions.sql` in SQL Editor
   - Then mark it as applied:

   ```sql
   INSERT INTO supabase_migrations.schema_migrations (version, statements, name)
   VALUES ('20250115000000', ARRAY[]::text[], 'fix_conta_api_key_permissions')
   ON CONFLICT (version) DO NOTHING;
   ```

2. **Optional: Remove duplicate from remote** (if you want to clean it up):
   ```sql
   DELETE FROM supabase_migrations.schema_migrations
   WHERE version = '20250105000000' AND name = 'add_offers_system';
   ```
   (Only do this if you're sure 20251201000000 has all the same changes)

## Expected Result After Sync

- ✅ All 17 local migrations should be in remote
- ✅ Remote should have 17 migrations (or 16 if you remove the duplicate)
- ✅ No missing migrations
- ✅ Migration history fully synced
