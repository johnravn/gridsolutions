import { test, expect } from './fixtures'
import { clickJobTab, createDraftJob } from './helpers/navigation'
import {
  expectOfferBasisSaved,
  offerBasisEditor,
  readLockedOfferUrl,
  returnToOffersTabAfterBasisSave,
} from './helpers/offers'
import { openPublicOfferAction } from './helpers/public-offer'

const CUSTOM_LINE_LABEL = 'E2E test microphone'

function technicalOfferEditor(page: import('@playwright/test').Page) {
  return page.getByRole('dialog').filter({
    has: page.getByRole('heading', {
      name: /Technical Offer/i,
    }),
  })
}

async function createTechnicalOfferWithCustomEquipment(
  page: import('@playwright/test').Page,
  jobTitle: string,
) {
  await clickJobTab(page, 'Offers')
  await expect(page.getByRole('heading', { name: 'Offers' })).toBeVisible({
    timeout: 15_000,
  })

  await page.getByRole('button', { name: 'New basis' }).click()

  const basisEditor = offerBasisEditor(page)
  await expect(basisEditor).toBeVisible({ timeout: 20_000 })
  await basisEditor.getByRole('tab', { name: 'Equipment' }).click()
  await basisEditor.getByRole('button', { name: 'Add Group' }).click()
  await expect(
    basisEditor.getByPlaceholder('Enter group name').last(),
  ).toBeVisible({ timeout: 15_000 })
  await basisEditor
    .getByPlaceholder('Enter group name')
    .last()
    .fill('E2E Equipment')
  const addCustomLine = basisEditor.getByRole('button', {
    name: 'Add custom line',
  })
  await expect(addCustomLine).toBeVisible({ timeout: 10_000 })
  await addCustomLine.evaluate((el: HTMLButtonElement) => el.click())

  const description = basisEditor
    .getByPlaceholder('Description (e.g. one-off fee)')
    .last()
  await expect(description).toBeVisible({ timeout: 10_000 })
  await description.fill(CUSTOM_LINE_LABEL)
  await expect(description).toHaveValue(CUSTOM_LINE_LABEL)
  await basisEditor.locator('input[type="number"]').last().fill('1000')
  await expect(description).toHaveValue(CUSTOM_LINE_LABEL)

  await basisEditor.getByRole('button', { name: 'Save' }).click()
  await expectOfferBasisSaved(page)
  await returnToOffersTabAfterBasisSave(page, jobTitle)

  await page
    .getByRole('button', { name: 'Create technical offer' })
    .first()
    .click()

  const editor = technicalOfferEditor(page)
  await expect(editor).toBeVisible({ timeout: 20_000 })
  await expect(
    editor.getByRole('heading', { name: /Technical Offer/i }),
  ).toBeVisible({ timeout: 20_000 })
  await editor.getByRole('tab', { name: 'Equipment' }).click()
  const groupHeader = editor.getByText('(1 items)')
  await expect(groupHeader).toBeVisible({ timeout: 15_000 })
  await groupHeader.click()
  await expect(
    editor.getByPlaceholder('Description (e.g. one-off fee)').first(),
  ).toHaveValue(CUSTOM_LINE_LABEL, { timeout: 15_000 })

  await editor.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Offer updated', { exact: true })).toBeVisible({
    timeout: 15_000,
  })

  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
  await editor.getByRole('button', { name: 'Lock & send' }).click()
  const lockDialog = page.getByRole('dialog').filter({
    has: page.getByRole('heading', { name: 'Lock & send' }),
  })
  await expect(lockDialog).toBeVisible({ timeout: 15_000 })
  await lockDialog
    .getByRole('button', { name: "I'll send the link myself" })
    .click()
  await expect(lockDialog).toBeHidden({ timeout: 15_000 })

  await expect(
    page
      .getByText('Link copied', { exact: true })
      .or(page.getByText('Offer locked', { exact: true })),
  ).toBeVisible({ timeout: 30_000 })

  await returnToOffersTabAfterBasisSave(page, jobTitle)
  const offerUrl = await readLockedOfferUrl(page)
  expect(offerUrl).toMatch(/\/offer\//)
  return offerUrl
}

async function acceptOfferOnPublicPage(
  page: import('@playwright/test').Page,
  offerUrl: string,
) {
  await page.goto(offerUrl)
  await expect(page.getByText('Loading offer...')).toHaveCount(0, {
    timeout: 15_000,
  })
  await expect(page.getByText(CUSTOM_LINE_LABEL).first()).toBeVisible({
    timeout: 15_000,
  })

  await expect(page.getByRole('button', { name: 'Accept Offer' })).toBeVisible()

  await openPublicOfferAction(page, 'Accept Offer')
  await page.getByPlaceholder('First name').fill('E2E')
  await page.getByPlaceholder('Last name').fill('Acceptance')
  await page.getByPlaceholder('Enter phone number').fill('91234567')
  await page.getByRole('button', { name: 'Accept', exact: true }).click()

  await expect(page.getByText('Offer Accepted').first()).toBeVisible({
    timeout: 15_000,
  })
}

test.describe('Offers lifecycle', () => {
  test('owner can create, lock, and see customer acceptance', async ({
    authedPage: page,
    context,
  }) => {
    test.setTimeout(180_000)

    const jobTitle = await createDraftJob(page)
    const offerUrl = await createTechnicalOfferWithCustomEquipment(
      page,
      jobTitle,
    )

    const publicPage = await context.newPage()
    await acceptOfferOnPublicPage(publicPage, offerUrl)
    await publicPage.close()

    await page.bringToFront()
    await returnToOffersTabAfterBasisSave(page, jobTitle)
    await expect(async () => {
      await clickJobTab(page, 'Overview')
      await clickJobTab(page, 'Offers')
      await expect(page.getByText('accepted').first()).toBeVisible({
        timeout: 3_000,
      })
    }).toPass({ timeout: 45_000 })
  })
})
