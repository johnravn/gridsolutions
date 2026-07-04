import { test } from './fixtures'
import { openMattersPage } from './helpers/navigation'

test.describe('Matters', () => {
  test('owner can open matters page', async ({ authedPage: page }) => {
    await openMattersPage(page)
  })
})
