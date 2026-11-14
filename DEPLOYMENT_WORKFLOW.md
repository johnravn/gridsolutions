# Deployment & Development Workflow

This document outlines the complete workflow for developing, testing, and deploying to production on Vercel with gridsolutions.app.

## Branch Strategy

Work only on **`main`**. No feature branches or pull requests as the review/deploy path. Track work with GitHub issues — see `GITHUB_ISSUES.md`.

- **`main`** — the only ship branch
  - Auto-deploys to Vercel → gridsolutions.app
  - Must stay deployable: verify on hosted Dev (or agent desktop) before pushing
  - Apply backward-compatible migrations to **Dev**, then promote to **Prod** before pushing code that needs them
- Cloud-agent scratch branches (if a runtime forces one) are disposable — not review or deploy

**Review before ship:** agent desktop / Live, or local `npm run dev` on hosted Dev. No staging-branch or PR-preview review.

## Development Workflow

### Starting a New Feature

1. **Issue first, then pull `main`:**

   ```bash
   gh issue list --state open --limit 30
   # or: gh issue create --title "..." --body "..."
   git checkout main
   git pull origin main
   ```

2. **Develop against hosted Dev (preferred):**

   ```bash
   npm run db:switch:dev       # Point app at hosted Dev
   npm run dev                 # Start dev server
   ```

   Optional Docker:

   ```bash
   npm run supabase:start
   npm run db:switch:local
   npm run dev
   ```

3. **Make changes:**
   - Write code
   - Create migrations if needed (see Migration Workflow below)
   - Verify on Dev / agent desktop

4. **Commit and push `main` (only when John asks):**

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

**CRITICAL: Database migrations require special handling**

Never use bare `npm run db:push`. Always `db:push:dev` or `CONFIRM_PROD_PUSH=1 npm run db:push:prod`.

#### Option A: Backward-Compatible Migrations (Recommended)

If your migration is backward-compatible (adds columns, tables, etc. without breaking existing code):

1. **Create migration:**

   ```bash
   npm run db:migrate add_inventory_tracking
   # Edit the migration file
   ```

2. **Apply + verify on hosted Dev:**

   ```bash
   npm run db:push:dev       # when intent is clear
   npm run db:types:dev
   # Review via npm run dev on Dev or agent desktop
   ```

3. **Promote to Prod BEFORE pushing code that uses it (only when John asks):**

   ```bash
   CONFIRM_PROD_PUSH=1 npm run db:push:prod
   npm run db:types:prod     # alias: db:types:remote
   git add supabase/migrations/ src/shared/types/database.types.ts
   git commit -m "$(cat <<'EOF'
   Add inventory tracking tables

   Closes #142
   EOF
   )"
   git push origin main
   ```

   If the schema and app change belong in the same commit, still run Prod `db:push:prod` **before** `git push origin main` when John has asked for both.

#### Option B: Breaking Migrations

If your migration breaks existing code (removes columns, changes types, etc.):

1. **Create migration:**

   ```bash
   npm run db:migrate remove_old_column
   ```

2. **Verify on Dev:**

   ```bash
   npm run db:push:dev
   npm run db:types:dev
   ```

3. **Push code that no longer depends on the old schema, then apply the migration to Prod immediately (only when John asks):**

   ```bash
   git push origin main
   CONFIRM_PROD_PUSH=1 npm run db:push:prod
   npm run db:types:prod
   git add src/shared/types/database.types.ts
   git commit -m "$(cat <<'EOF'
   Update types after migration

   Refs #142
   EOF
   )"
   git push origin main
   ```

**Best Practice:** Prefer Option A (backward-compatible) whenever possible.

## Deployment Workflow

### Vercel Deployment

Every push to `main` deploys **production** at `https://gridsolutions.app`.

**Process**:

1. Vercel automatically detects the push to `main`
2. Builds the application
3. Deploys to gridsolutions.app
4. Uses environment variables from Vercel dashboard (Production) — **must point at Prod**, never Dev

Verify on Dev / agent desktop before asking John to push. This workflow does not use feature-branch preview deployments.

### Manual Deployment Steps

1. **Ensure migrations are applied:**

   ```bash
   npx supabase migration list
   # Dev first when iterating:
   npm run db:push:dev
   # Prod only when John asks:
   CONFIRM_PROD_PUSH=1 npm run db:push:prod
   ```

