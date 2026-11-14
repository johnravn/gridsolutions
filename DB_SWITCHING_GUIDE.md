# Database Switching Guide

## Commands

```bash
npm run db:switch:dev      # Hosted Dev (primary)
npm run db:switch:local    # Docker (optional)
npm run db:switch:prod     # Hosted Prod (rare)
npm run db:switch:remote   # Alias for prod (legacy)
npm run db:switch:status
```

## How it works

Profile files (all gitignored):

| File | Target |
| --- | --- |
| `.env.dev.db` | Hosted Dev |
| `.env.local.db` | Local Docker |
| `.env.remote.db` | Hosted Prod (filename kept for compatibility) |

Switching updates **only** Supabase keys in `.env.local` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_PROJECT_REF`, `SUPABASE_SERVICE_ROLE_KEY`) and preserves other vars.

First run scaffolds a template if the profile is missing — paste real keys from the Dashboard (never invent them; never commit the profile).

## Typical workflows

### Day-to-day (hosted Dev)

```bash
npm run db:switch:dev
npm run supabase:link:dev
npm run dev
# After a migration (when John authorizes):
npm run db:push:dev
npm run db:types:dev
```

### Optional Docker

```bash
npm run supabase:start
npm run db:switch:local
npm run dev
```

### Promote to Prod (John only)

```bash
npm run supabase:link:prod
CONFIRM_PROD_PUSH=1 npm run db:push:prod
npm run db:types:prod
```

## What gets preserved

Non-Supabase vars in `.env.local` (Maps, Conta toggles, etc.) are kept across switches.

## Related

- `.env.example` — committed template
- `ENVIRONMENT_SETUP.md` — Vercel + Cursor secrets
- `supabase/DEVELOPMENT_WORKFLOW.md` — migration habits
