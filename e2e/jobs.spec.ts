import { test, expect } from './fixtures'
import { createDraftJob, openJobsPage } from './helpers/navigation'

test.describe('Jobs', () => {
  test('owner can open jobs page', async ({ authedPage: page }) => {
    await openJobsPage(page)
    await expect(
      page.getByRole('button', { name: 'New job' }).first(),
    ).toBeVisible()
  })

  test('owner can create a draft job', async ({ authedPage: page }) => {
    const title = await createDraftJob(page)
    await expect(page.getByRole('heading', { name: title })).toBeVisible()
  })

  test('owner can navigate job tabs', async ({ authedPage: page }) => {
    const title = await createDraftJob(page)

    await page.getByRole('tab', { name: 'Overview' }).click()
    await expect(page.getByRole('tab', { name: 'Overview' })).toHaveAttribute(
      'data-state',
      'active',
    )

    await page.getByRole('tab', { name: 'Bookings' }).click()
    await expect(page.getByRole('tab', { name: 'Bookings' })).toHaveAttribute(
      'data-state',
      'active',
    )

    await page.getByRole('tab', { name: 'Offers' }).click()
    await expect(page.getByRole('heading', { name: 'Offers' })).toBeVisible({
      timeout: 15_000,
    })

    await expect(page.getByRole('heading', { name: title })).toBeVisible()
  })

  test('owner can edit job title', async ({ authedPage: page }) => {
    const title = await createDraftJob(page)
    const updated = `${title} Updated`

    await page.getByRole('button', { name: 'Edit job' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await dialog.getByRole('textbox').first().fill(updated)
    await dialog.getByRole('button', { name: 'Save' }).click()

    await expect(page.getByRole('heading', { name: updated })).toBeVisible({
      timeout: 20_000,
    })
  })

  test('owner can return to jobs list', async ({ authedPage: page }) => {
    await createDraftJob(page)
    await openJobsPage(page)
    await expect(
      page.getByRole('button', { name: 'New job' }).first(),
    ).toBeVisible()
  })

  test('owner can change job status from overview timeline', async ({
    authedPage: page,
  }) => {
    await createDraftJob(page)

    await page.getByRole('tab', { name: 'Overview' }).click()
    const overview = page.getByRole('tabpanel')
    await overview.getByText('Planned', { exact: true }).click()

    await expect(
      overview.getByText('Current status:').locator('..').getByText('Planned'),
    ).toBeVisible({ timeout: 15_000 })
  })
})
