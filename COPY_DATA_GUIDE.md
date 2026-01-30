# Copy Remote Data to Local Database

## Quick Copy

```bash
# Make sure local Supabase is running
npm run supabase:start

# Copy all data from remote to local
npm run db:copy-data
```

## What It Does

1. **Dumps data** from your remote Supabase database (data only, no schema)
2. **Restores it** to your local database
3. **Preserves your local schema** (migrations stay intact)

## When to Use

- **Starting fresh:** Get real data for local testing
- **Refresh data:** Update local with latest remote data
- **Testing:** Test features with production-like data

## Important Notes

⚠️ **This overwrites local data** - any local test data will be replaced

✅ **Schema stays intact** - only data is copied, not table structure

🔄 **Run anytime** - Safe to run multiple times to refresh data

## Alternative: Selective Data Copy

If you only want specific tables, you can manually:

```bash
# 1. Dump specific table from remote
npx supabase db dump --data-only --linked --table users > users_data.sql

# 2. Restore to local
PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -f users_data.sql
```

## Troubleshooting

### "Local Supabase is not running"

```bash
npm run supabase:start
```

### "Failed to dump remote data"

Make sure you're linked:

```bash
npm run supabase:link
```

### "Permission denied"

The script needs to run psql. Make sure PostgreSQL client tools are installed.

## Workflow Example

```bash
# Start your day
npm run supabase:start
npm run db:switch:local

# Copy fresh data from remote
npm run db:copy-data

# Start developing with real data
npm run dev
```
