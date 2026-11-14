# Project Rules for AI Agents

This project is primarily developed using AI agents. Follow these rules strictly.

## Hard gates

- **Never** `git commit` or `git push` unless John explicitly asks in this conversation. Finishing a task is not permission. See `.cursor/rules/no-unsolicited-ship.mdc`.
- **Never** Prod schema push (`CONFIRM_PROD_PUSH=1 npm run db:push:prod`, or bare `npm run db:push` while linked to Prod) unless John explicitly asks.
- **Never** use bare `npm run db:push` in instructions or as the default push — always `db:push:dev` or `db:push:prod`.
- Agents **may** run `npm run db:push:dev` (and Dev link/types) when the change is clearly what John wants and quality looks good enough. Prefer asking if ambiguous.
- All schema changes via migration files + RLS. Never schema-only in the Supabase Dashboard.
- Vercel Production → **Prod** DB only. Cloud agent secrets → **Dev** only.
- No Prod→Dev data copy / `db:copy-*` into Dev without written OK.

## Cloud agents vs shipping on main

Grid’s **ship path** is `main` only (issues → commit on main → push main → Vercel Production).
Do not open pull requests or ask John to merge feature branches as the default review path.

If a cloud-agent runtime forces a working branch:

- Use it only as disposable scratch for that run.
- Do **not** treat the branch/PR as the review or deploy mechanism.
- Do **not** merge to `main` or push `main` unless John explicitly asks.
- Hand off: summary + desktop/Live and/or “pull branch / apply locally against Dev” — John reviews via agent desktop or `npm run dev` on hosted Dev.

Never create a long-lived staging branch or Supabase Branching preview as the default review env.

## Cloud agent secrets

Cloud agents must use hosted Dev secrets. See `ENVIRONMENT_SETUP.md` (Cursor secrets). If `SUPABASE_PROJECT_REF` is Prod (`tlpgejkglrgoljgvpubn`), **stop** — fix secrets; do not continue against Prod.

## Database Migration Workflow

**ALL database schema changes MUST go through the migration workflow. Never make changes directly in the Supabase Dashboard.**

### Required steps for ANY database change

1. **Create migration**: `npm run db:migrate descriptive_name`
2. **Write SQL** in the generated migration file (RLS + idempotent policies)
3. **Apply to hosted Dev**: `npm run db:push:dev` when intent is clear and quality is good enough (or stop for John if ambiguous)
4. **Regenerate types from Dev** (while iterating): `npm run db:types:dev`
5. **Promote to Prod** only when John asks: `CONFIRM_PROD_PUSH=1 npm run db:push:prod`
6. **After Prod promote**: `npm run db:types:prod` (alias: `db:types:remote`) so committed types match production

Optional offline: Docker + `npm run db:reset` — **not** the cloud-agent default when Dev secrets exist. Do not copy Prod data into Dev.

Never use bare `npm run db:push` in instructions — always `:dev` or `:prod`.

### RLS (Row Level Security) Requirements

- **Every table MUST have RLS enabled**: `ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;`
- **Every table MUST have RLS policies** for SELECT, INSERT, UPDATE, DELETE
- **Always use idempotent SQL**: `DROP POLICY IF EXISTS` before creating policies
- **Follow the pattern**: Check `company_users` for company-scoped data, `profiles.user_id` for personal data, allow superusers

### Migration Best Practices

- ✅ One logical change per migration
- ✅ Use descriptive names (e.g., `add_rls_to_addresses`)
- ✅ Verify on hosted Dev before Prod promote
- ✅ Use `IF EXISTS` / `IF NOT EXISTS` for idempotency
- ❌ Never edit applied migrations (create new one instead)
- ❌ Never skip RLS policies
- ❌ Never make schema changes in Dashboard without capturing as migration
- ❌ Never use bare `npm run db:push`

## Code Style

- Use TypeScript for all new code
- Follow existing patterns in the codebase
- Use TanStack Query for data fetching
- Use Radix UI Themes for components

### TypeScript Strictness (tsconfig is strict — these break the build)

`tsconfig.json` enables `verbatimModuleSyntax`, `noUnusedLocals`, `noUnusedParameters`, and `strict`. Common agent mistakes:

- **Type-only imports must use `import type`** (because of `verbatimModuleSyntax`):

  ```ts
  // ❌ BAD — fails at build time
  import { Matter } from '../types'

  // ✅ GOOD
  import type { Matter } from '../types'

  // ✅ GOOD — mixed
  import { createMatter, type Matter } from '../api/queries'
  ```

- **No unused imports, variables, or parameters.** Prefix intentionally-unused params with `_` (e.g. `(_event, value) => ...`).
- **No implicit `any`**, no `// @ts-ignore` without a justification comment.

### Path Aliases — never use long relative imports

Aliases are configured in both `tsconfig.json` and `vite.config.ts`:

| Alias         | Resolves to      |
| ------------- | ---------------- |
| `@app/*`      | `src/app/*`      |
| `@shared/*`   | `src/shared/*`   |
| `@features/*` | `src/features/*` |

