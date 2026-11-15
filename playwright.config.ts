import { defineConfig, devices } from '@playwright/test'
import { execSync } from 'node:child_process'
import os from 'node:os'

/** Slim CI suite: @ci tags + mobile-pwa only. Full suite: local or E2E_FULL=1. */
const slimCi =
  process.env.E2E_CI === '1' ||
  (!!process.env.CI && process.env.E2E_FULL !== '1')

function resolveWorkerCount(): number {
  const fromEnv = process.env.PLAYWRIGHT_WORKERS
  if (fromEnv) {
    const parsed = Number.parseInt(fromEnv, 10)
    if (Number.isFinite(parsed) && parsed > 0) return parsed
  }
  if (process.env.CI) return 2
  return Math.min(4, Math.max(2, os.cpus().length))
}

function loadSupabaseEnv(): Record<string, string> {
  const env: Record<string, string> = {}
  const pathEntries = (process.env.PATH ?? '').split(':').filter(Boolean)
  const filteredPath = pathEntries
    .filter((entry) => !entry.includes('node_modules/.bin'))
    .join(':')

  try {
    const output = execSync('supabase status -o env 2>/dev/null', {
      encoding: 'utf-8',
      cwd: process.cwd(),
      env: { ...process.env, PATH: filteredPath || process.env.PATH },
    })
    for (const line of output.split('\n')) {
      const match = line.match(/^([A-Z_]+)="([^"]*)"$/)
      if (!match) continue
      const [, key, value] = match
      if (key === 'API_URL') env.VITE_SUPABASE_URL = value
      if (key === 'ANON_KEY') env.VITE_SUPABASE_ANON_KEY = value
    }
  } catch {
    // Fall back to process env when Supabase CLI is unavailable.
  }

  env.VITE_SUPABASE_URL ??=
    process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? ''
  env.VITE_SUPABASE_ANON_KEY ??=
    process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? ''

  return env
}

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.mjs',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  // One retry in CI: enough for transient flakes without 3× long journeys.
  retries: process.env.CI ? 1 : 0,
  workers: resolveWorkerCount(),
  // Login fixture + createDraftJob routinely exceed the 30s default under 4 workers.
  timeout: 90_000,
  reporter: [['list']],
  use: {
    // Match vite `server.host` (127.0.0.1). `localhost` can prefer ::1 on macOS
    // and fail or flap when the dev server is IPv4-only.
    baseURL: 'http://127.0.0.1:3000',
    trace: 'on-first-retry',
  },
  projects: slimCi
    ? [
        {
          name: 'chromium',
          use: { ...devices['Desktop Chrome'] },
          grep: /@ci\b/,
          testIgnore: /mobile-pwa\.spec\.ts/,
        },
        {
          // Mobile coverage in CI is the dedicated PWA layout smoke only —
          // not a second full pass of desktop journeys on Pixel 5.
          name: 'mobile-chrome',
          use: { ...devices['Pixel 5'] },
          testMatch: /mobile-pwa\.spec\.ts/,
        },
      ]
    : [
        {
          name: 'chromium',
          use: { ...devices['Desktop Chrome'] },
        },
        {
          name: 'mobile-chrome',
          use: { ...devices['Pixel 5'] },
        },
      ],
  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: loadSupabaseEnv(),
  },
})
