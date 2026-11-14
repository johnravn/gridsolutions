# Quick Start

## Daily Startup (preferred: hosted Dev)

```bash
npm run db:switch:dev       # Point app at hosted Dev
npm run dev                 # Start Vite dev server
```

Cloud agents: secrets should already target Dev. If `SUPABASE_PROJECT_REF` is Prod (`tlpgejkglrgoljgvpubn`), stop and fix secrets.

## Optional: Docker local

```bash
npm run supabase:start      # Start Supabase (Docker)
npm run db:switch:local     # Switch to local DB
npm run dev                 # Start Vite dev server
```

## URLs

- **App:** http://localhost:3000
- **Supabase Studio (Docker only):** http://127.0.0.1:54323
- **API (Docker only):** http://127.0.0.1:54321

## Get Keys / Status

```bash
npm run db:status           # Local Docker keys when using Docker
npm run db:switch:status    # Which DB the app points at
```

## Switch DB

```bash
npm run db:switch:dev       # Hosted Dev (default)
npm run db:switch:local     # Docker (optional)
npm run db:switch:prod      # Hosted Prod (rare)
# db:switch:remote is a legacy alias for prod
```

## Schema / types (Dev-first)

```bash
npm run db:migrate descriptive_name
npm run db:push:dev         # when intent is clear — never bare db:push
npm run db:types:dev
# Prod promote only when John asks:
# CONFIRM_PROD_PUSH=1 npm run db:push:prod
# npm run db:types:prod
```

## Review before ship

John reviews via **agent desktop / Live** or local `npm run dev` on Dev. There is no PR preview or staging-branch review path. Ship is commit + `git push origin main` only when John asks.

## Stop

```bash
Ctrl+C                    # Stop dev server
npm run supabase:stop     # Stop Docker Supabase (if started)
```
