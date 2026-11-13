# Supabase Development Workflow

## Quick Reference

### Initial Setup (One-time)

1. **Environment Variables**: Prefer hosted **Dev** in `.env.dev.db`, then:

   ```bash
   npm run db:switch:dev
   ```

   Example Dev values (from Dashboard → Settings → API — never invent keys):

   ```env
   VITE_SUPABASE_URL=https://YOUR_DEV_REF.supabase.co
   VITE_SUPABASE_ANON_KEY=your-dev-anon-key
   SUPABASE_PROJECT_REF=YOUR_DEV_REF
   ```

   Prod (`tlpgejkglrgoljgvpubn`) stays in `.env.remote.db` for promote / rare checks. See `.env.example`.

2. **Link Supabase CLI** (to the project you intend to push):

   ```bash
   npx supabase login
   npm run supabase:link:dev    # day-to-day
   # npm run supabase:link:prod  # only before a John-approved Prod promote
   ```

3. **Generate Types**:
   ```bash
   npm run db:types:dev     # while iterating
   # npm run db:types:prod  # after Prod promote
   ```

### Daily Development Workflow

#### Making Schema Changes

**Best Practice: Use Migration Files**

1. **Create a new migration**:

   ```bash
   npm run db:migrate add_new_feature
   ```

   This creates: `supabase/migrations/YYYYMMDDHHMMSS_add_new_feature.sql`

2. **Edit the migration file** with your SQL changes:

   ```sql
   -- Example: Add a new column
   ALTER TABLE jobs ADD COLUMN new_field TEXT;

   -- Always enable RLS on new tables
   ALTER TABLE new_table ENABLE ROW LEVEL SECURITY;

   -- Add RLS policies (wrap auth.uid() for InitPlan)
   CREATE POLICY "Users can view their company's data"
   ON new_table FOR SELECT
   USING (company_id IN (
     SELECT company_id FROM company_users
     WHERE user_id = (select auth.uid())
   ));
   ```

3. **Push / verify on Dev** (primary path):

   ```bash
   npm run supabase:link:dev
   npm run db:push:dev   # when John has authorized a Dev push
   ```

   Optional Docker: `npm run db:reset` (not the cloud-agent default once Dev secrets exist).

4. **Promote to Prod** only when John explicitly asks:

   ```bash
   npm run supabase:link:prod
   CONFIRM_PROD_PUSH=1 npm run db:push:prod
   ```

5. **Update TypeScript types**:
   ```bash
   npm run db:types:dev    # iterating
   npm run db:types:prod   # after Prod promote
   ```

#### If You Made Changes in Dashboard

1. **Capture the changes**:

   ```bash
   npm run db:diff capture_dashboard_changes
   ```

2. **Review the generated migration** in `supabase/migrations/`

3. **Push to Dev first**, then Prod only when John asks:

   ```bash
   npm run db:push:dev
   ```

4. **Update types**:
   ```bash
   npm run db:types:dev
   ```

### Migration Best Practices

1. **One logical change per migration**
   - ✅ Good: `20250120000000_add_user_preferences.sql`
   - ❌ Bad: `20250120000000_add_everything.sql`

2. **Always include RLS for new tables**

   ```sql
   CREATE TABLE new_table (...);
   ALTER TABLE new_table ENABLE ROW LEVEL SECURITY;
   CREATE POLICY "..." ON new_table ...;
   ```

3. **Use IF EXISTS / IF NOT EXISTS** for idempotency

   ```sql
   CREATE TABLE IF NOT EXISTS ...
   DROP TABLE IF EXISTS ...
   ```

4. **Never edit applied migrations**
   - If you need to change something, create a new migration

5. **Test migrations before pushing**
   - Use `npm run db:reset` locally to test

### Type Safety Workflow

After any schema change:

```bash
npm run db:types:dev     # while schema lives on Dev first
# npm run db:types:prod  # after promote so committed types match Prod

# Commit the updated types file only when John asks
git add src/shared/types/database.types.ts
```

### Hosted Dev (primary) vs Local Docker (optional)

**Hosted Dev** is the default for agents and day-to-day migration dry-runs once the Dev project exists.

**Local Docker** remains an optional escape hatch (offline / zero-cost experiments):

1. Install Docker Desktop
2. `npm run supabase:start`
3. `npm run db:switch:local` (keys from `npm run db:status`)
4. `npm run db:types` for local types

**When to use which:**

- **Dev (hosted)**: Primary development, agent work, migration verify before Prod
- **Local Docker**: Offline / optional
- **Prod**: Live `gridsolutions.app` only — promote with `CONFIRM_PROD_PUSH=1 npm run db:push:prod` when John asks

### Troubleshooting

#### Migration Conflicts

```bash
# Pull latest from remote
npx supabase db pull

# Review and resolve conflicts manually
# Then push
npm run db:push
```

#### Types Out of Sync

```bash
npm run db:types:dev
# or after Prod promote:
npm run db:types:prod
# or from local Docker:
npm run db:types
```

#### Local Supabase Issues

```bash
# Stop and restart
npm run supabase:stop
npm run supabase:start

# Or reset completely
npm run db:reset
```

### Security Checklist

Before deploying migrations:

- [ ] All new tables have RLS enabled
- [ ] RLS policies are tested with different user roles
- [ ] No service role keys in frontend code
- [ ] Storage buckets have appropriate policies
- [ ] Sensitive data is properly protected

### Useful Commands Cheat Sheet

```bash
# Database
npm run db:migrate <name>            # Create migration
npm run db:push:dev                  # Push to hosted Dev (when authorized)
CONFIRM_PROD_PUSH=1 npm run db:push:prod  # Prod — John only
npm run db:reset                     # Reset local Docker DB (+ optional Prod copy)
npm run db:diff <name>               # Capture dashboard drift
npm run db:types:dev                 # Types from Dev
npm run db:types:prod                # Types from Prod (alias: db:types:remote)
npm run db:types                     # Types from local Docker

# Switch app .env.local
npm run db:switch:dev|local|prod|status

# Supabase CLI
npm run supabase:link:dev            # Link CLI to Dev
npm run supabase:link:prod           # Link CLI to Prod
npm run supabase:start|stop           # Local Docker stack
npm run db:status                    # Local Docker status
```

### Dashboard settings (not migrations)

Auth connection allocation (Dashboard → Project Settings → Database): prefer **percentage-based** pool allocation for Auth over a fixed absolute count (e.g. 10). This cannot be set via SQL migrations.

### Next Steps

1. ✅ Review `SUPABASE_CHECKLIST.md` for setup status
2. ✅ Run `supabase/verify_rls_coverage.sql` in SQL Editor to check RLS
3. ✅ Set up local development (optional but recommended)
4. ✅ Establish migration review process for your team
