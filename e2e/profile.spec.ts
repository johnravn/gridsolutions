import { test } from './fixtures'
import { openProfilePage } from './helpers/navigation'

test.describe('Profile', () => {
  test('owner can open profile page', async ({ authedPage: page }) => {
    await openProfilePage(page)
  })
})
