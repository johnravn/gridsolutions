import { expect, type Page } from '@playwright/test'

async function clickNavLink(page: Page, name: string) {
  await expect(async () => {
    const link = page.getByRole('link', { name, exact: true })
    if (await link.isVisible().catch(() => false)) {
      await link.click()
      return
    }

    const openButton = page.getByRole('button', { name: 'Open menu' })
    if (await openButton.isVisible().catch(() => false)) {
      await openButton.click()
      const navDialog = page.getByRole('dialog', { name: 'Navigation' })
      await expect(navDialog).toBeVisible()
      await navDialog.getByRole('link', { name, exact: true }).click()
      return
    }

    // Desktop sidebar still loading — retry until the link appears.
    await expect(link).toBeVisible()
    await link.click()
  }).toPass({ timeout: 15_000 })
}

function jobTabNameMatcher(tabName: string): string | RegExp {
  if (tabName === 'Pretty Offers') return /Pretty Offers/
  return tabName
}

function jobTabLocatorOptions(tabName: string) {
  return {
    name: jobTabNameMatcher(tabName),
    exact: tabName === 'Offers',
  }
}

export async function clickJobTab(page: Page, tabName: string) {
  const tabOptions = jobTabLocatorOptions(tabName)

  const mobilePicker = page.getByText('Tab', { exact: true })
  if (await mobilePicker.isVisible().catch(() => false)) {
    await mobilePicker.locator('..').getByRole('button').click()
    await page.getByRole('menuitem', tabOptions).click()
    return
  }

  const tab = page.getByRole('tablist').first().getByRole('tab', tabOptions)
  await expect(tab).toBeVisible({ timeout: 15_000 })
  await tab.click()
}

export async function expectJobTabActive(page: Page, tabName: string) {
  const tabOptions = jobTabLocatorOptions(tabName)
  const mobilePicker = page.getByText('Tab', { exact: true })
  if (await mobilePicker.isVisible().catch(() => false)) {
    await expect(tabSectionButton(page)).toContainText(tabOptions.name)
    return
  }

  const tab = page.getByRole('tablist').first().getByRole('tab', tabOptions)
  await expect(tab).toHaveAttribute('data-state', 'active')
}

function tabSectionButton(page: Page) {
  return page
    .getByText('Tab', { exact: true })
    .locator('..')
    .getByRole('button')
}

export async function openJobsPage(page: Page) {
  await clickNavLink(page, 'Jobs')
  await expect(page).toHaveURL(/\/jobs/)
  await expect(
    page.getByRole('heading', { name: 'Jobs', exact: true }),
  ).toBeVisible({
    timeout: 15_000,
  })
}

export async function openInventoryPage(page: Page) {
  await clickNavLink(page, 'Inventory')
  await expect(page).toHaveURL(/\/inventory/)
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible({
    timeout: 15_000,
  })
}

export async function openCustomersPage(page: Page) {
  await clickNavLink(page, 'Customers')
  await expect(page).toHaveURL(/\/customers/)
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({
    timeout: 15_000,
  })
}

export async function openCalendarPage(page: Page) {
  await clickNavLink(page, 'Calendar')
  await expect(page).toHaveURL(/\/calendar/)
  await expect(page.getByRole('heading', { level: 2 })).toBeVisible({
    timeout: 15_000,
  })
}

export async function openLoggingPage(page: Page) {
  await clickNavLink(page, 'Logging')
  await expect(page).toHaveURL(/\/logging/)
  await expect(page.getByText('Entry type')).toBeVisible({
    timeout: 15_000,
  })
}

export async function openVehiclesPage(page: Page) {
  await clickNavLink(page, 'Vehicles')
  await expect(page).toHaveURL(/\/vehicles/)
  await expect(
    page.getByRole('heading', { name: 'Vehicles', exact: true }),
  ).toBeVisible({
    timeout: 15_000,
  })
}

export async function openCrewPage(page: Page) {
  await clickNavLink(page, 'Crew')
  await expect(page).toHaveURL(/\/crew/)
  await expect(
    page.getByRole('heading', { name: 'Crew', exact: true }),
  ).toBeVisible({
    timeout: 15_000,
  })
}

export async function openCompanyPage(page: Page) {
  await clickNavLink(page, 'Company')
  await expect(page).toHaveURL(/\/company/)
  await expect(
    page.getByRole('heading', { name: 'Grid Test Company' }),
  ).toBeVisible({
    timeout: 15_000,
  })
}

