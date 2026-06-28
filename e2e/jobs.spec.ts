import { test, expect } from './fixtures'

async function openJobsPage(page: import('@playwright/test').Page) {
  await page.getByRole('link', { name: 'Jobs', exact: true }).click()
  await expect(page).toHaveURL(/\/jobs/)
  await expect(
    page.getByRole('heading', { name: 'Jobs', exact: true }),
  ).toBeVisible({
    timeout: 15_000,
  })
}

test.describe('Jobs', () => {
  test('owner can open jobs page', async ({ authedPage: page }) => {
    await openJobsPage(page)
    await expect(
      page.getByRole('button', { name: 'New job' }).first(),
    ).toBeVisible()
  })

  test('owner can create a draft job', async ({ authedPage: page }) => {
    await openJobsPage(page)
    await page.getByRole('button', { name: 'New job' }).first().click()

    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText('New job')).toBeVisible()
    await dialog.getByRole('button', { name: 'Auto-fill' }).click()

    const title = `E2E Job ${Date.now()}`
    await dialog.getByRole('textbox').first().fill(title)
    await dialog.getByRole('button', { name: 'Create' }).click()

    await expect(page.getByRole('heading', { name: title })).toBeVisible({
      timeout: 20_000,
    })
  })
})
