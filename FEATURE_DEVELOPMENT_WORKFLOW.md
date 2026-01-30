# Feature Development Workflow

Complete guide for adding database features locally and pushing to remote.

## Overview

```
Local DB (Docker) → Migrations → Push to Remote → Update Types → Done!
```

## Step-by-Step Workflow

### 1. Start Local Development

```bash
# Start local Supabase (if not running)
npm run supabase:start

# Switch to local database
npm run db:switch:local

# Start your dev server
npm run dev
```

### 2. Create a New Migration

When you want to add a feature that requires database changes:

```bash
npm run db:migrate add_user_notifications
```

This creates: `supabase/migrations/YYYYMMDDHHMMSS_add_user_notifications.sql`

### 3. Write Your Migration SQL

Edit the migration file with your changes:

```sql
-- Example: Add notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(user_id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS (Row Level Security) - ALWAYS do this for new tables!
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_company_id ON notifications(company_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);

-- Add RLS policies
DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
CREATE POLICY "Users can view their own notifications"
ON notifications FOR SELECT
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
CREATE POLICY "Users can update their own notifications"
ON notifications FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Add updated_at trigger
DROP TRIGGER IF EXISTS notifications_updated_at ON notifications;
CREATE TRIGGER notifications_updated_at
BEFORE UPDATE ON notifications
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
```

**Migration Best Practices:**

- ✅ Use `IF NOT EXISTS` / `IF EXISTS` for idempotency
- ✅ Always enable RLS on new tables
- ✅ Add indexes for foreign keys and frequently queried columns
- ✅ Use `DROP POLICY IF EXISTS` before creating policies
- ✅ One logical feature per migration file
- ❌ Never edit migrations that have been pushed to remote

### 4. Test Locally

Apply your migration to local database:

```bash
npm run db:reset
```

This resets the local DB and applies all migrations from scratch. Check:

- Does it run without errors?
- Do your tables/columns exist? (check in Supabase Studio: http://127.0.0.1:54323)
- Do RLS policies work correctly?

### 5. Test with Your App

Run your app locally and test the feature:

```bash
npm run dev
```

Use Supabase Studio (http://127.0.0.1:54323) to:

- Inspect tables
- Check data
- Test queries

### 6. Push to Remote

Once everything works locally, push to remote:

```bash
npm run db:push
```

This will:

- Show you which migrations will be applied
- Ask for confirmation
- Apply migrations to your remote database

### 7. Update TypeScript Types

After pushing, regenerate types so TypeScript knows about your changes:

```bash
npm run db:types:remote
```

This updates `src/shared/types/database.types.ts` with your new schema.

### 8. Use in Your Code

Now you can use your new tables/columns with full type safety:

```typescript
// TypeScript now knows about notifications table!
const { data: notifications } = await supabase
  .from('notifications')
  .select('*')
  .eq('user_id', userId)
  .eq('read', false)

// notifications is typed as Notifications[] ✨
```

### 9. Commit Everything

```bash
git add supabase/migrations/
git add src/shared/types/database.types.ts
git commit -m "feat: add user notifications table"
```

## Common Patterns

### Adding a Column to Existing Table

```sql
ALTER TABLE jobs
ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium'
CHECK (priority IN ('low', 'medium', 'high'));
```

### Adding a Foreign Key

```sql
ALTER TABLE jobs
ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES profiles(user_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_jobs_assigned_to ON jobs(assigned_to);
```

### Creating a New Enum Type

```sql
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_type') THEN
        CREATE TYPE notification_type AS ENUM (
            'info',
            'warning',
            'error',
            'success'
        );
    END IF;
END $$;

ALTER TABLE notifications
ADD COLUMN IF NOT EXISTS type notification_type DEFAULT 'info';
```

### Adding a Storage Bucket

```sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'user_documents',
  'user_documents',
  false, -- Private bucket
  10485760, -- 10MB
  ARRAY['application/pdf', 'image/jpeg', 'image/png']
)
ON CONFLICT (id) DO NOTHING;

-- Add RLS policies for storage.objects
DROP POLICY IF EXISTS "Users can upload their own documents" ON storage.objects;
CREATE POLICY "Users can upload their own documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'user_documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
```

## Complete Example: Adding a Feature

Let's say you want to add a "favorites" feature:

```bash
# 1. Create migration
npm run db:migrate add_job_favorites

# 2. Edit supabase/migrations/YYYYMMDDHHMMSS_add_job_favorites.sql
```

```sql
-- Create favorites table
CREATE TABLE IF NOT EXISTS job_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(user_id) ON DELETE CASCADE,
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, job_id)
);

-- Enable RLS
ALTER TABLE job_favorites ENABLE ROW LEVEL SECURITY;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_job_favorites_user_id ON job_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_job_favorites_job_id ON job_favorites(job_id);

-- RLS policies
DROP POLICY IF EXISTS "Users can view their own favorites" ON job_favorites;
CREATE POLICY "Users can view their own favorites"
ON job_favorites FOR SELECT
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can manage their own favorites" ON job_favorites;
CREATE POLICY "Users can manage their own favorites"
ON job_favorites FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
```

```bash
# 3. Test locally
npm run db:reset

# 4. Test in app (add some UI to favorite/unfavorite)

# 5. Push to remote
npm run db:push

# 6. Update types
npm run db:types:remote

# 7. Use in code with types!
const { data } = await supabase
  .from('job_favorites')
  .select('*, jobs(*)')
  .eq('user_id', userId)
```

## Troubleshooting

### Migration Fails on Push

```bash
# Check what migrations remote has
npx supabase migration list --linked

# If there's a conflict, you may need to repair migration history
npx supabase migration repair --status applied <timestamp>
```

### Types Are Out of Sync

```bash
# Regenerate from remote (always use this after pushing)
npm run db:types:remote
```

### Need to Modify a Pushed Migration

**Never edit a migration that's been pushed!** Instead:

1. Create a new migration that fixes/modifies the previous one
2. Test locally with `npm run db:reset`
3. Push the new migration

```bash
npm run db:migrate fix_notification_table
# Edit to add/modify columns
npm run db:push
```

### Local DB is Messed Up

```bash
# Reset everything and reapply all migrations
npm run db:reset

# Or if that doesn't work, stop and start
npm run supabase:stop
npm run supabase:start
npm run db:reset
```

## Quick Reference

```bash
# Start local dev
npm run supabase:start
npm run db:switch:local
npm run dev

# Add feature
npm run db:migrate <feature_name>
# Edit migration file
npm run db:reset              # Test locally
npm run db:push               # Push to remote
npm run db:types:remote       # Update types

# Check status
npm run db:status             # Local Supabase status
npm run db:switch:status      # Which DB is active
```

## Checklist for Each Feature

- [ ] Migration file created with descriptive name
- [ ] SQL uses `IF NOT EXISTS` / `IF EXISTS` for idempotency
- [ ] RLS enabled on new tables
- [ ] RLS policies added and tested
- [ ] Indexes added for foreign keys and common queries
- [ ] Migration tested locally with `npm run db:reset`
- [ ] Feature tested in local app
- [ ] Migration pushed to remote with `npm run db:push`
- [ ] Types regenerated with `npm run db:types:remote`
- [ ] Code uses new types properly
- [ ] Everything committed to git

## Next Steps

1. ✅ Try creating a simple feature (add a column to an existing table)
2. ✅ Practice the full workflow locally first
3. ✅ Always test with `npm run db:reset` before pushing
4. ✅ Keep migrations small and focused (one feature per migration)
