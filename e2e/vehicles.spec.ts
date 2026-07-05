import { test, expect } from './fixtures'
import {
  createDraftJob,
  openBookingsTransportTab,
  openVehiclesPage,
} from './helpers/navigation'

test.describe('Vehicles', () => {
  test('owner can open vehicles page', async ({ authedPage: page }) => {
    await openVehiclesPage(page)
  })

  test('owner can open book vehicle on job transport tab', async ({
    authedPage: page,
  }) => {
    test.setTimeout(60_000)
    await createDraftJob(page)
    await openBookingsTransportTab(page)

    const bookButton = page.getByRole('button', { name: 'Book vehicle' })
    if (await bookButton.isVisible()) {
      await bookButton.click()
      await expect(
        page.getByRole('heading', { name: /Book vehicle/i }),
      ).toBeVisible({ timeout: 15_000 })
    } else {
      await expect(page.getByText('No vehicles')).toBeVisible()
    }
  })
})
