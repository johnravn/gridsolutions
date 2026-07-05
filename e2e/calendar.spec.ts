import { test, expect } from './fixtures'
import { openCalendarPage } from './helpers/navigation'

test.describe('Calendar', () => {
  test('owner can open calendar page', async ({ authedPage: page }) => {
    await openCalendarPage(page)
  })

  test('owner can filter calendar by equipment category', async ({
    authedPage: page,
  }) => {
    test.setTimeout(60_000)
    await openCalendarPage(page)

    const categorySelect = page
      .getByText('Category:', { exact: true })
      .locator('..')
      .getByRole('combobox')
    await expect(categorySelect).toContainText('Jobs')
    await categorySelect.click()
    await page.getByRole('option', { name: 'Equipment' }).click()
    await expect(categorySelect).toContainText('Equipment')
    await expect(page.getByPlaceholder('Search items...')).toBeVisible()
  })
})
