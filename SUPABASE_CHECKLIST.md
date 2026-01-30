# Supabase Development Checklist ✅

## Setup Status

### ✅ Completed

- [x] Supabase CLI installed (in devDependencies)
- [x] Migration files organized in `supabase/migrations/`
- [x] Type generation scripts configured
- [x] RLS policies implemented for key tables (offers, invoices, storage)
- [x] Supabase client configured with TypeScript types
- [x] Helpful npm scripts added

### 🔄 In Progress / To Verify

- [x] Environment variables configured (`.env.local` file exists) ✅
- [ ] Supabase CLI linked to remote project (run `npm run supabase:link`)
- [ ] TypeScript types generated and up to date (run `npm run db:types:remote`)
- [ ] Docker installed (optional, for local development) - Not installed yet

### 📋 Action Items

#### 1. Environment Variables Setup

Create a `.env.local` file in the project root with:

```env
VITE_SUPABASE_URL=https://tlpgejkglrgoljgvpubn.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_PROJECT_REF=tlpgejkglrgoljgvpubn
```

**To get your keys:**

1. Go to https://app.supabase.com/project/tlpgejkglrgoljgvpubn
2. Navigate to Settings → API
3. Copy the "Project URL" and "anon public" key

#### 2. Link Supabase CLI (One-time setup)

```bash
# Login to Supabase CLI
npx supabase login

# Link to your project (project ref is already in package.json)
npm run supabase:link
```

#### 3. Generate TypeScript Types

```bash
# Generate types from remote database
npm run db:types:remote
```

#### 4. Optional: Local Development Setup

If you want to run Supabase locally (requires Docker):

1. **Install Docker Desktop**: https://www.docker.com/products/docker-desktop

2. **Start local Supabase**:

   ```bash
   npm run supabase:start
   ```

3. **Update `.env.local`** for local development:

   ```env
   VITE_SUPABASE_URL=http://127.0.0.1:54321
   VITE_SUPABASE_ANON_KEY=<get-from-supabase-status>
   ```

4. **Get local keys**:
   ```bash
   npm run db:status
   ```
   Copy the anon key from the output.

## Daily Workflow

### Making Database Changes

**Option A: Via Supabase Dashboard**

1. Make changes in Supabase dashboard
2. Generate migration: `npm run db:diff capture_changes`
3. Review the generated migration file
4. Push to remote: `npm run db:push`
5. Regenerate types: `npm run db:types:remote`

**Option B: Via Migration Files (Recommended)**

1. Create new migration: `npm run db:migrate add_new_feature`
2. Edit the migration file in `supabase/migrations/`
3. Test locally (if using Docker): `npm run db:reset`
4. Push to remote: `npm run db:push`
5. Regenerate types: `npm run db:types:remote`

### Testing Migrations

If using local Supabase:

```bash
# Reset local DB and apply all migrations
npm run db:reset

# Check status
npm run db:status
```

## Available Commands

| Command                     | Description                            |
| --------------------------- | -------------------------------------- |
| `npm run db:types`          | Generate types from local database     |
| `npm run db:types:remote`   | Generate types from remote database    |
| `npm run db:diff <name>`    | Create migration from remote changes   |
| `npm run db:reset`          | Reset local database to migrations     |
| `npm run db:push`           | Push local migrations to remote        |
| `npm run db:migrate <name>` | Create a new migration file            |
| `npm run db:status`         | Show Supabase status (local)           |
| `npm run supabase:start`    | Start local Supabase (requires Docker) |
| `npm run supabase:stop`     | Stop local Supabase                    |
| `npm run supabase:link`     | Link CLI to remote project             |

## Security Checklist

- [x] RLS policies implemented for sensitive tables
- [ ] Review all tables to ensure RLS is enabled
- [ ] Test RLS policies with different user roles
- [ ] Verify service role key is never exposed in frontend
- [ ] Review storage bucket policies

## RLS Policy Coverage

Your migrations show RLS policies for:

- ✅ `job_offers` and related offer tables
- ✅ `job_invoices`
- ✅ Storage buckets (`company_files`, logos)

**Action:** Review all tables to ensure RLS is enabled. Check:

- All user-facing tables should have RLS enabled
- Policies should be tested with different user roles
- Consider adding policies for any tables missing them

## Next Steps

1. **Verify environment variables**: Check if `.env.local` exists and has correct values
2. **Link Supabase CLI**: Run `npm run supabase:link` if not already done
3. **Generate types**: Run `npm run db:types:remote` to ensure types are current
4. **Optional**: Install Docker and set up local development for faster iteration

## Troubleshooting

### Types are out of date

```bash
npm run db:types:remote
```

### Migration conflicts

```bash
# Pull latest from remote
npx supabase db pull

# Review conflicts and resolve
# Then push your changes
npm run db:push
```

### Local Supabase won't start

- Ensure Docker Desktop is running
- Check ports 54321-54327 are available
- Try: `npm run supabase:stop` then `npm run supabase:start`

## Resources

- [Supabase CLI Docs](https://supabase.com/docs/guides/cli)
- [RLS Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Migration Guide](https://supabase.com/docs/guides/cli/local-development#database-migrations)
