# Copy Storage Files Guide

## Quick Copy

```bash
# Make sure local Supabase is running
npm run supabase:start

# Copy all storage files from remote to local
npm run db:copy-storage
```

## What It Does

1. **Lists all buckets** from remote Supabase Storage
2. **Lists all files** in each bucket
3. **Downloads files** from remote
4. **Uploads files** to local storage
5. **Creates buckets** locally if they don't exist

## Prerequisites

Make sure `.env.remote.db` has your remote credentials:

```env
VITE_SUPABASE_URL=https://tlpgejkglrgoljgvpubn.supabase.co
VITE_SUPABASE_ANON_KEY=your-remote-anon-key-here
```

Or switch to remote temporarily:

```bash
npm run db:switch:remote
npm run db:copy-storage
npm run db:switch:local  # Switch back
```

## Complete Data Copy

To copy both database data AND storage files:

```bash
# Copy database data
npm run db:copy-data

# Copy storage files
npm run db:copy-storage
```

## Troubleshooting

### "Please configure remote credentials"

Update `.env.remote.db` with your remote anon key, or temporarily switch to remote mode.

### "Local Supabase is not running"

```bash
npm run supabase:start
```

### Some files fail to copy

- Large files might take time
- Check file permissions in remote storage
- Verify bucket policies allow public access if needed

## Notes

- **Overwrites existing files** - Files with same name will be replaced
- **Preserves folder structure** - Directory structure is maintained
- **Bucket settings** - Public/private settings are preserved
- **No deletion** - Only copies files, doesn't delete local files not in remote
