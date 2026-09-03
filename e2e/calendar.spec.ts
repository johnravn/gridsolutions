import { test, expect } from './fixtures'
import {
  openAddPersonalEvent,
  openCalendarPage,
  openSubscribeToCalendar,
} from './helpers/navigation'

test.describe('Calendar', () => {
  test.describe.configure({ timeout: 60_000 })
  test('owner can filter calendar by equipment category', async ({
    authedPage: page,
  }) => {
    test.setTimeout(60_000)
    await openCalendarPage(page)

    const categorySelect = page.getByRole('combobox', { name: 'Category' })
    await expect(categorySelect).toContainText('Jobs')
    await categorySelect.click()
    await page.getByRole('option', { name: 'Equipment' }).click()
    await expect(categorySelect).toContainText('Equipment')
    await expect(page.getByPlaceholder('Search items...')).toBeVisible()
  })

  test('owner can opt in to a 1-hour reminder on project lead jobs', async ({
    authedPage: page,
  }) => {
    test.setTimeout(60_000)
    await openCalendarPage(page)
    await openSubscribeToCalendar(page)

    const dialog = page.getByRole('dialog').filter({
      has: page.getByRole('heading', { name: 'Subscribe to calendar' }),
    })
    await expect(dialog).toBeVisible()

    const reminderLabel = dialog.getByText(
      'Remind me 1 hour before the job starts',
    )
    if (!(await reminderLabel.isVisible().catch(() => false))) {
      await dialog.getByText('Jobs where I am project lead').click()
    }

    await expect(reminderLabel).toBeVisible()
  })

  test('owner can pick a person for a crew calendar subscription', async ({
    authedPage: page,
  }) => {
    test.setTimeout(60_000)
    await openCalendarPage(page)
    await openSubscribeToCalendar(page)

    const dialog = page.getByRole('dialog').filter({
      has: page.getByRole('heading', { name: 'Subscribe to calendar' }),
    })
    await dialog.getByText('Crew: one person').click()
    await expect(dialog.getByText('Choose person')).toBeVisible()
  })

  test('freelancer cannot subscribe to another person’s crew calendar', async ({
    freelancerPage: page,
  }) => {
    test.setTimeout(60_000)
    await openCalendarPage(page)
    await openSubscribeToCalendar(page)

    const dialog = page.getByRole('dialog').filter({
      has: page.getByRole('heading', { name: 'Subscribe to calendar' }),
    })
    await expect(dialog.getByText('Crew: one person')).toHaveCount(0)
    await expect(dialog.getByText('Jobs where I am crew')).toBeVisible()
  })

  test('owner can open add personal event', async ({ authedPage: page }) => {
    test.setTimeout(60_000)
    await openCalendarPage(page)
    await openAddPersonalEvent(page)
    const dialog = page.getByRole('dialog').filter({
      has: page.getByRole('heading', { name: 'Add personal event' }),
    })
    await expect(dialog).toBeVisible()
    await expect(
      dialog.getByPlaceholder('Accounting at the office'),
    ).toBeVisible()
  })

  test('desktop week and day views show all hours and wrap in a card', async ({
    authedPage: page,
  }) => {
    test.setTimeout(60_000)
    await openCalendarPage(page)

    const isDesktop = (page.viewportSize()?.width ?? 0) >= 1024
    if (!isDesktop) {
      await expect(page.locator('.calendar-page-card')).toHaveCount(0)
      return
    }

    await expect(page.locator('.calendar-page-card')).toBeVisible()

    await page.getByRole('button', { name: 'week', exact: true }).click()
    const weekLabels = page.locator('.fc-timegrid-slot-label-cushion')
    await expect(weekLabels).toHaveCount(24)
    await expect(weekLabels.first()).toHaveText('00')
    await expect(weekLabels.last()).toHaveText('23')

    await page.getByRole('button', { name: 'day', exact: true }).click()
    const dayLabels = page.locator('.fc-timegrid-slot-label-cushion')
    await expect(dayLabels).toHaveCount(24)
    await expect(dayLabels.first()).toHaveText('00')
    await expect(dayLabels.last()).toHaveText('23')
  })
})
