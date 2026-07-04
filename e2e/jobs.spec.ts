import { test, expect } from './fixtures'
import {
  createDraftJob,
  clickJobTab,
  expectJobTabActive,
  openJobsPage,
} from './helpers/navigation'

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

    await clickJobTab(page, 'Overview')
    await expectJobTabActive(page, 'Overview')

    await clickJobTab(page, 'Bookings')
    await expectJobTabActive(page, 'Bookings')

    await clickJobTab(page, 'Offers')
    await expect(page.getByRole('heading', { name: 'Offers' })).toBeVisible({
      timeout: 15_000,
    })

    await clickJobTab(page, 'Subcontractors')
    await expectJobTabActive(page, 'Subcontractors')
    await expect(
      page.getByRole('heading', { name: 'Subcontractors' }),
    ).toBeVisible({ timeout: 15_000 })

    await expect(page.getByRole('heading', { name: title })).toBeVisible()
  })

  test('owner can edit job title', async ({ authedPage: page }) => {
    test.setTimeout(60_000)
    const title = await createDraftJob(page)
    const updated = `${title} Updated`

    await page.getByRole('button', { name: 'Edit job' }).click()
    const editDialog = page.getByRole('dialog').filter({
      has: page.getByRole('heading', { name: 'Edit job' }),
    })
    await expect(editDialog).toBeVisible()
    await editDialog.getByPlaceholder('Enter job title').fill(updated)
    await expect(editDialog.getByPlaceholder('Enter job title')).toHaveValue(
      updated,
    )
    const saveButton = editDialog.getByRole('button', { name: 'Save' })
    await expect(saveButton).toBeEnabled({ timeout: 15_000 })
    await saveButton.click()

    await expect(editDialog).toBeHidden({ timeout: 15_000 })
    await expect(page.getByRole('heading', { name: updated })).toBeVisible({
      timeout: 15_000,
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

    await clickJobTab(page, 'Overview')
    const overview = page.getByRole('tabpanel')
    const statusSection = overview
      .getByRole('heading', { name: 'Job Status' })
      .locator('..')
    const currentStatusRow = overview.getByText('Current status:').locator('..')
    const currentStatus = (
      await currentStatusRow.locator('.rt-Badge').textContent()
    )?.trim()
    const targetStatus = currentStatus === 'Planned' ? 'Requested' : 'Planned'

    await statusSection.getByText(targetStatus, { exact: true }).click()

    await expect(
      currentStatusRow.getByText(targetStatus, { exact: true }),
    ).toBeVisible({ timeout: 15_000 })
  })
})
