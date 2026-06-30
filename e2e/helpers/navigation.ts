import { expect, type Page } from '@playwright/test'

export async function openJobsPage(page: Page) {
  await page.getByRole('link', { name: 'Jobs', exact: true }).click()
  await expect(page).toHaveURL(/\/jobs/)
  await expect(
    page.getByRole('heading', { name: 'Jobs', exact: true }),
  ).toBeVisible({
    timeout: 15_000,
  })
}

export async function openInventoryPage(page: Page) {
  await page.getByRole('link', { name: 'Inventory', exact: true }).click()
  await expect(page).toHaveURL(/\/inventory/)
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible({
    timeout: 15_000,
  })
}

export async function openCustomersPage(page: Page) {
  await page.getByRole('link', { name: 'Customers', exact: true }).click()
  await expect(page).toHaveURL(/\/customers/)
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({
    timeout: 15_000,
  })
}

export async function openCalendarPage(page: Page) {
  await page.getByRole('link', { name: 'Calendar', exact: true }).click()
  await expect(page).toHaveURL(/\/calendar/)
  await expect(page.getByRole('heading', { level: 2 })).toBeVisible({
    timeout: 15_000,
  })
}

export async function openLoggingPage(page: Page) {
  await page.getByRole('link', { name: 'Logging', exact: true }).click()
  await expect(page).toHaveURL(/\/logging/)
  await expect(page.getByText('Entry type')).toBeVisible({
    timeout: 15_000,
  })
}

export async function openVehiclesPage(page: Page) {
  await page.getByRole('link', { name: 'Vehicles', exact: true }).click()
  await expect(page).toHaveURL(/\/vehicles/)
  await expect(
    page.getByRole('heading', { name: 'Vehicles', exact: true }),
  ).toBeVisible({
    timeout: 15_000,
  })
}

export async function openCrewPage(page: Page) {
  await page.getByRole('link', { name: 'Crew', exact: true }).click()
  await expect(page).toHaveURL(/\/crew/)
  await expect(
    page.getByRole('heading', { name: 'Crew', exact: true }),
  ).toBeVisible({
    timeout: 15_000,
  })
}

export async function openCompanyPage(page: Page) {
  await page.getByRole('link', { name: 'Company', exact: true }).click()
  await expect(page).toHaveURL(/\/company/)
  await expect(
    page.getByRole('heading', { name: 'Company', exact: true }),
  ).toBeVisible({
    timeout: 15_000,
  })
}

export async function createDraftJob(page: Page, title?: string) {
  await openJobsPage(page)
  await page.getByRole('button', { name: 'New job' }).first().click()

  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText('New job')).toBeVisible()
  await dialog.getByRole('button', { name: 'Auto-fill' }).click()

  const jobTitle = title ?? `E2E Job ${Date.now()}`
  await dialog.getByRole('textbox').first().fill(jobTitle)
  await dialog.getByRole('button', { name: 'Create' }).click()

  await expect(page.getByRole('heading', { name: jobTitle })).toBeVisible({
    timeout: 20_000,
  })

  return jobTitle
}

export async function openBookingsEquipmentTab(page: Page) {
  await page.getByRole('tab', { name: 'Bookings' }).click()
  await expect(page.getByRole('tab', { name: 'Bookings' })).toHaveAttribute(
    'data-state',
    'active',
  )
  const equipmentTab = page.getByRole('tab', { name: 'Equipment' })
  await expect(equipmentTab).toBeVisible({ timeout: 15_000 })
  await equipmentTab.click()
  await expect(
    page.getByText(/Book items|Add items/).first(),
  ).toBeVisible({
    timeout: 15_000,
  })
}

export async function openBookingsCrewTab(page: Page) {
  await page.getByRole('tab', { name: 'Bookings' }).click()
  const crewTab = page.getByRole('tab', { name: 'Crew' })
  await expect(crewTab).toBeVisible({ timeout: 15_000 })
  await crewTab.click()
  await expect(page.getByRole('heading', { name: 'Roles' })).toBeVisible({
    timeout: 15_000,
  })
}

export async function openBookingsTransportTab(page: Page) {
  await page.getByRole('tab', { name: 'Bookings' }).click()
  await page.getByRole('tab', { name: 'Transport' }).click()
}

export function bookEquipmentDialog(page: Page) {
  return page.getByRole('dialog').filter({
    has: page.getByRole('heading', { name: 'Book equipment' }),
  })
}

/** Pick a local date twice in the DateTimeRangePicker (full-day range). */
async function pickDateRangeInDialog(
  page: Page,
  dialog: ReturnType<typeof bookEquipmentDialog>,
  localDate: string,
) {
  const periodTrigger = dialog.getByRole('button', { name: 'Select period' })
  if (await periodTrigger.isVisible()) {
    await periodTrigger.click()
  } else {
    await dialog.getByRole('button', { name: /Start/ }).first().click()
  }

  const picker = page.getByRole('dialog').filter({
    has: page.getByRole('button', { name: 'Dates' }),
  })
  await expect(picker).toBeVisible({ timeout: 10_000 })

  for (let i = 0; i < 12; i++) {
    if ((await picker.getByRole('button', { name: localDate }).count()) > 0) {
      break
    }
    await picker.locator('button', { hasText: '→' }).click()
  }

  const dayButton = picker.getByRole('button', { name: localDate }).last()
  await dayButton.click()
  await dayButton.click()
}

export async function bookSeededItemOnJob(
  page: Page,
  options: { conflictWindow?: boolean } = {},
) {
  await page.getByText(/Book items|Add items/).first().click()
  const dialog = bookEquipmentDialog(page)
  await expect(dialog).toBeVisible({ timeout: 15_000 })

  if (options.conflictWindow) {
    await pickDateRangeInDialog(page, dialog, '2026-07-01')
  } else {
    await pickDateRangeInDialog(page, dialog, '2026-09-01')
  }

  await dialog.getByPlaceholder('Search by name…').fill('Test Seeded')
  await expect(dialog.getByText('Test Seeded Item')).toBeVisible({
    timeout: 15_000,
  })
  await dialog.getByRole('button', { name: 'Add' }).first().click()
  await dialog.getByRole('button', { name: 'Book items' }).click()
}
