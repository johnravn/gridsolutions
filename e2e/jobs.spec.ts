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
    await expect(
      editDialog.getByPlaceholder('Search project lead…'),
    ).not.toHaveValue('', { timeout: 15_000 })
    const saveButton = editDialog.getByRole('button', { name: 'Save' })
    await expect(saveButton).toBeEnabled()
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

    await page.getByRole('tab', { name: 'Overview' }).click()
    const overview = page.getByRole('tabpanel')
    await overview.getByText('Planned', { exact: true }).click()

    await expect(
      overview.getByText('Current status:').locator('..').getByText('Planned'),
    ).toBeVisible({ timeout: 15_000 })
  })
})
