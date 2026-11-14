import { test } from './fixtures'
import { openLatestPage } from './helpers/navigation'

test.describe('Company Logs', () => {
  test('owner can open Company → Logs', async ({ authedPage: page }) => {
    await openLatestPage(page)
  })
})
