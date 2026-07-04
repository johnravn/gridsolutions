import { test, expect } from './fixtures'
import { openHomePage, openJobsPage } from './helpers/navigation'

test.describe('Home dashboard', () => {
  test('owner can navigate to home dashboard', async ({ authedPage: page }) => {
    test.setTimeout(60_000)
    await openJobsPage(page)
    await openHomePage(page)
  })
})
