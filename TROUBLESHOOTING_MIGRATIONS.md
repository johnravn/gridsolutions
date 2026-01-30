# Troubleshooting Migration CLI Freeze

## Problem

The `npx supabase migration list --linked` command freezes after "Initialising login role..."

## Solutions

### Option 1: Check Migrations Directly via SQL (Recommended)

Since the CLI is freezing, you can check migrations directly in the Supabase Dashboard:

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Run this query:

```sql
-- View all applied migrations
SELECT
  version,
  name,
  inserted_at
FROM supabase_migrations.schema_migrations
ORDER BY version ASC;
```

This will show you exactly which migrations are applied in your database.

### Option 2: Update Supabase CLI

The CLI version (2.54.11) is outdated. Try updating:

```bash
# Update locally in the project
npm install supabase@latest --save-dev

# Or use npx which will use the latest version
npx supabase@latest migration list --linked
```

### Option 3: Re-authenticate

The freeze might be due to authentication issues:

```bash
# Log out and log back in
npx supabase logout
npx supabase login
```

### Option 4: Check Project Link

Verify your project is properly linked:

```bash
# Check if project is linked
cat .supabase/config.toml | grep project_id

# Re-link if needed
npx supabase link --project-ref YOUR_PROJECT_REF
```

## Quick Fix: Just Run the Cleanup SQL

Since you don't need the CLI to fix the migration history, you can:

1. **Run the cleanup SQL** from `supabase/migrations/cleanup_migration_history.sql` in the SQL Editor
2. **Apply the Conta API key migration** from `20250115000000_fix_conta_api_key_permissions.sql` if you haven't already
3. **Verify** by running the check query above

The CLI freeze doesn't prevent you from fixing the migrations - you can do everything via SQL!
