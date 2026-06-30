import { test, expect } from './fixtures'

test.describe('Company', () => {
  test('owner can open company settings', async ({ authedPage: page }) => {
    await page.getByRole('link', { name: 'Company', exact: true }).click()
    await expect(page).toHaveURL(/\/company/)
    await expect(
      page.getByRole('heading', { name: 'Company', exact: true }),
    ).toBeVisible({ timeout: 15_000 })
  })
})
