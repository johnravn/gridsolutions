# Database Migrations

This directory contains all database migration files. Migrations are applied in chronological order based on their timestamp prefix.

## CRITICAL RULES FOR AI AGENTS

**When making ANY database schema changes:**

1. **ALWAYS create a migration file** — Never make changes directly in Supabase Dashboard
2. **ALWAYS enable RLS** — Every table must have Row Level Security enabled
3. **ALWAYS add RLS policies** — Create policies for SELECT, INSERT, UPDATE, DELETE
4. **ALWAYS verify on hosted Dev** — `npm run db:push:dev` when intent is clear (not bare `db:push`)
5. **ALWAYS update types** — `npm run db:types:dev` while iterating; `npm run db:types:prod` after Prod promote

Optional Docker `db:reset` is **not** the cloud-agent default. Do not copy Prod data into Dev.

## Migration Workflow

### Creating a Migration

```bash
npm run db:migrate descriptive_name
```

This creates: `YYYYMMDDHHMMSS_descriptive_name.sql`

### Writing Migration SQL

**Required patterns:**

```sql
-- Always use IF EXISTS / IF NOT EXISTS for idempotency
CREATE TABLE IF NOT EXISTS ...
DROP POLICY IF EXISTS "policy_name" ON table_name;

-- Always enable RLS on new tables
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;

-- Always add RLS policies (SELECT, INSERT, UPDATE, DELETE)
-- Wrap auth.uid() in (select ...) so Postgres evaluates it once (InitPlan),
-- not once per row. See auth_rls_initplan advisor.
CREATE POLICY "Users can view company data"
  ON table_name FOR SELECT
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

### Verify on hosted Dev

```bash
npm run db:push:dev      # when intent is clear — never bare db:push
npm run db:types:dev
```

### Promote to Production (only when John asks)

```bash
CONFIRM_PROD_PUSH=1 npm run db:push:prod
npm run db:types:prod    # alias: db:types:remote
```

## RLS Policy Patterns

### Company-Scoped Data

```sql
-- Users can access data for companies they belong to
USING (
  company_id IN (
    SELECT company_id FROM company_users
    WHERE user_id = (select auth.uid())
  )
)
```

### Personal Data

```sql
-- Users can access their own personal data
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = (select auth.uid())
      AND profiles.primary_address_id = table_name.id
  )
)
```

### Superuser Access

```sql
-- Always allow superusers
OR EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.user_id = (select auth.uid())
    AND profiles.superuser = true
)
```

## Best Practices

- ✅ One logical change per migration
- ✅ Use descriptive migration names
- ✅ Verify on hosted Dev before Prod promote
- ✅ Use idempotent SQL
- ✅ Never edit applied migrations
- ❌ Never skip RLS policies
- ❌ Never make changes in Dashboard without capturing as migration
- ❌ Never use bare `npm run db:push`

## Resources

- **Agent rules**: See `AGENTS.md` in project root
- **Complete Guide**: See `CONTRIBUTING.md` in project root
- **Development Workflow**: See `../DEVELOPMENT_WORKFLOW.md`
- **Troubleshooting**: See `../../TROUBLESHOOTING_MIGRATIONS.md`

---

**Remember**: When in doubt, create a migration file and verify it on hosted Dev first.