```ts
// ❌ BAD
import { supabase } from '../../../shared/api/supabase'

// ✅ GOOD
import { supabase } from '@shared/api/supabase'
```

Within the **same feature**, relative imports (`../types`, `./components/Foo`) are fine. Crossing feature or layer boundaries → use the alias.

### Feature Folder Convention (`src/features/<feature>/`)

Every feature follows the same shape. Don't invent new structures:

```
src/features/<feature>/
  api/         # TanStack Query options + Supabase calls (queries.ts, fooQueries.ts, ...)
  components/  # React components (dialogs/, tabs/, etc. as sub-folders)
  hooks/       # Custom hooks (optional)
  pages/       # Route-level page components
  types.ts     # Feature-local types
```

When adding a new feature, mirror an existing one (e.g. `src/features/matters/`). Data fetching always lives in `api/` as TanStack Query option factories — don't call `supabase` from components directly.

## Quality Gates

Run quality gates before asking John to commit or push `main` (and always before you push `main` when asked):

```bash
npm run check        # prettier --write + eslint --fix (auto-fixes most issues)
npm run test         # vitest unit tests
npm run build:check  # vite build + tsc (catches type errors CI will reject)
```

- `npm run build:check` is the single most important gate — Vercel runs the equivalent and will fail the production build if `tsc` errors exist. Run it whenever you've touched non-trivial TypeScript.
- `npm run check` is safe to run on every change; it auto-fixes formatting and lint.
- If `npm run check` reports lint errors it couldn't auto-fix, **fix them before committing** — don't silence them.

## GitHub & Deployment Workflow

**Work on `main`. Track work with GitHub issues. Do not use pull requests or feature branches.**

See `.cursor/rules/git-workflow.mdc` for the full rule. Summary:

1. **Issue first**: reuse an open GitHub issue, or `gh issue create` if none exists
2. **Stay on `main`**: `git pull origin main` before starting
3. **Make changes**: Code; verify on hosted Dev (`db:switch:dev` → `npm run dev`) or agent desktop
4. **Create migration** (if needed): `npm run db:migrate descriptive_name`, then `db:push:dev` when intent is clear
5. **Stop here** unless John asks to commit, push GitHub, or promote to Prod
6. **If asked to push Prod** (and the migration is backward-compatible): `CONFIRM_PROD_PUSH=1 npm run db:push:prod` before pushing code that depends on it
7. **If asked to commit**: include `Closes #N` / `Fixes #N` / `Refs #N` — large commits are fine
8. **If asked to push GitHub**: `git push origin main` — deploys production (`gridsolutions.app`)

### Vercel Deployments

- **`main`** → Production (`gridsolutions.app`) on every push
- Review via agent desktop / local Dev — there is no PR preview or staging-branch review step

### Git Best Practices

- ✅ One GitHub issue per piece of work (search before creating)
- ✅ Every commit references the issue it tackles
- ✅ Run quality gates before asking John to push `main`
- ✅ Document database changes in the issue and/or commit body
- ❌ Never commit or `git push` unless John explicitly asks
- ❌ Never Prod `db:push` / `db:push:prod` unless John explicitly asks
- ❌ Never create pull requests or long-lived feature/staging branches
- ❌ Never commit without an issue reference

## Documentation

- **Git & issues**: See `GITHUB_ISSUES.md` and `.cursor/rules/git-workflow.mdc`
- **Deployment Workflow**: See `DEPLOYMENT_WORKFLOW.md` — Vercel deployment, migration timing
- **Vercel Deployments**: See `VERCEL_DEPLOYMENTS.md`
- **Environment / secrets**: See `ENVIRONMENT_SETUP.md`
- **Migration Workflow**: See `CONTRIBUTING.md`
- **Supabase Development**: See `supabase/DEVELOPMENT_WORKFLOW.md`
- **Migrations Directory**: See `supabase/migrations/README.md`

## When Making Database Changes

**Before writing any SQL that modifies schema:**

1. Check `CONTRIBUTING.md` for the complete workflow
2. Check `supabase/migrations/README.md` for RLS patterns
3. Look at existing migrations for examples (e.g., `20250119000000_add_invoice_tracking.sql`)
4. Always create a migration file — never modify schema directly

## When Making Code Changes

**Before writing any code:**

1. Confirm or create a GitHub issue (`gh issue list` / `gh issue create`)
2. Work on `main` (`git pull origin main`)
3. Make your changes
4. Verify on hosted Dev (`npm run db:switch:dev` → `npm run dev`) or via agent desktop
5. Do **not** commit or push unless John explicitly asks. If they do: commit with `Closes #N` (or `Refs #N` if incomplete), then push only if they also asked to push.

---

**Remember**:

- Database: migration files → Dev (`db:push:dev` / `db:types:dev`) → Prod only with explicit ask (`CONFIRM_PROD_PUSH=1 npm run db:push:prod`).
- Code: work on `main`, tie work to GitHub issues. Do not commit or push unless asked.
