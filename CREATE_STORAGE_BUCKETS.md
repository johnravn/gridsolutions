# Create Storage Buckets Locally

## Quick Setup

Your storage copy script found files but needs the buckets to exist first.

### Option 1: Via Supabase Studio (Easiest)

1. **Open Supabase Studio:** http://127.0.0.1:54323
2. **Go to Storage** (left sidebar)
3. **Create these buckets:**
   - `company_files` (public or private, your choice)
   - `vehicle_images` (typically public)
   - `logos` (typically public)

4. **Then run:**
   ```bash
   npm run db:copy-storage
   ```

### Option 2: Via SQL (If you prefer)

```sql
-- Run this in Supabase Studio SQL Editor
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('company_files', 'company_files', false),
  ('vehicle_images', 'vehicle_images', true),
  ('logos', 'logos', true)
ON CONFLICT (id) DO NOTHING;
```

### Option 3: Check Migrations

Some buckets might be created by migrations. Check:

```bash
grep -r "bucket" supabase/migrations/ --include="*.sql"
```

## After Creating Buckets

Run the copy script again:

```bash
npm run db:copy-storage
```

It should now copy all 12 files (1 + 5 + 6) successfully!
