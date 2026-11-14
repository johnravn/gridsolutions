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

3. **Verify on hosted Dev** (preferred) or optional local Docker:

   ```bash
   npm run supabase:link:dev
   npm run db:push:dev          # agents may when intent is clear + quality OK; ask if ambiguous
   # Optional offline: npm run db:reset  (Docker only — not the agent default; do not copy Prod→Dev)
   ```

4. **Promote to Prod** (only when John explicitly asks):

   ```bash
   npm run supabase:link:prod
   CONFIRM_PROD_PUSH=1 npm run db:push:prod
   # Never use bare npm run db:push
   ```

5. **Update TypeScript types:**
   ```bash
   npm run db:types:dev     # while iterating against Dev
   npm run db:types:prod    # after Prod promote (db:types:remote is an alias)
   ```

### RLS (Row Level Security) Requirements

**Every table MUST have RLS enabled and appropriate policies.** When adding RLS to existing tables:

1. Enable RLS: `ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;`
2. Create policies for SELECT, INSERT, UPDATE, DELETE operations
3. Follow the pattern:
   - Company-scoped data: Check `company_users` table membership
   - Personal data: Check ownership via `profiles.user_id = (select auth.uid())`
   - Superusers: Allow access via `profiles.superuser = true`

Example RLS policy pattern:

```sql
-- Enable RLS
ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;

-- SELECT policy
-- Wrap auth.uid() in (select ...) so Postgres evaluates it once (InitPlan)
CREATE POLICY "Users can view company addresses"
  ON addresses FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM company_users
      WHERE user_id = (select auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = (select auth.uid())
        AND profiles.superuser = true
    )
  );
```

### Migration Best Practices

- ✅ **One logical change per migration** (e.g., `add_rls_to_addresses.sql`)
- ✅ **Always verify on hosted Dev before Prod promote**
- ✅ **Use idempotent SQL** (`IF EXISTS`, `IF NOT EXISTS`)
- ✅ **Never edit applied migrations** - create a new migration instead
- ✅ **Always regenerate types after schema changes** (`db:types:dev` / `db:types:prod`)
- ❌ **Never make schema changes in Dashboard without capturing as migration**
- ❌ **Never use bare `npm run db:push`** — always `:dev` or `:prod`
- ❌ **Never skip Dev verification**

## Development Workflow

Work on `main`. Track work with GitHub issues (`gh issue list` / `gh issue create`). Commits must include `Closes #N`, `Fixes #N`, or `Refs #N`. Do not open pull requests or feature branches — see `GITHUB_ISSUES.md`.

### Local Development Setup

**Preferred: hosted Dev** (after John creates the Dev project and fills `.env.dev.db`):

```bash
npm run db:switch:dev
npm run dev
```

**Optional: Docker**

```bash
npm run supabase:start
npm run db:switch:local
npm run dev
```

### Database Switching

- **Dev**: `npm run db:switch:dev` — hosted Dev (primary for agents / day-to-day)
- **Local**: `npm run db:switch:local` — Docker (optional)
- **Prod**: `npm run db:switch:prod` — hosted Prod (rare; `db:switch:remote` is a legacy alias)
- **Status**: `npm run db:switch:status`

CLI link / push (environment-scoped):

- `npm run supabase:link:dev` / `npm run supabase:link:prod`
- `npm run db:push:dev` — agents may when intent is clear (see `AGENTS.md` / preferences)
- `CONFIRM_PROD_PUSH=1 npm run db:push:prod` — only when John asks
- Never bare `npm run db:push`

### Type Generation

After any schema change:

- **Dev**: `npm run db:types:dev`
- **Prod**: `npm run db:types:prod` (alias: `db:types:remote`)
- **Local Docker**: `npm run db:types`

Always commit updated `src/shared/types/database.types.ts` after schema changes (when John asks to commit).

## Code Style

- Use TypeScript for all new code
- Follow existing patterns in the codebase
- Use TanStack Query for data fetching
- Use Radix UI Themes for components
- Follow the feature-based folder structure

## Testing

- Verify migrations on hosted Dev before Prod promote
- Test RLS policies with different user roles
- Verify TypeScript types are updated
- Review via agent desktop or `npm run dev` on Dev — not a staging branch / PR preview

## Resources

- **Agent rules**: See `AGENTS.md`
- **Git & issues**: See `GITHUB_ISSUES.md`
- **Deployment Workflow**: See `DEPLOYMENT_WORKFLOW.md` - Deploying to Vercel from `main`
- **Environment / secrets**: See `ENVIRONMENT_SETUP.md`
- **Migration Workflow**: See `supabase/DEVELOPMENT_WORKFLOW.md`
- **Quick Start**: See `QUICK_START.md`
- **Database Setup**: See `SUPABASE_SETUP.md`

---

**Remember**: When in doubt about database changes, create a migration file and verify it on hosted Dev first!

## Automated testing

See **[docs/TESTING.md](docs/TESTING.md)** for unit, integration, and E2E test commands, setup, seed data, and troubleshooting.
