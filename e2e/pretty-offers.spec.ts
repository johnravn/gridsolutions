import { expect, test } from './fixtures'
import { createDraftJob, clickJobTab } from './helpers/navigation'

test.describe('Pretty offers', () => {
  test('pretty offers tab is available on a job', async ({
    authedPage: page,
  }) => {
    await createDraftJob(page)

    await clickJobTab(page, 'Pretty Offers')
    await expect(
      page.getByRole('heading', { name: 'Pretty Offers' }),
    ).toBeVisible({
      timeout: 15_000,
    })
    await expect(
      page.getByRole('button', { name: 'Create pretty offer' }),
    ).toBeVisible()
  })

  test('pretty offer editor shows pricing basis tab', async ({
    authedPage: page,
  }) => {
    await createDraftJob(page)
    await clickJobTab(page, 'Pretty Offers')

    await page.getByRole('button', { name: 'Create pretty offer' }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText('Pretty Offer')).toBeVisible({
      timeout: 15_000,
    })
    await expect(
      dialog.getByRole('tab', { name: 'Pricing basis' }),
    ).toBeVisible()
    await expect(
      dialog.getByRole('tab', { name: 'Subcontractors' }),
    ).not.toBeVisible()
  })
})