export async function openMattersPage(page: Page) {
  await clickNavLink(page, 'Matters')
  await expect(page).toHaveURL(/\/matters/)
  await expect(page.getByRole('heading', { name: 'Matters' })).toBeVisible({
    timeout: 15_000,
  })
}

export async function openProfilePage(page: Page) {
  await clickNavLink(page, 'Profile')
  await expect(page).toHaveURL(/\/profile/)
  await expect(page.getByText('owner@test.grid.local')).toBeVisible({
    timeout: 15_000,
  })
}

export async function openLatestPage(page: Page) {
  await clickNavLink(page, 'Latest')
  await expect(page).toHaveURL(/\/latest/)
  await expect(page.getByRole('heading', { name: 'Latest' })).toBeVisible({
    timeout: 15_000,
  })
}

export async function openHomePage(page: Page) {
  await clickNavLink(page, 'Home')
  await expect(page).toHaveURL(/\/dashboard/)
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

function bookingsSubTabList(page: Page) {
  return page
    .getByRole('tab', { name: 'Crew', exact: true })
    .locator('xpath=ancestor::*[@role="tablist"][1]')
}

export async function openBookingsEquipmentTab(page: Page) {
  await clickJobTab(page, 'Bookings')
  await expectJobTabActive(page, 'Bookings')
  const subTabs = bookingsSubTabList(page)
  const equipmentTab = subTabs.getByRole('tab', {
    name: 'Equipment',
    exact: true,
  })
  await expect(equipmentTab).toBeVisible({ timeout: 15_000 })
  await equipmentTab.click()
  await expect(
    page.getByRole('heading', { name: 'Stock equipment' }),
  ).toBeVisible({
    timeout: 15_000,
  })
  await expect(page.getByText(/Book items|Add items/).first()).toBeVisible({
    timeout: 15_000,
  })
}

export async function openJobSubcontractorsTab(page: Page) {
  await clickJobTab(page, 'Subcontractors')
  await expectJobTabActive(page, 'Subcontractors')
  await expect(
    page.getByRole('heading', { name: 'Subcontractors' }),
  ).toBeVisible({ timeout: 15_000 })
}

export async function openBookingsCrewTab(page: Page) {
  await clickJobTab(page, 'Bookings')
  const crewTab = bookingsSubTabList(page).getByRole('tab', {
    name: 'Crew',
    exact: true,
  })
  await expect(crewTab).toBeVisible({ timeout: 15_000 })
  await crewTab.click()
  await expect(page.getByRole('heading', { name: 'Roles' })).toBeVisible({
    timeout: 15_000,
  })
}

export async function openBookingsTransportTab(page: Page) {
  await clickJobTab(page, 'Bookings')
  const transportTab = bookingsSubTabList(page).getByRole('tab', {
    name: 'Transport',
    exact: true,
  })
  await expect(transportTab).toBeVisible({ timeout: 15_000 })
  await transportTab.click()
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

  const targetMs = new Date(`${localDate}T12:00:00`).getTime()

  for (let i = 0; i < 24; i++) {
    const dayButton = picker.getByRole('button', { name: localDate }).last()
    if (await dayButton.isVisible().catch(() => false)) {
      await dayButton.click()
      await dayButton.click()
      return
    }

    const labels = await picker
      .locator('button[aria-label^="20"]')
      .evaluateAll((buttons) =>
        buttons
          .map((btn) => btn.getAttribute('aria-label'))
          .filter((label): label is string => Boolean(label)),
      )

    if (labels.length === 0) {
      await picker.locator('button', { hasText: '→' }).click()
      continue
    }

    labels.sort()
    const firstMs = new Date(`${labels[0]}T12:00:00`).getTime()
    const lastMs = new Date(`${labels.at(-1)!}T12:00:00`).getTime()

    if (targetMs < firstMs) {
      await picker.locator('button', { hasText: '←' }).click()
    } else {
      await picker.locator('button', { hasText: '→' }).click()
    }
  }

  const dayButton = picker.getByRole('button', { name: localDate }).last()
  await expect(dayButton).toBeVisible({ timeout: 5_000 })
  await dayButton.click()
  await dayButton.click()
}

export async function bookSeededItemOnJob(
  page: Page,
  options: { conflictWindow?: boolean } = {},
) {
  await page
    .getByText(/Book items|Add items/)
    .first()
    .click()
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
