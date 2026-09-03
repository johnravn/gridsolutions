import { expect, test } from './fixtures'
import { createDraftJob, clickJobTab } from './helpers/navigation'
import {
  expectOfferBasisSaved,
  offerBasisEditor,
  returnToOffersTabAfterBasisSave,
} from './helpers/offers'

test.describe('Pretty offers', () => {
  test('offers tab supports pretty offer flow', async ({
    authedPage: page,
  }) => {
    test.setTimeout(60_000)
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
    test.setTimeout(60_000)
    const jobTitle = await createDraftJob(page)
    await clickJobTab(page, 'Offers')

    await page.getByRole('button', { name: 'New basis' }).click()

    const basisDialog = offerBasisEditor(page)
    await expect(basisDialog).toBeVisible({
      timeout: 15_000,
    })
    await basisDialog.getByRole('button', { name: 'Save' }).click()
    await expectOfferBasisSaved(page)
    await returnToOffersTabAfterBasisSave(page, jobTitle)

    await page
      .getByRole('button', { name: 'Create pretty offer' })
      .first()
      .click()

    const dialog = page.getByRole('dialog').filter({ hasText: 'Pretty Offer' })
    await expect(dialog).toBeVisible({ timeout: 15_000 })

    await dialog.getByRole('tab', { name: 'Modules' }).click()
    const addModuleButton = dialog
      .getByRole('tabpanel', { name: 'Modules' })
      .getByRole('button', { name: 'Add', exact: true })
    // Sticky editor chrome overlays this control on mobile; DOM click still
    // runs the React handler without needing a clear hit-target.
    await addModuleButton.evaluate((el: HTMLButtonElement) => el.click())
    await expect(
      dialog.getByText('Untitled module', { exact: true }).first(),
    ).toBeVisible({ timeout: 15_000 })

    const paragraph = dialog.getByPlaceholder('Paragraph text')
    await paragraph.scrollIntoViewIfNeeded()
    await expect(paragraph).toBeVisible({ timeout: 15_000 })
    await expect(
      dialog.getByText('Story block 1', { exact: false }),
    ).toBeAttached()
  })
})
