import { expect, test } from './fixtures'
import { createDraftJob, clickJobTab } from './helpers/navigation'

test.describe('Pretty offers', () => {
  test('offers tab supports pretty offer flow', async ({
    authedPage: page,
  }) => {
    await createDraftJob(page)

    await clickJobTab(page, 'Offers')
    await expect(page.getByRole('heading', { name: 'Offers' })).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByRole('button', { name: 'New basis' })).toBeVisible()
  })

  test('pretty offer editor shows module story fields', async ({
    authedPage: page,
  }) => {
    await createDraftJob(page)
    await clickJobTab(page, 'Offers')

    await page.getByRole('button', { name: 'New basis' }).click()

    const basisDialog = page.getByRole('dialog')
    await expect(basisDialog.getByText('Offer basis')).toBeVisible({
      timeout: 15_000,
    })
    await basisDialog.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText(/Offer basis (updated|created)/)).toBeVisible({
      timeout: 15_000,
    })
    await basisDialog.getByRole('button', { name: 'Close' }).click()

    await page
      .getByRole('button', { name: 'Create pretty offer' })
      .first()
      .click()

    const dialog = page.getByRole('dialog').filter({ hasText: 'Pretty Offer' })
    await expect(dialog).toBeVisible({ timeout: 15_000 })

    await dialog.getByRole('button', { name: 'Add' }).click()
    await expect(dialog.getByText('Story block 1')).toBeVisible()
    await expect(dialog.getByText('Hero media')).toBeVisible()
    await expect(dialog.getByPlaceholder('Paragraph text')).toBeVisible()
  })
})
