# Grid

Internal ops app for production companies (built for **Ekte Lyd AS**). Production: [gridsolutions.app](https://gridsolutions.app).

Grid is a multi-company React + Supabase app for planning jobs, booking crew/equipment/transport, quoting and invoicing (Conta), tracking Accounting on each job, and rolling numbers up in Reporting.

App version lives in `src/app/config/releaseNotes.ts` (`APP_VERSION`).

## Product areas

| Area | What it does |
| ---- | ------------ |
| **Home** | Attention band (conflicts, ready-to-invoice, ready-to-verify Accounting), week overview |
| **Jobs** | Job list + inspector: bookings, offers, invoice, **Accounting** (ledger, Conta suggestions / invoice lines, verify) |
| **Calendar** | Company schedule for jobs, crew, and resources |
| **Crew** | People, roles, rates; freelancers can store **org number** for Conta expense matching |
| **Inventory / Vehicles** | Stock, groups, fleet; booking against jobs |
| **Customers** | Customer records and Conta customer linking |
| **Reporting** | Job / customer profitability, utilization, monthly trends; charts/KPIs use **verified** Accounting |
| **Logging** | Time entries |
| **Matters** | Internal notes / discussion |
| **Company** | Company profile, rates, expansions (Conta org), logs |
| **Profile / Super** | Personal settings; superuser company/user tools |

### Accounting & Conta (high level)

- Job **Accounting** tab: confirm income/expenses into `job_money_items`, Conta supplier-ledger suggestions, Conta sales invoice panel, transport km cost, lead **Verified** control.
- **Reporting** uses verified jobs for charts/KPIs; Incomplete / Not verified KPI cards flag fill-in and paid/invoiced unverified queues.
- Conta API client: `src/shared/api/conta/`. Setup notes: `ENVIRONMENT_SETUP.md`, Conta README under `src/shared/api/conta/README.md`.

## Stack (short)

React 19 + TypeScript + Vite · TanStack Query / Router · Radix Themes · Supabase (Postgres, Auth, RLS, Storage) · Vercel.

## Environments

| Env | Use |
| --- | --- |
| **Prod** | `main` → Vercel Production → [gridsolutions.app](https://gridsolutions.app) · Prod Supabase only |
| **Dev** | Hosted Dev Supabase · cloud agents / `npm run db:switch:dev` · Preview env must **not** use Prod |
| **Preview** | Feature branches / PRs → Vercel Preview URLs |

Details: `ENVIRONMENT_SETUP.md`, `DEPLOYMENT_WORKFLOW.md`, `VERCEL_DEPLOYMENTS.md`.

## Day-to-day (agents & internal)

Prefer **hosted Dev** over local Docker unless you intentionally need Docker.

```bash
npm install
npm run db:switch:dev          # point local tooling at Dev
npm run dev                    # http://localhost:3000 (typical)
npm run check                  # prettier + eslint --fix
npm run test
npm run build:check            # required before merge to main
```

Database:

```bash
npm run db:migrate descriptive_name   # create migration file
npm run db:push:dev                   # apply to Dev (when intent is clear)
npm run db:types:dev                  # regenerate types from Dev
# Prod only when explicitly asked:
CONFIRM_PROD_PUSH=1 npm run db:push:prod
npm run db:types:prod
```

Never use bare `npm run db:push`. Never push Prod schema unless John asks. Full rules: `AGENTS.md`, `CONTRIBUTING.md`, `supabase/migrations/README.md`, `supabase/DEVELOPMENT_WORKFLOW.md`.

## Ship path

```
Issue → feature branch (cursor/…) → Preview
  → (ask) push branch / PR
  → (ask to ship) check + test + build:check → merge to main → Production
```

See `GITHUB_ISSUES.md` and `.cursor/rules/git-workflow.mdc`. Do not commit or push unless asked; do not merge `main` unless asked to ship.

## Docs map

| Doc | Topic |
| --- | ----- |
| `AGENTS.md` | Hard gates for AI agents |
| `ENVIRONMENT_SETUP.md` | Secrets, Dev vs Prod |
| `DEPLOYMENT_WORKFLOW.md` | Vercel + migration timing |
| `CONTRIBUTING.md` | Migrations + RLS |
| `GITHUB_ISSUES.md` | Issues / branches / commits |
| `docs/TESTING.md` | Tests |
| `QUICK_START.md` | Short setup notes |

Private — all rights reserved. Built for Ekte Lyd AS.
