import { test, expect } from './fixtures'
import { openLoggingPage } from './helpers/navigation'

test.describe('Logging', () => {
  test('owner can switch logging month', async ({ authedPage: page }) => {
    await openLoggingPage(page)

    await page
      .getByRole('heading', { name: /Entries for/ })
      .scrollIntoViewIfNeeded()
    const febMonth = page
      .locator('.logging-month-scroller')
      .getByRole('radio', { name: 'feb', exact: true })
      .first()
    await febMonth.scrollIntoViewIfNeeded()
    await expect(febMonth).toBeVisible({ timeout: 15_000 })
    await febMonth.click()
    await expect(
      page.getByRole('heading', { name: /Entries for.*feb 2026/i }),
    ).toBeVisible()
  })
})
