import { expect, type Locator, type Page } from '@playwright/test'

function navLinkName(name: string): RegExp {
  return new RegExp(`^${name}(?:\\s+\\d+)?$`)
}

function isJobCreateResponse(response: {
  url: () => string
  request: () => { method: () => string }
  ok: () => boolean
}) {
  return (
    response.url().includes('/rest/v1/jobs') &&
    response.request().method() === 'POST' &&
    response.ok()
  )
}

async function closeMobileMenuIfOpen(page: Page) {
  const closeMenu = page.getByRole('button', { name: 'Close menu' })
  if (await closeMenu.isVisible().catch(() => false)) {
    await closeMenu.click({ force: true })
    await expect(closeMenu).toBeHidden({ timeout: 5_000 })
  }
}

/** Close the phone inspector so list chrome (e.g. New job) is visible again. */
async function closeMobileInspectorIfOpen(page: Page) {
  const closeInspector = page.getByRole('button', { name: 'Close inspector' })
  const inspectorBackdrop = page.locator(
    '.app-inspector-backdrop[data-open="true"]',
  )

  if (
    !(await closeInspector.isVisible().catch(() => false)) &&
    !(await inspectorBackdrop.isVisible().catch(() => false))
  ) {
    return
  }

  // The inspector drawer uses transform + a full-screen backdrop. A Playwright
  // mouse click (even { force: true }) often hits the drawer instead of the FAB.
  // Dispatch a DOM click, same as mobile nav links and date-picker days.
  await expect(async () => {
    if (await closeInspector.isVisible().catch(() => false)) {
      await closeInspector.evaluate((el) => (el as HTMLElement).click())
    } else if (await inspectorBackdrop.isVisible().catch(() => false)) {
      await inspectorBackdrop.evaluate((el) => (el as HTMLElement).click())
    }

    await expect(closeInspector).toBeHidden({ timeout: 2_000 })
    await expect(inspectorBackdrop).toBeHidden({ timeout: 2_000 })
  }).toPass({ timeout: 10_000 })
}

/** Dismiss auto-opened release notes so the popover cannot intercept nav clicks. */
async function dismissWhatsNewIfOpen(page: Page) {
  const gotIt = page.getByRole('button', { name: 'Got it' })
  if (await gotIt.isVisible().catch(() => false)) {
    await gotIt.click({ force: true })
    await expect(gotIt).toBeHidden({ timeout: 5_000 })
  }
}

