import { test, expect } from './fixtures'
import { createDraftJob, openBookingsCrewTab } from './helpers/navigation'

test.describe('Crew', () => {
  test('owner can open crew page', async ({ authedPage: page }) => {
    await page.getByRole('link', { name: 'Crew', exact: true }).click()
    await expect(page).toHaveURL(/\/crew/)
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({
      timeout: 15_000,
    })
  })

  test('owner can open add crew booking dialog on a job', async ({
    authedPage: page,
  }) => {
    test.setTimeout(60_000)
    await createDraftJob(page)
    await openBookingsCrewTab(page)

    await page.getByRole('button', { name: 'Add role' }).click()
    const roleDialog = page.getByRole('dialog')
    await expect(
      roleDialog.getByRole('heading', { name: 'Add role' }),
    ).toBeVisible()
    await roleDialog.getByRole('button', { name: 'Technician' }).click()
    await expect(roleDialog.getByRole('button', { name: 'Add role' })).toBeEnabled({
      timeout: 15_000,
    })
    await roleDialog.getByRole('button', { name: 'Add role' }).click()
    await expect(roleDialog).toBeHidden({ timeout: 15_000 })

    const addCrew = page.getByRole('button', { name: 'Add crew' }).first()
    await expect(addCrew).toBeVisible({ timeout: 15_000 })
    await addCrew.click()
    await expect(
      page.getByRole('heading', { name: 'Add Crew to Role' }),
    ).toBeVisible({ timeout: 15_000 })
  })
})
