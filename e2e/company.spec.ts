import { test } from './fixtures'
import { openCompanyPage } from './helpers/navigation'

test.describe('Company', () => {
  test('owner can open company settings', async ({ authedPage: page }) => {
    await openCompanyPage(page)
  })
})
