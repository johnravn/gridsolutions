import { test, expect } from './fixtures'
import { openInventoryPage } from './helpers/navigation'

test.describe('Inventory', () => {
  test('owner can open inventory and search', async ({ authedPage: page }) => {
    await openInventoryPage(page)

    const search = page.getByPlaceholder(/search/i).first()
    await search.fill('Test')
    await expect(search).toHaveValue('Test')
  })

  test('owner can add an item and see it in the list', async ({
    authedPage: page,
  }) => {
    test.setTimeout(60_000)
    await openInventoryPage(page)

    await page.getByRole('button', { name: 'Add item' }).click()
    const dialog = page.getByRole('dialog')
    await expect(
      dialog.getByRole('heading', { name: 'Add item to inventory' }),
    ).toBeVisible()

    const itemName = `E2E Item ${Date.now()}`
    await dialog.getByPlaceholder('e.g. XLR 3m').fill(itemName)
    await dialog.getByRole('button', { name: 'Create' }).click()

    await expect(
      page
        .getByRole('status')
        .filter({ hasText: 'Item was added to inventory' }),
    ).toBeVisible({
      timeout: 20_000,
    })
    await expect(dialog).toBeHidden({ timeout: 20_000 })

    await page.getByPlaceholder('Search items, groups…').fill(itemName)
    await expect(page.getByText(itemName, { exact: true })).toBeVisible({
      timeout: 15_000,
    })
  })
})
