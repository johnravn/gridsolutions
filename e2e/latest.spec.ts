import { test } from './fixtures'
import { openLatestPage } from './helpers/navigation'

test.describe('Latest feed', () => {
  test('owner can open latest page', async ({ authedPage: page }) => {
    await openLatestPage(page)
  })
})