2. **Update TypeScript types:**

   ```bash
   npm run db:types:prod     # after Prod promote
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

## Environment Variables

### Important: Different configurations

- **Day-to-day / agents** (`.env.local` via `db:switch:dev`): hosted **Dev**
- **Optional Docker**: localhost from `supabase:start`
- **Vercel Production**: hosted **Prod** only — never point Production at Dev
- **Cloud agent secrets**: Dev only — if `SUPABASE_PROJECT_REF` is Prod (`tlpgejkglrgoljgvpubn`), stop

See `ENVIRONMENT_SETUP.md` for full details.

### Local Environment Variables (`.env.local`)

**Preferred — hosted Dev** (`npm run db:switch:dev`):

```env
VITE_SUPABASE_URL=https://YOUR_DEV_REF.supabase.co
VITE_SUPABASE_ANON_KEY=your-dev-anon-key
SUPABASE_PROJECT_REF=YOUR_DEV_REF
```

**Optional — Docker local:**

```env
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=your-local-anon-key
```

**Rare — Prod for local checks** (`npm run db:switch:prod`):

```env
VITE_SUPABASE_URL=https://tlpgejkglrgoljgvpubn.supabase.co
VITE_SUPABASE_ANON_KEY=your-production-anon-key
SUPABASE_PROJECT_REF=tlpgejkglrgoljgvpubn
```

**Never commit `.env.local` to git!**

### Vercel Environment Variables (Production)

Set these in **Vercel Dashboard → Settings → Environment Variables → Production**:

```
VITE_SUPABASE_URL=https://tlpgejkglrgoljgvpubn.supabase.co
VITE_SUPABASE_ANON_KEY=your-production-anon-key
SUPABASE_PROJECT_REF=tlpgejkglrgoljgvpubn
```

**How to find your production values:**

1. Go to https://app.supabase.com
2. Select your **Prod** project
3. Go to **Settings → API**
4. Copy Project URL, anon key, and project ref

**Preview environment:** unused in this workflow (everything ships on `main`). Keep Production variables set to **Prod**.

### Quick Check: Which URL Should You Use?

**Use hosted Dev if:**

- Day-to-day development, agents, migration dry-runs
- Reviewing work before John commits/pushes

**Use Docker localhost if:**

- Optional offline work / no Dev secrets

**Use Prod URL if:**

- Vercel Production env
- Rare local checks against live data (be careful!)

## Pre-Deployment Checklist

Before asking John to push to `main`:

- [ ] Migrations verified on hosted Dev (`db:push:dev` / `db:types:dev`)
- [ ] Migrations promoted to Prod if needed (`CONFIRM_PROD_PUSH=1 npm run db:push:prod`)
- [ ] TypeScript types updated (`db:types:prod` after Prod promote)
- [ ] Reviewed on Dev / agent desktop
- [ ] Quality gates: `npm run check`, `npm run test`, `npm run build:check`
- [ ] No console errors or warnings
- [ ] Environment variables set in Vercel (Prod)
- [ ] Migration files committed to git
- [ ] Types file committed to git

## Testing Workflow

### Dev testing (preferred)

```bash
npm run db:switch:dev
npm run dev
# or review via agent desktop / Live
```

### Optional Docker

```bash
npm run supabase:start
npm run db:switch:local
npm run db:reset   # Docker only — applies migrations + data copy; not Prod→Dev
npm run dev
```

### Rare Prod read check

```bash
npm run db:switch:prod
npm run dev
# Test against production data (be careful!)
```

### Pre-Production Testing

Before asking John to push to `main`:

1. **Verify migration on Dev:**

   ```bash
   npm run db:push:dev
   npm run db:types:dev
   ```

2. **Verify RLS policies:**
   - Test with different user roles
   - Verify superusers can access everything
   - Verify regular users are restricted correctly

3. **Check TypeScript compilation:**

   ```bash
   npm run build:check
   ```

## Rollback Procedure

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

**WARNING: Rolling back migrations is complex and risky!**

1. **Create a new migration to undo changes:**

   ```bash
   npm run db:migrate rollback_previous_migration
   # Write SQL to reverse the previous migration
   ```

2. **Verify on Dev, then Prod when John asks:**

   ```bash
   npm run db:push:dev
   CONFIRM_PROD_PUSH=1 npm run db:push:prod
   ```

**Better approach:** Always make migrations backward-compatible so rollback isn't needed.

## GitHub Issues

See `GITHUB_ISSUES.md`. Work is tracked as issues; commits on `main` use `Closes #N` / `Fixes #N` / `Refs #N`. Do not open pull requests as the ship path.

## Best Practices

### Do's

- Always verify migrations on hosted Dev before Prod promote
- Promote backward-compatible migrations to Prod before pushing code that uses them
- Update TypeScript types after schema changes
- Work on `main` and reference GitHub issues in commits
- Keep `main` always deployable
- Run quality gates before asking John to commit/push
- Document breaking changes in the issue and/or commit body

### Don'ts

- Never push breaking migrations without deploying compatible code first
- Never use bare `npm run db:push`
- Never commit / `git push` / Prod `db:push:prod` unless John asks
- Never commit `.env.local` files
- Never make schema changes in Supabase Dashboard without migrations
- Never push to `main` with failing tests
- Never skip updating TypeScript types
- Never create pull requests or long-lived staging branches as the review path
- Never point Vercel Production at Dev
- Never copy Prod data into Dev without written OK

## Related Documentation

- **Agent rules**: See `AGENTS.md`
- **Migration Workflow**: See `CONTRIBUTING.md`
- **Environment / secrets**: See `ENVIRONMENT_SETUP.md`
- **Supabase Setup**: See `SUPABASE_SETUP.md`
- **Quick Start**: See `QUICK_START.md`
- **Development Workflow**: See `supabase/DEVELOPMENT_WORKFLOW.md`

## Troubleshooting

### Vercel Build Fails

1. Check build logs in Vercel dashboard
2. Verify environment variables are set (Prod)
3. Test build locally: `npm run build:check`
4. Check for TypeScript errors

### Migration Conflicts

1. Check migration status: `npx supabase migration list`
2. Resolve against Dev first (`db:push:dev`)
3. Promote to Prod only when John asks

### Type Errors After Deployment

1. Regenerate types: `npm run db:types:prod`
2. Commit updated types (when John asks)
3. Redeploy (or wait for next deployment)

---

**Remember**: Verify on hosted Dev / agent desktop first. Commit and push `main` only when John asks and quality gates pass.
