import { test, expect } from './fixtures'
import { createDraftJob, openBookingsCrewTab } from './helpers/navigation'

test.describe('Crew', () => {
  test('owner can open add crew booking dialog on a job', async ({
    authedPage: page,
  }) => {
    test.setTimeout(60_000)
    await createDraftJob(page)
    await openBookingsCrewTab(page)

    await page.getByRole('button', { name: 'Add role' }).click()
    const roleDialog = page.getByRole('dialog').filter({
      has: page.getByRole('heading', { name: 'Add role' }),
    })
    await expect(roleDialog).toBeVisible({ timeout: 15_000 })
    await expect(
      roleDialog.getByRole('checkbox', { name: 'Confirm myself' }),
    ).toBeVisible()
    await roleDialog
      .getByPlaceholder('e.g. FOH, Monitor, Loader')
      .fill('Technician')

    // Submit is a no-op until job start/end are seeded into the period picker.
    await expect(
      roleDialog.getByRole('button', { name: 'Select period' }),
    ).toHaveCount(0, { timeout: 15_000 })

    const addRole = roleDialog.getByRole('button', { name: 'Add role' })
    await expect(addRole).toBeEnabled({ timeout: 15_000 })
    const insert = page.waitForResponse(
      (response) =>
        response.url().includes('/rest/v1/time_periods') &&
        response.request().method() === 'POST' &&
        response.ok(),
      { timeout: 15_000 },
    )
    await addRole.evaluate((el: HTMLButtonElement) => el.click())
    await insert
    await expect(roleDialog).toBeHidden({ timeout: 15_000 })
    await expect(page.getByText('Technician').first()).toBeVisible({
      timeout: 15_000,
    })

    const addCrew = page.getByRole('button', { name: 'Add crew' }).first()
    await expect(addCrew).toBeVisible({ timeout: 15_000 })
    await addCrew.click()
    await expect(
      page.getByRole('heading', { name: 'Add Crew to Role' }),
    ).toBeVisible({ timeout: 15_000 })
    await expect(
      page.getByRole('button', { name: 'Add crew member' }),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Add and invite crew member' }),
    ).toBeVisible()
  })
})
