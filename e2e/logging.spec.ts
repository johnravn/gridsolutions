import { test, expect } from './fixtures'
import { openLoggingPage } from './helpers/navigation'

test.describe('Logging', () => {
  test('owner can open logging page', async ({ authedPage: page }) => {
    await openLoggingPage(page)
  })

  test('owner can switch logging month', async ({ authedPage: page }) => {
    await openLoggingPage(page)

    await page
      .getByRole('heading', { name: /Entries for/ })
      .scrollIntoViewIfNeeded()
    const febMonth = page.getByRole('radio', { name: 'feb', exact: true })
    await expect(febMonth).toBeVisible({ timeout: 15_000 })
    await febMonth.click()
    await expect(febMonth).toBeChecked()
    await expect(
      page.getByRole('heading', { name: /Entries for.*feb 2026/i }),
    ).toBeVisible()
  })
})