async function clickNavLink(page: Page, name: string) {
  const openButton = page.getByRole('button', { name: 'Open menu' })
  const closeButton = page.getByRole('button', { name: 'Close menu' })
  const linkName = navLinkName(name)
  const inspectorBackdrop = page.locator(
    '.app-inspector-backdrop[data-open="true"]',
  )

  if (await inspectorBackdrop.isVisible().catch(() => false)) {
    await inspectorBackdrop.click({ force: true })
  }

  await dismissWhatsNewIfOpen(page)

  // Mobile: open the drawer, then click inside it. The panel slides in with
  // transform, so a real mouse click rejects "outside of the viewport" even
  // with { force: true } — dispatch a DOM click after it is marked open.
  if (await openButton.isVisible().catch(() => false)) {
    await openButton.click({ force: true })
    await expect(closeButton).toBeVisible({ timeout: 5_000 })
    const drawer = page.locator('.app-sidebar-drawer[data-open="true"]')
    await expect(drawer).toBeVisible({ timeout: 5_000 })
    const drawerLink = drawer.getByRole('link', { name: linkName })
    await expect(drawerLink.first()).toBeAttached({ timeout: 5_000 })
    await drawerLink.first().evaluate((el) => (el as HTMLElement).click())
    return
  }

  // Desktop: do not force-click. Lower sidebar items (Calendar/Matters/Profile)
  // live in a scroll container; force skips scroll-into-view and the click misses.
  await page.getByRole('link', { name: linkName }).first().click()
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

async function ensureMobileInspectorOpen(page: Page) {
  const openInspector = page.getByRole('button', { name: 'Open inspector' })
  if (!(await openInspector.isVisible().catch(() => false))) return

  const tabLabel = page.getByText('Tab', { exact: true })
  const box = await tabLabel.boundingBox().catch(() => null)
  const viewport = page.viewportSize()
  const inViewport =
    !!box &&
    !!viewport &&
    box.x + box.width > 0 &&
    box.x < viewport.width &&
    box.y + box.height > 0 &&
    box.y < viewport.height

  if (!inViewport) {
    await openInspector.click({ force: true })
  }
}

export async function clickJobTab(page: Page, tabName: string) {
  const tabOptions = jobTabLocatorOptions(tabName)

  await ensureMobileInspectorOpen(page)

  const mobilePicker = page.getByText('Tab', { exact: true })
  if (await mobilePicker.isVisible().catch(() => false)) {
    const pickerButton = mobilePicker.locator('..').getByRole('button')
    await pickerButton.scrollIntoViewIfNeeded()
    await pickerButton.click({ force: true })
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
  await closeMobileInspectorIfOpen(page)

  if (!/\/jobs(?:\?|$)/.test(new URL(page.url()).pathname)) {
    await clickNavLink(page, 'Jobs')
  }

  await closeMobileInspectorIfOpen(page)
  await closeMobileMenuIfOpen(page)

  await expect(page).toHaveURL(/\/jobs/, { timeout: 15_000 })
  await expect(
    page
      .getByRole('button', { name: 'New job' })
      .or(page.getByPlaceholder('Search'))
      .first(),
  ).toBeVisible({
    timeout: 15_000,
  })
}

export async function openInventoryPage(page: Page) {
  await clickNavLink(page, 'Inventory')
  await expect(page).toHaveURL(/\/inventory/, { timeout: 15_000 })
  await expect(
    page.getByRole('button', { name: 'Add item' }).first(),
  ).toBeVisible({
    timeout: 15_000,
  })
}

export async function openCustomersPage(page: Page) {
  await clickNavLink(page, 'Customers')
  await expect(page).toHaveURL(/\/customers/, { timeout: 15_000 })
  await expect(
    page.getByRole('button', { name: 'Add customer' }).first(),
  ).toBeVisible({
    timeout: 15_000,
  })
}

export async function openCalendarPage(page: Page) {
  await clickNavLink(page, 'Calendar')
  await expect(page).toHaveURL(/\/calendar/, { timeout: 15_000 })
  await expect(page.getByRole('combobox', { name: 'Category' })).toBeVisible({
    timeout: 15_000,
  })
}

export async function openLoggingPage(page: Page) {
  await clickNavLink(page, 'Logging')
  await expect(page).toHaveURL(/\/logging/, { timeout: 15_000 })
  await expect(page.getByRole('heading', { name: /Entries for/ })).toBeVisible({
    timeout: 15_000,
  })
}

export async function openVehiclesPage(page: Page) {
  await clickNavLink(page, 'Vehicles')
  await expect(page).toHaveURL(/\/vehicles/, { timeout: 15_000 })
  await expect(page.getByPlaceholder('Search vehicles…')).toBeVisible({
    timeout: 15_000,
  })
}

export async function openCrewPage(page: Page) {
  await clickNavLink(page, 'Crew')
  await expect(page).toHaveURL(/\/crew/, { timeout: 15_000 })
  await expect(page.getByPlaceholder('Search crew…')).toBeVisible({
    timeout: 15_000,
  })
}

export async function openCompanyPage(page: Page) {
  await clickNavLink(page, 'Company')
  await expect(page).toHaveURL(/\/company/, { timeout: 15_000 })
  await expect(
    page.getByRole('heading', { name: 'Grid Test Company' }),
  ).toBeVisible({
    timeout: 15_000,
  })
}

export async function openMattersPage(page: Page) {
  await clickNavLink(page, 'Matters')
  await expect(page).toHaveURL(/\/matters/, { timeout: 15_000 })
  await expect(page.getByPlaceholder('Search matters…')).toBeVisible({
    timeout: 15_000,
  })
}

export async function openProfilePage(page: Page) {
  await clickNavLink(page, 'Profile')
  await expect(page).toHaveURL(/\/profile/, { timeout: 15_000 })
  await expect(page.getByRole('tab', { name: 'General' })).toBeVisible({
    timeout: 15_000,
  })
  await expect(
    page.getByRole('tabpanel').getByText('owner@test.grid.local'),
  ).toBeVisible({
    timeout: 15_000,
  })
}

export async function openLatestPage(page: Page) {
  await clickNavLink(page, 'Latest')
  await expect(page).toHaveURL(/\/latest/, { timeout: 15_000 })
}

export async function openHomePage(page: Page) {
  await clickNavLink(page, 'Home')
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 })
}

