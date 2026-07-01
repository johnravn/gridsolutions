import { expect, test } from './fixtures'
import { createDraftJob } from './helpers/navigation'

test.describe('Pretty offers', () => {
  test('pretty offers tab is available on a job', async ({
    authedPage: page,
  }) => {
    await createDraftJob(page)

    await page.getByRole('tab', { name: 'Pretty Offers' }).click()
    await expect(
      page.getByRole('heading', { name: 'Pretty Offers' }),
    ).toBeVisible({
      timeout: 15_000,
    })
    await expect(
      page.getByRole('button', { name: 'Create pretty offer' }),
    ).toBeVisible()
  })
})
