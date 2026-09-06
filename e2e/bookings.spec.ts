import { test, expect } from './fixtures'
import {
  bookSeededItemOnJob,
  confirmEquipmentBooking,
  createDraftJob,
  openBookingsEquipmentTab,
} from './helpers/navigation'

test.describe('Bookings', () => {
  test.describe.configure({ mode: 'serial' })
  test('owner can book seeded equipment on a fresh job', async ({
    authedPage: page,
  }) => {
    test.setTimeout(180_000)
    await createDraftJob(page)
    await openBookingsEquipmentTab(page)
    await bookSeededItemOnJob(page)
    await confirmEquipmentBooking(page)

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

  test('owner can select and delete equipment bookings', async ({
    authedPage: page,
  }) => {
    test.setTimeout(180_000)
    await createDraftJob(page)
    await openBookingsEquipmentTab(page)
    await bookSeededItemOnJob(page)
    await confirmEquipmentBooking(page)

    await expect(
      page.getByRole('cell', { name: 'Test Seeded Item' }).first(),
    ).toBeVisible({
      timeout: 15_000,
    })

    const leftoverConflict = page.getByRole('dialog').filter({
      has: page.getByRole('heading', { name: 'Scheduling conflict' }),
    })
    const editBookings = page.getByRole('button', { name: 'Edit bookings' })
    await expect(async () => {
      if ((await leftoverConflict.count()) > 0) {
        const force = leftoverConflict.getByRole('button', {
          name: 'Force booking anyway',
        })
        if ((await force.count()) > 0) {
          await force.evaluate((el) => (el as HTMLElement).click())
        }
      }
      await expect(editBookings).toBeAttached({ timeout: 5_000 })
    }).toPass({ timeout: 45_000 })
    await editBookings.evaluate((el) => (el as HTMLElement).click())
    await expect(
      page.getByRole('button', { name: 'Done editing' }),
    ).toBeVisible()

    const deleteSelected = page.getByRole('button', {
      name: /Delete selected/,
    })
    await expect(deleteSelected).toBeDisabled()

    const selectItem = page.getByRole('checkbox', {
      name: 'Select Test Seeded Item',
    })
    await expect(selectItem).toBeVisible()
    await selectItem.click()
    await expect(deleteSelected).toBeEnabled()

    const selectCategory = page.getByRole('checkbox', {
      name: /Select all .+ bookings/,
    })
    await expect(selectCategory).toBeChecked()

    await deleteSelected.click()

    const confirm = page.getByRole('alertdialog')
    await expect(confirm).toBeVisible()
    await expect(
      confirm.getByRole('heading', { name: /Delete \d+ booking/ }),
    ).toBeVisible()
    await confirm.getByRole('button', { name: 'Cancel' }).click()
    await expect(confirm).toBeHidden()
    await expect(
      page.getByRole('cell', { name: 'Test Seeded Item' }).first(),
    ).toBeVisible()

    await deleteSelected.click()
    await expect(confirm).toBeVisible()
    await confirm.getByRole('button', { name: 'Yes, delete' }).click()

    await expect(
      page.getByRole('cell', { name: 'Test Seeded Item' }),
    ).toHaveCount(0, { timeout: 15_000 })
  })
})
