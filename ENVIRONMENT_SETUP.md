# Environment Variables Setup Guide

This guide explains how to configure environment variables for local development and production deployment.

## Quick answer

| Target                      | Where                                                      | URL                                        |
| --------------------------- | ---------------------------------------------------------- | ------------------------------------------ |
| **Hosted Dev** (preferred)  | `.env.dev.db` → `npm run db:switch:dev`                    | `https://<dev-ref>.supabase.co`            |
| **Local Docker** (optional) | `.env.local.db` → `npm run db:switch:local`                | `http://127.0.0.1:54321`                   |
| **Hosted Prod**             | Vercel Production + `.env.remote.db` for rare local checks | `https://tlpgejkglrgoljgvpubn.supabase.co` |

Vite reads **`.env.local`** (gitignored). Switch scripts rewrite only the Supabase keys in that file.

## File structure

```
.env.example        # Template (committed)
.env.local          # Active target Vite reads (NOT committed)
.env.dev.db         # Hosted Dev profile (NOT committed)
.env.remote.db      # Hosted Prod profile (NOT committed; legacy name)
.env.local.db       # Docker profile (NOT committed)
Vercel Dashboard    # Production env only → Prod project
```

## Hosted Dev (recommended)

1. John creates the Dev project in the same org as Prod (see plan / setup status doc).
2. Dashboard → **Project Settings → API** — copy Project URL, `anon` key, `service_role` (server only), project ref.
3. Create `.env.dev.db` (or run `npm run db:switch:dev` once to scaffold placeholders):

   ```env
   VITE_SUPABASE_URL=https://YOUR_DEV_REF.supabase.co
   VITE_SUPABASE_ANON_KEY=paste-from-dashboard
   SUPABASE_PROJECT_REF=YOUR_DEV_REF
   # SUPABASE_SERVICE_ROLE_KEY=paste-service-role-for-scripts-only
   ```

4. Activate and run:

   ```bash
   npm run db:switch:dev
   npm run supabase:link:dev
   npm run dev
   ```

## Local Docker (optional)

```bash
npm run supabase:start
npm run db:status          # copy anon key
npm run db:switch:local
npm run dev
```

## Connecting to Prod from a laptop (rare)

Use only for intentional Prod checks — **not** the agent default.

```bash
# Fill .env.remote.db from Prod Settings → API
npm run db:switch:prod     # alias: db:switch:remote
```

⚠️ Prefer Dev for migrations and everyday work.

## Vercel / Production

Set these for **Production** only (never point Vercel Production at Dev):

```
VITE_SUPABASE_URL=https://tlpgejkglrgoljgvpubn.supabase.co
VITE_SUPABASE_ANON_KEY=...
SUPABASE_PROJECT_REF=tlpgejkglrgoljgvpubn
SUPABASE_SERVICE_ROLE_KEY=...
CRON_SECRET=...
```

Preview env is unused (repo ships on `main` only). If a preview env is ever added, it must use **Dev**, not Prod.

`SUPABASE_SERVICE_ROLE_KEY` is required for serverless routes (`/api/calendar/feed`, Conta cron). `CRON_SECRET` must match Edge secrets + Vault `cron_secret` within that environment. See `docs/EMAIL.md`.

## Cursor Project / cloud agent secrets

Add **Dev-only** secrets (never Prod `service_role` by default):

| Secret                      | Notes                                        |
| --------------------------- | -------------------------------------------- |
| `VITE_SUPABASE_URL`         | Dev project URL                              |
| `VITE_SUPABASE_ANON_KEY`    | Dev anon                                     |
| `SUPABASE_PROJECT_REF`      | Dev ref (must not be `tlpgejkglrgoljgvpubn`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Optional; needed for seed/admin scripts      |
| `SUPABASE_SEED_DEV`         | Set `1` to run `db:seed-test-users` on boot  |
| `SUPABASE_USE_DOCKER`       | Set `1` to force Docker fallback             |

`scripts/cloud-agent-start.sh` uses hosted Dev when those URL/anon secrets are present; otherwise it falls back to Docker. It **exits with an error** if secrets point at Prod.

## Switching

```bash
npm run db:switch:status
npm run db:switch:dev
npm run db:switch:local
npm run db:switch:prod
```

Restart `npm run dev` after switching.

## CLI link and migrations

```bash
npm run supabase:link:dev
npm run db:push:dev                 # agents may when intent is clear; never bare db:push

npm run supabase:link:prod
CONFIRM_PROD_PUSH=1 npm run db:push:prod   # John only
```

Plain `npm run db:push` still runs `supabase db push` against whatever is currently linked — prefer the `:dev` / `:prod` wrappers.

## Verification

- [ ] `.env.local` exists and is gitignored
- [ ] Day-to-day points at **Dev**, not Prod
- [ ] Vercel Production still points at **Prod** only
- [ ] Cursor cloud secrets are Dev-only
- [ ] `npm run db:switch:status` matches the intended target

## Troubleshooting

**Invalid API key** — Confirm URL/key pair from the same project's Dashboard → API.

**Cloud agent refused Prod** — Replace secrets with Dev; do not set Prod `service_role` on agents.

**Docker path** — `npm run supabase:start`, then `npm run db:status`, update `.env.local.db`.

More detail: `DB_SWITCHING_GUIDE.md`, `supabase/DEVELOPMENT_WORKFLOW.md`, `docs/EMAIL.md`.
