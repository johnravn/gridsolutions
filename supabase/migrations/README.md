# Database Migrations

This directory contains all database migration files. Migrations are applied in chronological order based on their timestamp prefix.

## ⚠️ CRITICAL RULES FOR AI AGENTS

**When making ANY database schema changes:**

1. **ALWAYS create a migration file** - Never make changes directly in Supabase Dashboard
2. **ALWAYS enable RLS** - Every table must have Row Level Security enabled
3. **ALWAYS add RLS policies** - Create policies for SELECT, INSERT, UPDATE, DELETE
4. **ALWAYS test locally** - Use `npm run db:reset` before pushing
5. **ALWAYS update types** - Run `npm run db:types:remote` after schema changes

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
CREATE POLICY "Users can view company data"
  ON table_name FOR SELECT
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

### Testing Locally

```bash
npm run db:reset  # Resets local DB and applies all migrations
```

### Pushing to Production

```bash
npm run db:push  # Pushes migrations to remote Supabase
npm run db:types:remote  # Regenerates TypeScript types
```

## RLS Policy Patterns

### Company-Scoped Data

```sql
-- Users can access data for companies they belong to
USING (
  company_id IN (
    SELECT company_id FROM company_users
    WHERE user_id = auth.uid()
  )
)
```

### Personal Data

```sql
-- Users can access their own personal data
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
      AND profiles.primary_address_id = table_name.id
  )
)
```

### Superuser Access

```sql
-- Always allow superusers
OR EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.user_id = auth.uid()
    AND profiles.superuser = true
)
```

## Best Practices

- ✅ One logical change per migration
- ✅ Use descriptive migration names
- ✅ Test locally before pushing
- ✅ Use idempotent SQL
- ✅ Never edit applied migrations
- ❌ Never skip RLS policies
- ❌ Never make changes in Dashboard without capturing as migration

## Resources

- **Complete Guide**: See `CONTRIBUTING.md` in project root
- **Development Workflow**: See `../DEVELOPMENT_WORKFLOW.md`
- **Troubleshooting**: See `../../TROUBLESHOOTING_MIGRATIONS.md`

---

**Remember**: When in doubt, create a migration file and test it locally first!