export async function createDraftJob(page: Page, title?: string) {
  await openJobsPage(page)
  await closeMobileMenuIfOpen(page)
  await page.getByRole('button', { name: 'New job' }).first().click()

  const dialog = page.getByRole('dialog').filter({
    has: page.getByRole('heading', { name: 'New job' }),
  })
  await expect(dialog).toBeVisible()

  const jobTitle = title ?? `E2E Job ${Date.now()}`
  const createButton = dialog.getByRole('button', { name: 'Create' })
  const titleInput = dialog.getByPlaceholder('Enter job title')

  await titleInput.fill(jobTitle)
  await expect(titleInput).toHaveValue(jobTitle)

  // Create stays disabled until a date range is set.
  const today = new Date()
  const localDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  await pickDateRangeInDialog(page, dialog, localDate)
  await expect(createButton).toBeEnabled({ timeout: 10_000 })

  await createButton.scrollIntoViewIfNeeded()
  await expect(async () => {
    if (!(await dialog.isVisible().catch(() => false))) return

    await expect(createButton).toBeEnabled()
    const createResponse = page.waitForResponse(isJobCreateResponse, {
      timeout: 15_000,
    })
    await createButton.click({ force: true })
    await createResponse
    await expect(dialog).toBeHidden({ timeout: 5_000 })
  }).toPass({ timeout: 30_000 })

  await closeMobileMenuIfOpen(page)
  await openJobInspector(page, jobTitle)

  return jobTitle
}

/** Find a job in the list (search skips infinite-scroll pagination) and open it. */
async function openJobInspector(page: Page, jobTitle: string) {
  const heading = page.getByRole('heading', { name: jobTitle })
  if (await heading.isVisible().catch(() => false)) return

  const closeInspector = page.getByRole('button', { name: 'Close inspector' })
  // Creating a job selects it and opens the inspector. Wait for that heading
  // instead of closing a drawer that is still loading.
  if (await closeInspector.isVisible().catch(() => false)) {
    if (await heading.isVisible({ timeout: 10_000 }).catch(() => false)) return
  }

  await closeMobileInspectorIfOpen(page)

  const search = page.getByPlaceholder('Search')
  await expect(search).toBeVisible({ timeout: 15_000 })
  await search.fill(jobTitle)

  const row = page.getByText(jobTitle, { exact: true }).first()
  await expect(row).toBeVisible({ timeout: 15_000 })
  await row.click()

  const openInspector = page.getByRole('button', { name: 'Open inspector' })
  if (await openInspector.isVisible().catch(() => false)) {
    await openInspector.evaluate((el) => (el as HTMLElement).click())
  }

  await expect(heading).toBeVisible({ timeout: 15_000 })
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

/** Pick a local date in the DateTimeRangePicker (sets a full-day range on that day). */
async function pickDateRangeInDialog(
  page: Page,
  dialog: Locator,
  localDate: string,
) {
  const periodTrigger = dialog.getByRole('button', { name: 'Select period' })
  if (await periodTrigger.isVisible()) {
    await periodTrigger.click()
  } else {
    await dialog.getByRole('button', { name: /Start/ }).first().click()
  }

  const datesTab = page.getByRole('button', { name: 'Dates', exact: true })
  await expect(datesTab).toBeVisible({ timeout: 10_000 })

  const picker = page
    .locator('[data-radix-popper-content-wrapper], [role="dialog"]')
    .filter({ has: datesTab })
    .first()
  await expect(picker).toBeVisible({ timeout: 10_000 })

  const targetMs = new Date(`${localDate}T12:00:00`).getTime()

  // Last-row days (e.g. the 31st) often sit below the mobile viewport inside a
  // transformed Radix popover. Playwright then rejects a real click as
  // "outside of the viewport" even after scrollIntoView — dispatch a DOM click.
  const clickDayButton = async (dayButton: Locator) => {
    await expect(dayButton).toBeAttached({ timeout: 5_000 })
    await dayButton.evaluate((el) => (el as HTMLElement).click())
  }

  const clickTargetDay = async () => {
    for (let i = 0; i < 24; i++) {
      const dayButton = picker.getByRole('button', { name: localDate }).last()
      if (await dayButton.isVisible().catch(() => false)) {
        await clickDayButton(dayButton)
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
    await clickDayButton(dayButton)
  }

  // First click may expand from the job's existing single day into a multi-day
  // span; second click on the same day collapses to that full day only.
  await clickTargetDay()
  await clickTargetDay()
  await page.keyboard.press('Escape')

  const [year, , day] = localDate.split('-').map(Number)
  const dayNum = String(day)
  // Trigger shows e.g. "1. jul 2026" / "1. July 2026" — require day + year.
  await expect(
    dialog.getByRole('button', { name: new RegExp(`${dayNum}\\..*${year}`) }),
  ).toBeVisible({ timeout: 5_000 })
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

  await dialog
    .getByPlaceholder('Search items or groups to add...')
    .fill('Test Seeded')
  await expect(dialog.getByText('Test Seeded Item')).toBeVisible({
    timeout: 15_000,
  })
  await dialog.getByRole('button', { name: 'Add Test Seeded Item' }).click()
  await dialog.getByRole('button', { name: 'Book items' }).click()
}
