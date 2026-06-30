# Testing guide

This project uses a **layered testing strategy**: fast unit tests for business logic, Supabase integration tests for RPCs/RLS, and Playwright E2E tests for critical user flows. All automated tests run against **local Supabase only** — never production.

## Quick reference

| Command                      | What it runs                           | Needs local Supabase? |
| ---------------------------- | -------------------------------------- | --------------------- |
| `npm run test`               | Unit tests (Vitest)                    | No                    |
| `npm run test:watch`         | Unit tests in watch mode               | No                    |
| `npm run test:coverage`      | Unit tests + coverage report           | No                    |
| `npm run test:integration`   | DB integration tests                   | Yes                   |
| `npm run db:seed-test-users` | Seed test users/data                   | Yes                   |
| `npm run test:e2e`           | Playwright browser tests               | Yes (auto-seeds)      |
| `npm run test:e2e:install`   | Install Playwright Chromium (one-time) | No                    |
| `npm run test:all`           | Unit + seed + integration + E2E        | Yes                   |

**Before pushing a feature branch**, run at minimum:

```bash
npm run check
npm run test
npm run build:check
```

Run integration/E2E locally when you touch offers, auth, RLS, or user-facing flows.

---

## Prerequisites

### Always required

- Node.js 22+ (matches CI)
- `npm ci` / `npm install`

### For integration and E2E

1. **Supabase CLI** installed globally (Homebrew or official installer):

   ```bash
   supabase start
   ```

   Migrations apply automatically. For a full local DB with remote data (default for development and migration testing):

   ```bash
   npm run db:reset
   ```

   (`npm run db:reset:with-data` is the same workflow.)

   For a clean schema-only DB (enough for unit/integration tests):

   ```bash
   npm run db:reset:schema-only
   ```

2. **Test seed data** (integration + E2E):
   ```bash
   npm run db:seed-test-users
   ```
   E2E runs this automatically via `e2e/global-setup.mjs`.

### For E2E only (Playwright)

Playwright downloads a Chromium binary (~170 MB). You may need this once:

```bash
npx playwright install chromium
```

If the command appears to hang, it is usually downloading with no progress bar. To see activity:

```bash
DEBUG=pw:install npx playwright install chromium
```

**macOS permission issue:** if `~/Library/Caches/ms-playwright` is owned by `root`, fix it:

```bash
sudo chown -R "$(whoami)" ~/Library/Caches/ms-playwright
```

Or install to a user-owned path:

```bash
export PLAYWRIGHT_BROWSERS_PATH="$HOME/.playwright-browsers"
npx playwright install chromium
```

Try `npm run test:e2e` first — if all tests pass, browser install is already done.

Install Chromium explicitly (same as CI):

```bash
npm run test:e2e:install
```

Run the full local suite (unit + integration + E2E):

```bash
supabase start
npm run test:all
```

`test:all` seeds test users before integration tests. Integration tests also auto-seed via global setup; E2E auto-seeds via Playwright global setup.

Requires local Supabase.

---

## Test layers

```text
Unit (Vitest)          →  pure TS logic, no network
Integration (Vitest)   →  real local Postgres + Supabase RPCs/RLS
E2E (Playwright)       →  real browser + dev server + local Supabase
```

### 1. Unit tests

