# Supabase Development Workflow

## Quick Reference

### Initial Setup (One-time)

1. **Environment Variables**: Ensure `.env.local` exists with:

   ```env
   VITE_SUPABASE_URL=https://tlpgejkglrgoljgvpubn.supabase.co
   VITE_SUPABASE_ANON_KEY=your-key
   SUPABASE_PROJECT_REF=tlpgejkglrgoljgvpubn
   ```

2. **Link Supabase CLI**:

   ```bash
   npx supabase login
   npm run supabase:link
   ```

3. **Generate Types**:
   ```bash
   npm run db:types:remote
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

   -- Add RLS policies
   CREATE POLICY "Users can view their company's data"
   ON new_table FOR SELECT
   USING (company_id IN (
     SELECT company_id FROM company_users
     WHERE user_id = auth.uid()
   ));
   ```

3. **Test locally** (if using Docker):

   ```bash
   npm run db:reset  # Applies all migrations
   ```

4. **Push to remote**:

   ```bash
   npm run db:push
   ```

5. **Update TypeScript types**:
   ```bash
   npm run db:types:remote
   ```

#### If You Made Changes in Dashboard

1. **Capture the changes**:

   ```bash
   npm run db:diff capture_dashboard_changes
   ```

2. **Review the generated migration** in `supabase/migrations/`

3. **Push to remote** (if needed):

   ```bash
   npm run db:push
   ```

4. **Update types**:
   ```bash
   npm run db:types:remote
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
# Always regenerate types
npm run db:types:remote

# Commit the updated types file
git add src/shared/types/database.types.ts
```

### Local Development (Optional but Recommended)

**Benefits:**

- Faster iteration (no network latency)
- Free (no API rate limits)
- Test migrations safely
- Works offline

**Setup:**

1. Install Docker Desktop
2. Start local Supabase:
   ```bash
   npm run supabase:start
   ```
3. Update `.env.local` with local URLs (get from `npm run db:status`)
4. Generate types from local:
   ```bash
   npm run db:types
   ```

**When to use local vs remote:**

- **Local**: Development, testing migrations, experimenting
- **Remote**: Production, staging, generating types for deployment

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
# Regenerate from remote
npm run db:types:remote

# Or from local (if using Docker)
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
npm run db:migrate <name>     # Create migration
npm run db:push                # Push migrations to remote
npm run db:reset               # Reset local DB
npm run db:diff <name>         # Capture remote changes
npm run db:types               # Generate types (local)
npm run db:types:remote        # Generate types (remote)

# Supabase CLI
npm run supabase:start         # Start local Supabase
npm run supabase:stop          # Stop local Supabase
npm run db:status              # Show status
npm run supabase:link          # Link to remote project
```

### Next Steps

1. ✅ Review `SUPABASE_CHECKLIST.md` for setup status
2. ✅ Run `supabase/verify_rls_coverage.sql` in SQL Editor to check RLS
3. ✅ Set up local development (optional but recommended)
4. ✅ Establish migration review process for your team
