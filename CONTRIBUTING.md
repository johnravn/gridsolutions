# Contributing Guide

This project is primarily developed using AI agents. This guide ensures all contributors (human and AI) follow the correct workflows.

## ⚠️ CRITICAL: Database Migration Workflow

**ALL database schema changes MUST go through the migration workflow. Never make changes directly in the Supabase Dashboard without capturing them as migrations.**

### Creating Database Migrations

1. **Create a new migration file:**

   ```bash
   npm run db:migrate descriptive_name
   ```

   This creates: `supabase/migrations/YYYYMMDDHHMMSS_descriptive_name.sql`

2. **Write your SQL in the migration file:**
   - Always use `IF EXISTS` / `IF NOT EXISTS` for idempotency
   - Always enable RLS on new tables: `ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;`
   - Always add RLS policies for new tables
   - Use `DROP POLICY IF EXISTS` before creating policies

3. **Test locally:**

   ```bash
   npm run db:reset  # Resets local DB and applies all migrations
   ```

4. **Push to production:**

   ```bash
   npm run db:push  # Pushes migrations to remote Supabase
   ```

5. **Update TypeScript types:**
   ```bash
   npm run db:types:remote  # Regenerates types from remote DB
   ```

### RLS (Row Level Security) Requirements

**Every table MUST have RLS enabled and appropriate policies.** When adding RLS to existing tables:

1. Enable RLS: `ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;`
2. Create policies for SELECT, INSERT, UPDATE, DELETE operations
3. Follow the pattern:
   - Company-scoped data: Check `company_users` table membership
   - Personal data: Check ownership via `profiles.user_id = auth.uid()`
   - Superusers: Allow access via `profiles.superuser = true`

Example RLS policy pattern:

```sql
-- Enable RLS
ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;

-- SELECT policy
CREATE POLICY "Users can view company addresses"
  ON addresses FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM company_users
      WHERE user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.superuser = true
    )
  );
```

### Migration Best Practices

- ✅ **One logical change per migration** (e.g., `add_rls_to_addresses.sql`)
- ✅ **Always test locally before pushing**
- ✅ **Use idempotent SQL** (`IF EXISTS`, `IF NOT EXISTS`)
- ✅ **Never edit applied migrations** - create a new migration instead
- ✅ **Always regenerate types after schema changes**
- ❌ **Never make schema changes in Dashboard without capturing as migration**
- ❌ **Never skip the local testing step**

## Development Workflow

### Local Development Setup

1. Start local Supabase:

   ```bash
   npm run supabase:start
   ```

2. Switch to local database:

   ```bash
   npm run db:switch:local
   ```

3. Start dev server:
   ```bash
   npm run dev
   ```

### Database Switching

- **Local**: `npm run db:switch:local` - Use for development
- **Remote**: `npm run db:switch:remote` - Use for production testing
- **Status**: `npm run db:switch:status` - Check current connection

### Type Generation

After any schema change:

- **Local**: `npm run db:types` (from local DB)
- **Remote**: `npm run db:types:remote` (from production DB)

Always commit updated `src/shared/types/database.types.ts` after schema changes.

## Code Style

- Use TypeScript for all new code
- Follow existing patterns in the codebase
- Use TanStack Query for data fetching
- Use Radix UI Themes for components
- Follow the feature-based folder structure

## Testing

- Test migrations locally before pushing
- Test RLS policies with different user roles
- Verify TypeScript types are updated

## Resources

- **Deployment Workflow**: See `DEPLOYMENT_WORKFLOW.md` - Complete guide for deploying to Vercel
- **Migration Workflow**: See `supabase/DEVELOPMENT_WORKFLOW.md`
- **Quick Start**: See `QUICK_START.md`
- **Database Setup**: See `SUPABASE_SETUP.md`

---

**Remember**: When in doubt about database changes, always create a migration file and test it locally first!
