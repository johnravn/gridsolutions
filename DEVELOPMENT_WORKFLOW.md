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

**Recommended: Feature Branch Strategy**

```bash
# Create feature branch
git checkout -b feature/new-feature

# Make changes, commit
git add .
git commit -m "Add new feature"

# Push to GitHub
git push origin feature/new-feature

# When ready, merge to main
git checkout main
git merge feature/new-feature
git push origin main
```

**Or: Dev Branch Strategy**

```bash
# Work on dev branch
git checkout dev
# ... make changes ...
git commit -m "Add feature"
git push origin dev

# When ready for production
git checkout main
git merge dev
git push origin main
```

## Deployment Workflow

### With Vercel Auto-Deploy

1. **Work on `dev` branch:**

   ```bash
   git checkout dev
   # Make changes, test locally
   git commit -m "Add feature"
   git push origin dev
   ```

2. **Test on dev deployment** (if Vercel deploys dev branch)

3. **Merge to `main` when ready:**
   ```bash
   git checkout main
   git merge dev
   git push origin main
   # Vercel auto-deploys from main
   ```

### Migration Deployment

**Important:** Migrations must be applied to remote database BEFORE code is deployed.

```bash
# 1. Push migrations to remote Supabase
npm run db:push

# 2. Verify migrations applied
# Check Supabase dashboard or run queries

# 3. Then push code to GitHub
git push origin main
# Vercel deploys with new code that expects new schema
```

## Best Practices

### ✅ DO

- **Test migrations locally first:** `npm run db:reset`
- **Push migrations before code:** Database schema must exist before app uses it
- **Use feature branches:** Keep main stable
- **Commit migrations with code:** They're part of your codebase
- **Update types after migrations:** `npm run db:types:remote`

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

# 2. Create feature branch
git checkout -b feature/user-profiles

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

# 7. Commit everything
git add .
git commit -m "Add user profiles feature"
git push origin feature/user-profiles

# 8. When ready for production:
#    a. Push migrations to remote
npm run db:push
npm run db:types:remote

#    b. Merge to main
git checkout main
git merge feature/user-profiles
git push origin main

#    c. Vercel auto-deploys
```

## Migration Timing

**Critical:** Migrations must be applied to production database BEFORE Vercel deploys new code.

**Safe approach:**

1. Push migrations → Remote Supabase
2. Wait a few seconds
3. Push code → GitHub → Vercel deploys

**Or use Supabase Dashboard:**

- Push migrations manually via dashboard
- Then deploy code

## Quick Reference

```bash
# Local development
npm run supabase:start
npm run db:switch:local
npm run dev

# Create migration
npm run db:migrate name

# Test migration
npm run db:reset

# Deploy migration
npm run db:push
npm run db:types:remote

# Git workflow
git checkout -b feature/name
# ... work ...
git push origin feature/name
git checkout main
git merge feature/name
git push origin main
```