**Tooling:** [Vitest](https://vitest.dev/) + [Testing Library](https://testing-library.com/docs/react-testing-library/intro/) (for future component tests)

**Config:** `vite.config.ts` → `test` block

**What to test:**

- Pure functions in `src/features/*/utils/`
- Shared helpers in `src/shared/`
- API helpers in `api/` (e.g. ICS formatting in `api/calendar/icsHelpers.ts`)

**What not to test here:**

- Every React/Radix wrapper
- Every TanStack Query factory (test via integration/E2E instead)
- Supabase RLS (integration tests)

**File convention:** co-located `*.test.ts` next to the source file:

```text
src/features/jobs/utils/offerCalculations.ts
src/features/jobs/utils/offerCalculations.test.ts
```

**Run:**

```bash
npm run test              # single run
npm run test:watch        # watch mode while developing
npm run test:coverage     # with V8 coverage report
```

**Test harness** (for component tests when added):

| File                  | Purpose                                             |
| --------------------- | --------------------------------------------------- |
| `src/test/setup.ts`   | jest-dom matchers, RTL cleanup                      |
| `src/test/render.tsx` | `renderWithProviders()` — QueryClient + Radix Theme |
| `src/test/fixtures/`  | Shared test objects (see below)                     |

**Fixture modules** (`src/test/fixtures/`):

| File               | Used by                                    |
| ------------------ | ------------------------------------------ |
| `offers.ts`        | Offer validation, calculations, PDF export |
| `conflicts.ts`     | Overlap / conflict unit tests              |
| `calendar.ts`      | Calendar domain tests                      |
| `recurringJobs.ts` | Recurring job util + integration tests     |
| `logging.ts`       | Logging date range tests                   |
| `latest.ts`        | Latest feed util tests                     |

Path alias: `@test/*` → `src/test/*`

---

### 2. Integration tests

**Tooling:** Vitest with a separate config: `vitest.integration.config.ts`

**Config highlights:**

- Node environment (not jsdom)
- 30s test timeout
- Files in `src/test/integration/**/*.test.ts`
- Disabled unless `RUN_INTEGRATION_TESTS=1` or `CI=true`

**What to test:**

- Supabase RPCs (`public_offer_get`, `public_offer_accept`, …)
- RLS policies (owner vs freelancer, cross-company isolation)
- Postgres triggers/side effects that unit tests cannot see

**Integration test files:**

| File                        | Coverage                                      |
| --------------------------- | --------------------------------------------- |
| `offers.public.test.ts`     | Public offer RPCs, jobs RLS, job_copy         |
| `conflicts.booking.test.ts` | Time periods, reserved items, force-book cols |
| `recurringJobs.test.ts`     | Recurring job CRUD + templates                |
| `inventory.booking.test.ts` | Inventory index, items RLS, reserved items    |

**Run:**

```bash
supabase start
npm run db:seed-test-users
RUN_INTEGRATION_TESTS=1 npm run test:integration
```

**Client helper:** `src/test/integration/supabaseClient.ts` — creates anon/service clients and reads keys from `supabase status -o env`.

---

### 3. E2E tests

**Tooling:** [Playwright](https://playwright.dev/)

**Config:** `playwright.config.ts`

**What happens when you run `npm run test:e2e`:**

1. `e2e/global-setup.mjs` seeds test data
2. Playwright starts `npm run dev` on port 3000 (reuses an existing server if one is running)
3. Supabase URL/anon key are injected from `supabase status -o env`
4. Tests run headless in Chromium

**Current tests** (`e2e/`):

| File                     | Coverage                                                       |
| ------------------------ | -------------------------------------------------------------- |
| `login.spec.ts`          | Sign in → dashboard                                            |
| `jobs.spec.ts`           | Create job, tab navigation, edit title                         |
| `offers.spec.ts`         | Create offer, lock & send, customer accepts, owner sees status |
| `public-offer.spec.ts`   | View public offer, accept, reject, request revision            |
| `inventory.spec.ts`      | Open inventory, search                                         |
| `customers.spec.ts`      | Open customers page                                            |
| `calendar.spec.ts`       | Open calendar page                                             |
| `logging.spec.ts`        | Open logging page                                              |
| `bookings.spec.ts`       | Open bookings tab on a job                                     |
| `vehicles.spec.ts`       | Open vehicles page                                             |
| `crew.spec.ts`           | Open crew page                                                 |
| `company.spec.ts`        | Open company settings                                          |
| `roles.spec.ts`          | Freelancer denied inventory nav                                |
| `recurring-jobs.spec.ts` | Recurring jobs tab (when present)                              |

**Shared helpers:** `e2e/helpers/navigation.ts` — `openJobsPage`, `createDraftJob`, and page openers for inventory, customers, calendar, etc.

**Auth fixture:** `e2e/fixtures.ts` provides `authedPage` — logs in as the test owner before each test that needs it.

**Run:**

```bash
supabase start
npm run test:e2e
```

**Debug visually:**

```bash
npx playwright test --headed
npx playwright test --ui
npx playwright test e2e/login.spec.ts   # single file
```

---

## Test seed data (`db:seed-test-users`)

Script: [`scripts/seed-test-users.mjs`](../scripts/seed-test-users.mjs)

Creates a **deterministic mini world** in local Supabase for integration/E2E. Idempotent (safe to re-run). Uses the **service role** to bypass RLS.

### Users

| Email                        | Password           | Role       |
| ---------------------------- | ------------------ | ---------- |
| `owner@test.grid.local`      | `TestPassword123!` | owner      |
| `employee@test.grid.local`   | `TestPassword123!` | employee   |
| `freelancer@test.grid.local` | `TestPassword123!` | freelancer |

Override owner credentials with env vars:

```bash
E2E_TEST_EMAIL=you@example.com E2E_TEST_PASSWORD=secret npm run db:seed-test-users
```

### Company

- **Grid Test Company** — ID `11111111-1111-4111-8111-111111111111`

### Jobs and offers

| Job                    | Offers                                                   | Purpose                            |
| ---------------------- | -------------------------------------------------------- | ---------------------------------- |
| E2E Test Job           | sent + draft                                             | View offer, reject accept on draft |
| Integration Accept Job | sent (`e2e-test-accept-offer-token`)                     | Integration accept RPC test        |
| E2E Accept Job         | sent (`e2e-test-e2e-accept-offer-token`)                 | Playwright accept flow             |
| E2E Reject Job         | sent (`e2e-test-reject-offer-token`)                     | Reject RPC + E2E reject flow       |
| E2E Revision Job       | sent (`e2e-test-revision-offer-token`)                   | Revision RPC + E2E revision flow   |
| E2E Lock Job           | draft with equipment (`e2e-test-lock-draft-offer-token`) | Lock flow fallback                 |

Sent offers include one equipment line (“Test microphone”) so the public offer page has content to assert on.

A seeded inventory item (`Test Seeded Item`) supports employee vs freelancer permission integration tests.

**Conflict booking fixture** on **Conflict Seed Job** (`14141414-…`): `Test Seeded Item` is reserved for `2026-07-01T08:00:00Z` – `2026-07-01T18:00:00Z` (quantity 1). Use for overlap / force-book integration and E2E tests. Separate from E2E Test Job so `job_copy` tests stay isolated.

Accept offers are on **separate jobs** so accepting one does not block the other (Postgres rejects accept when a newer sent version exists on the same job).

### Supabase CLI note

The seed script uses the **system** `supabase` binary (not `node_modules/.bin/supabase`) so JWT keys match your running local stack. See [`scripts/loadLocalSupabaseEnv.mjs`](../scripts/loadLocalSupabaseEnv.mjs).

---

## CI (GitHub Actions)

Workflow: [`.github/workflows/ci.yml`](../.github/workflows/ci.yml)

| Job         | Command                                                              | Depends on  |
| ----------- | -------------------------------------------------------------------- | ----------- |
| Unit tests  | `npm run test`                                                       | —           |
| Build       | `npm run build:check`                                                | —           |
| Integration | `supabase start` → `db reset` → seed → `test:integration`            | unit        |
| E2E         | `playwright install chromium` → `supabase start` → seed → `test:e2e` | integration |

Runs on every push to `main` and on pull requests.

---

## Where to add new tests

| Change type                        | Add test in                                                 |
| ---------------------------------- | ----------------------------------------------------------- |
| Offer math, validation, formatters | Unit — `src/features/jobs/utils/*.test.ts`                  |
| Conflict overlap / force-book      | Unit — `src/features/conflicts/api/*.test.ts`               |
| Logging date ranges                | Unit — `src/features/logging/lib/*.test.ts`                 |
| Latest feed utils                  | Unit — `src/features/latest/utils/*.test.ts`                |
| Calendar domain transforms         | Unit — `src/features/calendar/components/domain.test.ts`    |
| Permissions / role matrix          | Unit — `src/shared/auth/permissions.test.ts`                |
| Conta sync / customer check        | Unit — `src/shared/conta/`, `src/features/customers/utils/` |
| API cron handlers                  | Unit — `api/cron/*.test.ts`, `api/super/*.test.ts`          |
| Offer editor sections              | Component — `technical-offer-editor/*.test.tsx`             |
| Shared UI (SearchableSelect)       | Component — `src/shared/ui/components/*.test.tsx`           |
| New RPC or RLS rule                | Integration — `src/test/integration/`                       |
| New critical user flow             | E2E — `e2e/*.spec.ts`                                       |
| Calendar ICS formatting            | Unit — `api/calendar/icsHelpers.test.ts`                    |

### Unit test inventory (by feature)

| Area           | Test files                                                                                                                                                                                                             |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **jobs/utils** | `offerCalculations`, `offerValidation`, `offerNumber`, `jobStatusAutoTransition`, `groupBookingQuantity`, `aggregateRecurringJobCrew`, `recurringJobCreateDefaults`, `statusColors`, `contaProjects`, `offerPdfExport` |
| **conflicts**  | `overlapChecks`, `forceBooking`, `equipmentConflictCheck`, `conflictCategories`, `mergeEquipmentConflicts`                                                                                                             |
| **logging**    | `timeEntryRange`                                                                                                                                                                                                       |
| **latest**     | `formatActivityDate`, `groupInventoryActivities`, `activityNavigation`                                                                                                                                                 |
| **calendar**   | `domain`, `freelancerCalendarVisibility`                                                                                                                                                                               |
| **home**       | `dailyInspiration`                                                                                                                                                                                                     |
| **customers**  | `contaCustomerCheck`                                                                                                                                                                                                   |
| **shared**     | `permissions`, `phone`, `generalFunctions`, `fuzzySearch`, `customerSyncCore`, `contaCustomerSyncCron`                                                                                                                 |
| **api**        | `icsHelpers`, `feed`, `sync-conta`, `trigger-conta-sync`                                                                                                                                                               |
| **components** | `TotalsSection`, `EquipmentSection`, `CrewSection`, `TransportSection`, `SearchableSelect`                                                                                                                             |

**Regression rule:** every bug fix in jobs/offers should get a test (unit or integration) that would have caught it.

---

## Coverage philosophy

- No mandatory 80% line-coverage target
- Aim for **full coverage of pure business-logic utils** (`jobs/utils/`, `permissions.ts`)
- Prefer a few **stable E2E scenarios** over many flaky ones
- Add component tests selectively (forms, calculated totals) using `renderWithProviders()`

---

## Troubleshooting

### `npm run test:integration` skips all tests

Set `RUN_INTEGRATION_TESTS=1` or run in CI. Integration tests are opt-in locally to avoid failures when Supabase is not running.

### Seed fails with “legacy HS256 service role key”

Local Supabase JWT keys do not match. Restart Supabase with the system CLI:

```bash
supabase stop && supabase start
npm run db:seed-test-users
```

### Seed fails with “SUPABASE_SERVICE_ROLE_KEY is required”

Supabase is not running. Run `supabase start` first.

### E2E login test cannot find Email field

Login inputs use placeholders, not `<label htmlFor=…>`. Tests use `getByPlaceholder('you@company.com')` — follow that pattern for new auth tests.

### E2E jobs test stays on dashboard after `page.goto('/jobs')`

Use sidebar navigation instead: `page.getByRole('link', { name: 'Jobs' }).click()` — TanStack Router client navigation is more reliable in tests.

### `npx playwright install chromium` freezes

Usually downloading ~170 MB with no output. Wait several minutes or use `DEBUG=pw:install`. See [Prerequisites](#for-e2e-only-playwright) for cache permission fixes.

### Integration accept test fails: “newer version has been sent”

Re-run seed — a previous test accepted the offer, or multiple sent offers exist on the same job. Seed puts accept offers on dedicated jobs to avoid this; re-seed resets state.

---

## Related docs

- [CONTRIBUTING.md](../CONTRIBUTING.md) — migration workflow, PR process
- [DEPLOYMENT_WORKFLOW.md](../DEPLOYMENT_WORKFLOW.md) — preview vs production
- [.cursorrules](../.cursorrules) — quality gates before push
