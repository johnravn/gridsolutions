# Development Workflow

## Daily Development Process

### 1. Start Your Day

```bash
npm run supabase:start      # Start local Supabase
npm run db:switch:local     # Use local database
npm run dev                 # Start dev server
```

### 2. Make Database Changes

**Option A: Create Migration (Recommended)**

```bash
# Create new migration
npm run db:migrate add_feature_name

# Edit the file in supabase/migrations/YYYYMMDDHHMMSS_add_feature_name.sql
# Write your SQL changes

# Test locally
npm run db:reset            # Applies all migrations fresh

# If good, push to remote
npm run db:push

# Update TypeScript types
npm run db:types:remote
```

**Option B: Use Supabase Studio GUI**

```bash
# 1. Open http://127.0.0.1:54323
# 2. Make changes in the GUI
# 3. Capture as migration:
npm run db:diff capture_gui_changes
# 4. Review the generated migration
# 5. Push to remote: npm run db:push
```

### 3. Git Workflow

Work on a **feature branch** from `main`. Track work with GitHub issues. See `GITHUB_ISSUES.md`.

```bash
git checkout main
git pull origin main
git checkout -b cursor/add-new-feature

# Make changes, then (only when John asks):
git add .
git commit -m "$(cat <<'EOF'
Add new feature

Closes #142
EOF
)"
git push -u origin HEAD
# Optional PR for Preview; merge to main only when John asks to ship
```

## Deployment Workflow

### With Vercel Auto-Deploy

1. **Feature branch Preview, then ship `main` when asked:**

   ```bash
   git checkout main
   git pull origin main
   git checkout -b cursor/add-feature
   # Make changes, test locally / on Dev
   git commit -m "$(cat <<'EOF'
   Add feature

   Closes #142
   EOF
   )"
   git push -u origin HEAD
   # Vercel Preview from the feature branch
   # When John asks to ship: quality gates → merge → git push origin main
   ```

### Migration Deployment

**Important:** Migrations must be applied to the target database BEFORE code that needs them is deployed. Prefer `db:push:dev` while iterating; Prod only when John asks (`CONFIRM_PROD_PUSH=1 npm run db:push:prod`). Never bare `npm run db:push`.

```bash
# 1. Push migrations to hosted Dev
npm run db:push:dev

# 2. Verify migrations applied
# Check Supabase dashboard or run queries

# 3. Promote to Prod when John asks, then ship code via merge to main
CONFIRM_PROD_PUSH=1 npm run db:push:prod
git push -u origin HEAD
# Merge to main / git push origin main only when John asks to ship
```

## Best Practices

### ✅ DO

- **Test migrations locally first:** `npm run db:reset`
- **Push migrations before code:** Database schema must exist before app uses it
- **Keep `main` deployable:** Merge only when quality gates pass and John asks to ship
- **Commit migrations with code:** They're part of your codebase
- **Update types after migrations:** `npm run db:types:dev` / `db:types:prod`

### ❌ DON'T

- **Don't push untested migrations:** Always test locally first
- **Don't deploy code before migrations:** Schema must exist first
- **Don't edit applied migrations:** Create new ones instead
- **Don't skip migration files:** All changes should be in migrations

## Complete Workflow Example

```bash
# 1. Start local development
npm run supabase:start
npm run db:switch:local
npm run dev

# 2. Confirm or create a GitHub issue, branch from main
git pull origin main
git checkout -b cursor/add-user-profiles

# 3. Make database changes
npm run db:migrate add_user_profiles
# Edit migration file...

# 4. Test locally
npm run db:reset
# Test your app works with new schema

# 5. Update types
npm run db:types

# 6. Write code that uses new schema
# ... code changes ...

# 7. Commit everything and push the feature branch (when John asks)
git add .
git commit -m "$(cat <<'EOF'
Add user profiles feature

Closes #142
EOF
)"
git push -u origin HEAD
# Vercel Preview from the feature branch; merge to main only when John asks to ship

# 8. If you have not already: push migrations to Dev before Preview; Prod before ship
#    npm run db:push:dev && npm run db:types:dev
#    CONFIRM_PROD_PUSH=1 npm run db:push:prod && npm run db:types:prod
```

## Migration Timing

**Critical:** Migrations must be applied to the production database BEFORE Vercel deploys new production code that needs them.

**Safe approach:**

1. Push migrations → hosted Dev (`db:push:dev`), verify
2. Promote to Prod when John asks (`CONFIRM_PROD_PUSH=1 npm run db:push:prod`)
3. Merge/push `main` → Vercel Production

## Quick Reference

```bash
# Local development
npm run supabase:start
npm run db:switch:local
npm run dev

# Create migration
npm run db:migrate name

# Test migration (Docker)
npm run db:reset

# Deploy migration
npm run db:push:dev
npm run db:types:dev
# CONFIRM_PROD_PUSH=1 npm run db:push:prod

# Git workflow
git checkout main
git pull origin main
git checkout -b cursor/short-description
# ... work ...
git push -u origin HEAD
# Merge to main / git push origin main only when John asks to ship
```
