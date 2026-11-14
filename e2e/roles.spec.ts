import { test, expect } from './fixtures'
import {
  openCalendarPage,
  openCompanyPage,
  openInventoryPage,
  openJobsPage,
} from './helpers/navigation'

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
    test.setTimeout(60_000)
    await openJobsPage(page)
    await openCalendarPage(page)
  })

  test('employee can access inventory', async ({ employeePage: page }) => {
    await openInventoryPage(page)
  })

  test('employee can open Company Logs but not manage settings', async ({
    employeePage: page,
  }) => {
    // visit:latest lets employees into /company for Logs only (not Overview/Users/…).
    await page.goto('/company')
    await expect(page).toHaveURL(/\/company/, { timeout: 15_000 })
    await expect(page.getByRole('tab', { name: 'Logs' })).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByRole('tab', { name: 'Overview' })).toHaveCount(0)
    await expect(page.getByRole('tab', { name: 'Users' })).toHaveCount(0)
    await expect(page.getByRole('tab', { name: 'Rates' })).toHaveCount(0)
  })

  test('owner can access company settings', async ({ authedPage: page }) => {
    await openCompanyPage(page)
  })
})
