import { test, expect } from './fixtures'
import {
  bookSeededItemOnJob,
  bookEquipmentDialog,
  createDraftJob,
  openBookingsEquipmentTab,
} from './helpers/navigation'

test.describe('Bookings', () => {
  test('owner can open bookings tab on a job', async ({ authedPage: page }) => {
    await createDraftJob(page)
    await page.getByRole('tab', { name: 'Bookings' }).click()
    await expect(page.getByRole('tab', { name: 'Bookings' })).toHaveAttribute(
      'data-state',
      'active',
    )
  })

  test('owner can book seeded equipment on a fresh job', async ({
    authedPage: page,
  }) => {
    test.setTimeout(60_000)
    await createDraftJob(page)
    await openBookingsEquipmentTab(page)

    await page
      .getByText(/Book items|Add items/)
      .first()
      .click()
    const dialog = bookEquipmentDialog(page)
    await expect(dialog).toBeVisible({ timeout: 15_000 })
    await dialog.getByPlaceholder('Search by name…').fill('Test Seeded')
    await dialog.getByRole('button', { name: 'Add' }).first().click()
    await dialog.getByRole('button', { name: 'Book items' }).click()

    const conflictDialog = page.getByRole('dialog').filter({
      has: page.getByRole('heading', { name: 'Scheduling conflict' }),
    })
    const hasConflict = await conflictDialog
      .waitFor({ state: 'visible', timeout: 8_000 })
      .then(() => true)
      .catch(() => false)
    if (hasConflict) {
      await conflictDialog
        .getByRole('button', { name: 'Force booking anyway' })
        .click()
      await expect(conflictDialog).toBeHidden({ timeout: 20_000 })
    }

    await expect(
      page.getByRole('dialog', { name: 'Book equipment' }),
    ).toBeHidden({ timeout: 20_000 })
    await expect(
      page.getByRole('cell', { name: 'Test Seeded Item' }).first(),
    ).toBeVisible({
      timeout: 15_000,
    })
  })

  test('owner sees conflict dialog and can force-book overlapping item', async ({
    authedPage: page,
  }) => {
    test.setTimeout(90_000)
    await createDraftJob(page)
    await openBookingsEquipmentTab(page)
    await bookSeededItemOnJob(page, { conflictWindow: true })

    const conflictDialog = page.getByRole('dialog').filter({
      has: page.getByRole('heading', { name: 'Scheduling conflict' }),
    })
    await expect(conflictDialog).toBeVisible({ timeout: 20_000 })
    await expect(conflictDialog.getByText('Equipment booking')).toBeVisible()

    await conflictDialog
      .getByRole('button', { name: 'Force booking anyway' })
      .click()

    await expect(conflictDialog).toBeHidden({ timeout: 20_000 })
    await expect(
      page.getByRole('dialog', { name: 'Book equipment' }),
    ).toBeHidden({ timeout: 20_000 })
    await expect(
      page.getByRole('cell', { name: 'Test Seeded Item' }).first(),
    ).toBeVisible({
      timeout: 15_000,
    })
  })
})
