import { test, expect } from './fixtures'
import { openJobsPage } from './helpers/navigation'

test.describe('Recurring jobs', () => {
  test('owner can create a recurring job and open inspector tabs', async ({
    authedPage: page,
  }) => {
    test.setTimeout(60_000)
    await openJobsPage(page)

    await page.getByRole('button', { name: 'New recurring job' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    const title = `E2E Recurring ${Date.now()}`
    await dialog.getByRole('textbox').first().fill(title)
    await dialog.getByRole('button', { name: 'Create' }).click()

    await expect(page.getByRole('heading', { name: title })).toBeVisible({
      timeout: 20_000,
    })

    for (const tab of ['Overview', 'Jobs', 'Crew', 'Bookings']) {
      await page.getByRole('tab', { name: tab }).click()
      await expect(page.getByRole('tab', { name: tab })).toHaveAttribute(
        'data-state',
        'active',
      )
    }
  })
})
