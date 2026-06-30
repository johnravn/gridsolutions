import { test, expect } from './fixtures'

test.describe('Role-based access', () => {
  test('freelancer cannot see inventory in navigation', async ({
    freelancerPage: page,
  }) => {
    const inventoryLink = page.getByRole('link', {
      name: 'Inventory',
      exact: true,
    })
    await expect(inventoryLink).toHaveCount(0)
  })

  test('freelancer is redirected from protected routes', async ({
    freelancerPage: page,
  }) => {
    for (const path of ['/inventory', '/crew', '/company']) {
      await page.goto(path)
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 })
    }
  })

  test('freelancer can access jobs and calendar', async ({
    freelancerPage: page,
  }) => {
    await page.getByRole('link', { name: 'Jobs', exact: true }).click()
    await expect(page).toHaveURL(/\/jobs/)
    await expect(
      page.getByRole('heading', { name: 'Jobs', exact: true }),
    ).toBeVisible({ timeout: 15_000 })

    await page.getByRole('link', { name: 'Calendar', exact: true }).click()
    await expect(page).toHaveURL(/\/calendar/)
    await expect(page.getByRole('heading', { name: /2026/ })).toBeVisible({
      timeout: 15_000,
    })
  })

  test('employee can access inventory', async ({ employeePage: page }) => {
    await page.getByRole('link', { name: 'Inventory', exact: true }).click()
    await expect(page).toHaveURL(/\/inventory/)
    await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible({
      timeout: 15_000,
    })
  })

  test('employee is redirected from company settings', async ({
    employeePage: page,
  }) => {
    await page.goto('/company')
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 })
  })

  test('owner can access company settings', async ({ authedPage: page }) => {
    await page.getByRole('link', { name: 'Company', exact: true }).click()
    await expect(page).toHaveURL(/\/company/)
    await expect(
      page.getByRole('heading', { name: 'Grid Test Company' }),
    ).toBeVisible({ timeout: 15_000 })
  })
})
