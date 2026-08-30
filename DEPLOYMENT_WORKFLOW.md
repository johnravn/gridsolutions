# Deployment & Development Workflow

This document outlines the complete workflow for developing, testing, and deploying to production on Vercel with gridsolutions.app.

## 🏗️ Branch Strategy

Work only on **`main`**. No feature branches, no pull requests. Track work with GitHub issues — see `GITHUB_ISSUES.md`.

- **`main`** — the only branch
  - Auto-deploys to Vercel → gridsolutions.app
  - Must stay deployable: test locally before pushing
  - Apply backward-compatible migrations before pushing code that needs them

## 🔄 Development Workflow

### Starting a New Feature

1. **Issue first, then pull `main`:**

   ```bash
   gh issue list --state open --limit 30
   # or: gh issue create --title "..." --body "..."
   git checkout main
   git pull origin main
   ```

2. **Develop locally:**

   ```bash
   npm run supabase:start      # Start local Supabase (if using Docker)
   npm run db:switch:local     # Switch to local DB
   npm run dev                 # Start dev server
   ```

3. **Make changes:**
   - Write code
   - Create migrations if needed (see Migration Workflow below)
   - Test locally

4. **Commit and push `main`:**

   ```bash
   git add .
   git commit -m "$(cat <<'EOF'
   Add inventory tracking

   Closes #142
   EOF
   )"
   git push origin main
   ```

### Migration Workflow on `main`

**⚠️ CRITICAL: Database migrations require special handling**

#### Option A: Backward-Compatible Migrations (Recommended)

If your migration is backward-compatible (adds columns, tables, etc. without breaking existing code):

1. **Create migration:**

   ```bash
   npm run db:migrate add_inventory_tracking
   # Edit the migration file
   ```

2. **Test locally:**

   ```bash
   npm run db:reset  # Test migration locally
   ```

3. **Push migration to production BEFORE pushing code that uses it:**

   ```bash
   npm run db:push  # Push to production Supabase
   npm run db:types:remote  # Update types
   git add supabase/migrations/ src/shared/types/database.types.ts
   git commit -m "$(cat <<'EOF'
   Add inventory tracking tables

   Closes #142
   EOF
   )"
   git push origin main
   ```

   If the schema and app change belong in the same commit, still run `npm run db:push` **before** `git push origin main`.

#### Option B: Breaking Migrations

If your migration breaks existing code (removes columns, changes types, etc.):

1. **Create migration:**

   ```bash
   npm run db:migrate remove_old_column
   ```

2. **Test locally:**

   ```bash
   npm run db:reset
   ```

3. **Push code that no longer depends on the old schema, then apply the migration immediately:**

   ```bash
   git push origin main
   npm run db:push  # Apply migration
   npm run db:types:remote  # Update types
   git add src/shared/types/database.types.ts
   git commit -m "$(cat <<'EOF'
   Update types after migration

   Refs #142
   EOF
   )"
   git push origin main
   ```

**Best Practice:** Prefer Option A (backward-compatible) whenever possible.

## 🚀 Deployment Workflow

### Vercel Deployment

Every push to `main` deploys **production** at `https://gridsolutions.app`.

**Process**:

1. Vercel automatically detects the push to `main`
2. Builds the application
3. Deploys to gridsolutions.app
4. Uses environment variables from Vercel dashboard (Production)

Test locally before pushing. This workflow does not use feature-branch preview deployments.

### Manual Deployment Steps

1. **Ensure migrations are applied:**

   ```bash
   # Check migration status
   npx supabase migration list

   # If needed, push migrations
   npm run db:push
   ```

2. **Update TypeScript types:**

   ```bash
   npm run db:types:remote
   git add src/shared/types/database.types.ts
   git commit -m "chore: update types from production"
   git push origin main
   ```

3. **Push to `main`:**

   ```bash
   git checkout main
   git pull origin main
   git push origin main
   ```

4. **Monitor Vercel deployment:**
   - Check Vercel dashboard for build status
   - Verify production at gridsolutions.app

## 🔐 Environment Variables

### Important: Two Different Configurations

You need **different** Supabase URLs for local development vs production:

- **Local Development** (`.env.local`): Use localhost when running Docker Supabase
- **Vercel/Production**: Use your production Supabase URL

### Local Environment Variables (`.env.local`)

**If using local Supabase (Docker):**

```env
# Local Supabase (when running: npm run supabase:start)
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=your-local-anon-key
SUPABASE_PROJECT_REF=tlpgejkglrgoljgvpubn
```

**If NOT using local Supabase (connecting directly to production):**

```env
# Production Supabase (for local development)
VITE_SUPABASE_URL=https://tlpgejkglrgoljgvpubn.supabase.co
VITE_SUPABASE_ANON_KEY=your-production-anon-key
SUPABASE_PROJECT_REF=tlpgejkglrgoljgvpubn
```

**⚠️ Never commit `.env.local` to git!**

### Vercel Environment Variables (Production)

