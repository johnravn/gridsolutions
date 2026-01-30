## Description

Brief description of changes in this PR.

## Type of Change

- [ ] New feature
- [ ] Bug fix
- [ ] Database migration
- [ ] Refactoring
- [ ] Documentation

## Database Changes

- [ ] No database changes
- [ ] Migration created: `YYYYMMDDHHMMSS_description.sql`
- [ ] Migration tested locally (`npm run db:reset`)
- [ ] Migration pushed to production (if backward-compatible)
- [ ] Types updated (`npm run db:types:remote`)
- [ ] Types file committed

**Migration Details** (if applicable):

- Migration file: `supabase/migrations/YYYYMMDDHHMMSS_description.sql`
- Backward compatible: Yes/No
- RLS policies added: Yes/No

## Testing

- [ ] Tested locally
- [ ] Tested with local database
- [ ] Tested with production database (read-only)
- [ ] RLS policies verified with different user roles
- [ ] No console errors or warnings
- [ ] Build succeeds (`npm run build`)

## Checklist

- [ ] Code follows project patterns
- [ ] TypeScript types updated (if schema changed)
- [ ] No breaking changes (or clearly documented)
- [ ] Environment variables documented (if new ones added)
- [ ] Migration files committed
- [ ] Ready to merge to `main`

## Deployment Notes

Any special considerations for deployment:

- [ ] Migration needs to be pushed before merging
- [ ] Migration needs to be pushed after merging
- [ ] No special deployment steps needed

## Related Issues

Closes #(issue number)

---

**Before merging, ensure:**

1. All migrations are tested and pushed (if backward-compatible)
2. TypeScript types are updated and committed
3. Build succeeds without errors
4. All checklist items are completed
