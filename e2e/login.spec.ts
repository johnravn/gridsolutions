import { test, expect } from './fixtures'

test.describe('Login', () => {
  test('signs in and lands on dashboard', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()

    await page
      .getByPlaceholder('you@company.com')
      .fill(process.env.E2E_TEST_EMAIL ?? 'owner@test.grid.local')
    await page
      .getByPlaceholder('••••••••')
      .fill(process.env.E2E_TEST_PASSWORD ?? 'TestPassword123!')
    await page.getByRole('button', { name: 'Sign in' }).click()

    await page.waitForURL('**/dashboard**', { timeout: 30_000 })
    await expect(page).toHaveURL(/\/dashboard/)
  })
})
