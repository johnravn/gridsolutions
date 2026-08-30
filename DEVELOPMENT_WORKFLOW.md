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

Work on `main`. Track work with GitHub issues. See `GITHUB_ISSUES.md`.

```bash
git checkout main
git pull origin main

# Make changes, then:
git add .
git commit -m "$(cat <<'EOF'
Add new feature

Closes #142
EOF
)"
git push origin main
```

Do not create feature branches or pull requests.

## Deployment Workflow

### With Vercel Auto-Deploy

1. **Work on `main`:**

   ```bash
   git checkout main
   git pull origin main
   # Make changes, test locally
   git commit -m "$(cat <<'EOF'
   Add feature

   Closes #142
   EOF
   )"
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
- **Work on `main`:** Keep it deployable; test locally before pushing
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

# 2. Confirm or create a GitHub issue, stay on main
git pull origin main

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

# 7. Commit everything and push main
git add .
git commit -m "$(cat <<'EOF'
Add user profiles feature

Closes #142
EOF
)"
git push origin main

# 8. If you have not already: push migrations to remote before the code push
#    npm run db:push && npm run db:types:remote

# Vercel auto-deploys from main
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
git checkout main
git pull origin main
# ... work ...
git push origin main
```
