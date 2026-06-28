import { defineConfig, devices } from '@playwright/test'
import { execSync } from 'node:child_process'

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
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: loadSupabaseEnv(),
  },
})
