import { test as base, expect, type Page } from '@playwright/test'

export const TEST_CREDENTIALS = {
  email: process.env.E2E_TEST_EMAIL ?? 'owner@test.grid.local',
  password: process.env.E2E_TEST_PASSWORD ?? 'TestPassword123!',
}

export const ROLE_CREDENTIALS = {
  employee: {
    email: 'employee@test.grid.local',
    password: 'TestPassword123!',
  },
  freelancer: {
    email: 'freelancer@test.grid.local',
    password: 'TestPassword123!',
  },
} as const

export const TEST_OFFER_TOKENS = {
  sent: 'e2e-test-sent-offer-token',
  accept: 'e2e-test-accept-offer-token',
  reject: 'e2e-test-reject-offer-token',
  revision: 'e2e-test-revision-offer-token',
}

type AuthedFixtures = {
  authedPage: Page
  employeePage: Page
  freelancerPage: Page
}

async function loginAs(page: Page, email: string, password: string) {
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible({
    timeout: 15_000,
  })

  // Retry under parallel load: auth + profile fetch can race or briefly fail.
  await expect(async () => {
    if (!page.url().includes('/login')) {
      await page.goto('/login')
      await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible({
        timeout: 10_000,
      })
    }
    await page.getByPlaceholder('you@company.com').fill(email)
    await page.getByPlaceholder('••••••••').fill(password)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await page.waitForURL(/\/(dashboard|complete-profile)(?:\?|$)/, {
      timeout: 20_000,
    })
  }).toPass({ timeout: 60_000 })

  if (/\/complete-profile(?:\?|$)/.test(new URL(page.url()).pathname)) {
    throw new Error(
      'Test user profile is incomplete (missing name/phone). Re-run npm run db:seed-test-users.',
    )
  }
}

export const test = base.extend<AuthedFixtures>({
  authedPage: [
    async ({ page }, use) => {
      await loginAs(page, TEST_CREDENTIALS.email, TEST_CREDENTIALS.password)
      await use(page)
    },
    { timeout: 90_000 },
  ],
  employeePage: [
    async ({ page }, use) => {
      await loginAs(
        page,
        ROLE_CREDENTIALS.employee.email,
        ROLE_CREDENTIALS.employee.password,
      )
      await use(page)
    },
    { timeout: 90_000 },
  ],
  freelancerPage: [
    async ({ page }, use) => {
      await loginAs(
        page,
        ROLE_CREDENTIALS.freelancer.email,
        ROLE_CREDENTIALS.freelancer.password,
      )
      await use(page)
    },
    { timeout: 90_000 },
  ],
})

export { expect }
