# Deployment & Development Workflow

This document outlines the complete workflow for developing, testing, and deploying to production on Vercel with gridsolutions.app.

## 🏗️ Branch Strategy

### Branch Structure

- **`main`** - Production branch
  - Auto-deploys to Vercel → gridsolutions.app
  - Must always be stable and deployable
  - All migrations must be applied before merging
- **`develop`** (optional) - Development branch
  - For integrating multiple features
  - Can have a staging Vercel preview
- **`feature/*`** - Feature branches
  - Named like: `feature/add-inventory-tracking`
  - Created from `main` or `develop`
  - Merged back via Pull Request

### Branch Naming Convention

- `feature/description` - New features
- `fix/description` - Bug fixes
- `migration/description` - Database migrations only
- `refactor/description` - Code refactoring

## 🔄 Development Workflow

### Starting a New Feature

1. **Create feature branch from main:**

   ```bash
   git checkout main
   git pull origin main
   git checkout -b feature/my-feature-name
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

4. **Commit and push:**
   ```bash
   git add .
   git commit -m "feat: add inventory tracking feature"
   git push origin feature/my-feature-name
   ```

### Migration Workflow in Feature Branches

**⚠️ CRITICAL: Database migrations require special handling**

#### Option A: Backward-Compatible Migrations (Recommended)

If your migration is backward-compatible (adds columns, tables, etc. without breaking existing code):

1. **Create migration in feature branch:**

   ```bash
   npm run db:migrate add_inventory_tracking
   # Edit the migration file
   ```

2. **Test locally:**

   ```bash
   npm run db:reset  # Test migration locally
   ```

3. **Push migration to production BEFORE merging code:**

   ```bash
   npm run db:push  # Push to production Supabase
   npm run db:types:remote  # Update types
   git add supabase/migrations/ src/shared/types/database.types.ts
   git commit -m "migration: add inventory tracking tables"
   git push origin feature/my-feature-name
   ```

4. **Merge feature branch to main:**
   - Migration is already in production
   - Code can safely use new schema
   - Vercel deploys the code

#### Option B: Breaking Migrations

If your migration breaks existing code (removes columns, changes types, etc.):

1. **Create migration in feature branch:**

   ```bash
   npm run db:migrate remove_old_column
   ```

2. **Test locally:**

   ```bash
   npm run db:reset
   ```

3. **Merge feature branch to main FIRST:**
   - Code is deployed but may have errors
   - Migration is included in the merge

4. **Immediately push migration to production:**
   ```bash
   git checkout main
   git pull origin main
   npm run db:push  # Apply migration
   npm run db:types:remote  # Update types
   git add src/shared/types/database.types.ts
   git commit -m "chore: update types after migration"
   git push origin main
   ```

**Best Practice:** Prefer Option A (backward-compatible) whenever possible.

## 🚀 Deployment Workflow

### Vercel Deployment Types

Vercel creates **two types of deployments**:

#### 1. Preview Deployments (Feature Branches/PRs)

**When**: Every push to a feature branch or PR
**URL**: `https://grid-xxxxx-johnravns-projects.vercel.app` (unique per branch)
**Purpose**: Test changes before merging to production
**Environment**: Uses Preview environment variables (or Production if not set)

**Benefits**:

- ✅ Test changes safely
- ✅ Share with team for feedback
- ✅ Catch issues before production
- ✅ No risk to production site

#### 2. Production Deployment (Main Branch)

**When**: Every merge/push to `main` branch
**URL**: `https://gridsolutions.app` (your custom domain)
**Purpose**: Live production site
**Environment**: Uses Production environment variables

**Process**:

1. Vercel automatically detects the push to `main`
2. Builds the application
3. Deploys to gridsolutions.app
4. Uses environment variables from Vercel dashboard (Production)

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

3. **Merge to main:**

   ```bash
   git checkout main
   git merge feature/my-feature-name
   git push origin main
   ```

4. **Monitor Vercel deployment:**
   - Check Vercel dashboard for build status
   - **Preview**: Test on preview URL (e.g., `grid-xxxxx.vercel.app`)
   - **Production**: Verify deployment at gridsolutions.app (after merging to main)

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

**Preview Environment (for feature branches):**

- Set the same values in **Vercel → Settings → Environment Variables → Preview**
- Or use a separate staging Supabase project if you have one

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

Before merging to `main`:

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

Before merging to main:

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

## 📝 Pull Request Workflow

### Creating a Pull Request

1. **Push feature branch:**

   ```bash
   git push origin feature/my-feature-name
   ```

2. **Create PR on GitHub:**
   - Title: Clear description of changes
   - Description: Include migration details if applicable
   - Link to related issues

3. **Review checklist:**
   - [ ] Migrations tested locally
   - [ ] Types updated
   - [ ] Code follows project patterns
   - [ ] No breaking changes (or documented)

4. **Merge PR:**
   - Squash and merge (recommended for clean history)
   - Or merge commit (preserves branch history)

### PR Template (Optional)

Create `.github/pull_request_template.md`:

```markdown
## Description

Brief description of changes

## Database Changes

- [ ] No database changes
- [ ] Migration created: `YYYYMMDDHHMMSS_description.sql`
- [ ] Migration tested locally
- [ ] Migration pushed to production (if backward-compatible)
- [ ] Types updated

## Testing

- [ ] Tested locally
- [ ] Tested with production data (if applicable)
- [ ] RLS policies verified

## Checklist

- [ ] Code follows project patterns
- [ ] Types updated
- [ ] No console errors
- [ ] Environment variables documented
```

## 🎯 Best Practices

### Do's ✅

- Always test migrations locally before pushing
- Push backward-compatible migrations before merging code
- Update TypeScript types after schema changes
- Use feature branches for all changes
- Keep `main` branch always deployable
- Document breaking changes in PR descriptions

### Don'ts ❌

- Never push breaking migrations without deploying code first
- Never skip local testing
- Never commit `.env.local` files
- Never make schema changes in Supabase Dashboard without migrations
- Never merge to `main` with failing tests
- Never skip updating TypeScript types

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

**Remember**: When in doubt, test locally first, then test in a feature branch, and only merge to main when everything is verified!
