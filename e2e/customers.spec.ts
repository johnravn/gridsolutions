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
    await expect(dialog.getByText('Offer discount (%)')).toBeVisible()
    await dialog.getByPlaceholder('Company default').fill('15')

    const createButton = dialog.getByRole('button', { name: 'Create' })
    const createResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/rest/v1/customers') &&
        response.request().method() === 'POST' &&
        response.ok(),
      { timeout: 20_000 },
    )
    await createButton.click()
    await createResponse
    await expect(dialog).toBeHidden({ timeout: 20_000 })

    const searchInput = page.getByPlaceholder('Search customers…')
    await searchInput.fill(customerName)
    const customerRow = page.getByText(customerName, { exact: true })
    await expect(customerRow).toBeVisible({ timeout: 20_000 })
    await customerRow.click()
    await expect(customerRow.first()).toBeVisible({ timeout: 15_000 })
  })
})
