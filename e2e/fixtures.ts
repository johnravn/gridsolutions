import { test as base, expect, type Page } from '@playwright/test'

export const TEST_CREDENTIALS = {
  email: process.env.E2E_TEST_EMAIL ?? 'owner@test.grid.local',
  password: process.env.E2E_TEST_PASSWORD ?? 'TestPassword123!',
}

export const TEST_OFFER_TOKENS = {
  sent: 'e2e-test-sent-offer-token',
  accept: 'e2e-test-e2e-accept-offer-token',
  reject: 'e2e-test-reject-offer-token',
  revision: 'e2e-test-revision-offer-token',
}

type AuthedFixtures = {
  authedPage: Page
}

export const test = base.extend<AuthedFixtures>({
  authedPage: async ({ page }, use) => {
    await page.goto('/login')
    await page.getByPlaceholder('you@company.com').fill(TEST_CREDENTIALS.email)
    await page.getByPlaceholder('••••••••').fill(TEST_CREDENTIALS.password)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await page.waitForURL('**/dashboard**', { timeout: 30_000 })
    await use(page)
  },
})

export { expect }