Set these in **Vercel Dashboard → Settings → Environment Variables → Production**:

```
VITE_SUPABASE_URL=https://tlpgejkglrgoljgvpubn.supabase.co
VITE_SUPABASE_ANON_KEY=your-production-anon-key
SUPABASE_PROJECT_REF=tlpgejkglrgoljgvpubn
```

**How to find your production values:**

1. Go to https://app.supabase.com
2. Select your project
3. Go to **Settings → API**
4. Copy:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon/public key** → `VITE_SUPABASE_ANON_KEY`
   - **Project Reference ID** → `SUPABASE_PROJECT_REF` (from URL: `https://app.supabase.com/project/YOUR-PROJECT-REF`)

**Preview environment:** unused in this workflow (everything ships on `main`). Keep Production variables set.

### Quick Check: Which URL Should You Use?

**Use localhost (`http://127.0.0.1:54321`) if:**

- ✅ You run `npm run supabase:start` for local development
- ✅ You want to test migrations locally
- ✅ You want faster development (no network latency)

**Use production URL (`https://...supabase.co`) if:**

- ✅ You're deploying to Vercel
- ✅ You're not using Docker/local Supabase
- ✅ You want to test against production data (be careful!)

## 📋 Pre-Deployment Checklist

Before pushing to `main`:

- [ ] All migrations tested locally (`npm run db:reset`)
- [ ] Migrations pushed to production (if backward-compatible)
- [ ] TypeScript types updated (`npm run db:types:remote`)
- [ ] Code tested locally
- [ ] No console errors or warnings
- [ ] Environment variables set in Vercel
- [ ] Migration files committed to git
- [ ] Types file committed to git

## 🧪 Testing Workflow

### Local Testing

1. **Test with local database:**

   ```bash
   npm run supabase:start
   npm run db:switch:local
   npm run db:reset  # Apply all migrations
   npm run dev
   ```

2. **Test with production database (read-only):**
   ```bash
   npm run db:switch:remote
   npm run dev
   # Test against production data (be careful!)
   ```

### Pre-Production Testing

Before pushing to `main`:

1. **Test migration locally:**

   ```bash
   npm run db:reset  # Should apply all migrations successfully
   ```

2. **Verify RLS policies:**
   - Test with different user roles
   - Verify superusers can access everything
   - Verify regular users are restricted correctly

3. **Check TypeScript compilation:**
   ```bash
   npm run build  # Should compile without errors
   ```

## 🔄 Rollback Procedure

### Rollback Code (Vercel)

1. **Revert commit in GitHub:**

   ```bash
   git revert <commit-hash>
   git push origin main
   ```

   Vercel will automatically redeploy the previous version.

2. **Or use Vercel Dashboard:**
   - Go to Deployments
   - Find previous working deployment
   - Click "Promote to Production"

### Rollback Migration (Supabase)

**⚠️ WARNING: Rolling back migrations is complex and risky!**

1. **Create a new migration to undo changes:**

   ```bash
   npm run db:migrate rollback_previous_migration
   # Write SQL to reverse the previous migration
   ```

2. **Test locally:**

   ```bash
   npm run db:reset
   ```

3. **Push to production:**
   ```bash
   npm run db:push
   ```

**Better approach:** Always make migrations backward-compatible so rollback isn't needed.

## 📝 GitHub Issues

See `GITHUB_ISSUES.md`. Work is tracked as issues; commits on `main` use `Closes #N` / `Fixes #N` / `Refs #N`. Do not open pull requests.

## 🎯 Best Practices

### Do's ✅

- Always test migrations locally before pushing
- Push backward-compatible migrations before pushing code that uses them
- Update TypeScript types after schema changes
- Work on `main` and reference GitHub issues in commits
- Keep `main` always deployable
- Document breaking changes in the issue and/or commit body

### Don'ts ❌

- Never push breaking migrations without deploying compatible code first
- Never skip local testing
- Never commit `.env.local` files
- Never make schema changes in Supabase Dashboard without migrations
- Never push to `main` with failing tests
- Never skip updating TypeScript types
- Never create pull requests or feature branches

## 🔗 Related Documentation

- **Migration Workflow**: See `CONTRIBUTING.md`
- **Supabase Setup**: See `SUPABASE_SETUP.md`
- **Quick Start**: See `QUICK_START.md`
- **Development Workflow**: See `supabase/DEVELOPMENT_WORKFLOW.md`

## 🆘 Troubleshooting

### Vercel Build Fails

1. Check build logs in Vercel dashboard
2. Verify environment variables are set
3. Test build locally: `npm run build`
4. Check for TypeScript errors

### Migration Conflicts

1. Check migration status: `npx supabase migration list`
2. Pull latest from remote: `npx supabase db pull`
3. Resolve conflicts manually
4. Test locally before pushing

### Type Errors After Deployment

1. Regenerate types: `npm run db:types:remote`
2. Commit updated types
3. Redeploy (or wait for next deployment)

---

**Remember**: When in doubt, test locally first, then push to `main` only when quality gates pass.
