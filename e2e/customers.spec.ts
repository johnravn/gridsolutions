import { test, expect } from './fixtures'
import { openCustomersPage } from './helpers/navigation'

test.describe('Customers', () => {
  test('owner can open customers page', async ({ authedPage: page }) => {
    await openCustomersPage(page)
  })

  test('owner can create a customer and open inspector', async ({
    authedPage: page,
  }) => {
    test.setTimeout(60_000)
    await openCustomersPage(page)

    await page.getByRole('button', { name: 'Add customer' }).click()
    const dialog = page.getByRole('dialog')
    await expect(
      dialog.getByRole('heading', { name: 'Add customer' }),
    ).toBeVisible()

    const customerName = `E2E Customer ${Date.now()}`
    await dialog.getByPlaceholder('Company or customer name').fill(customerName)
    await dialog.getByRole('button', { name: 'Create' }).click()

    await expect(dialog).toBeHidden({ timeout: 20_000 })
    await page.getByText(customerName, { exact: true }).click()
    await expect(
      page.getByText(customerName, { exact: true }).first(),
    ).toBeVisible({ timeout: 15_000 })
  })
})
