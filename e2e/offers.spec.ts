import { test, expect } from './fixtures'
import { clickJobTab, createDraftJob, openJobsPage } from './helpers/navigation'
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
) {
  await clickJobTab(page, 'Offers')
  await expect(page.getByRole('heading', { name: 'Offers' })).toBeVisible({
    timeout: 15_000,
  })

  await page.getByRole('button', { name: 'New Offer' }).click()
  await expect(
    page.getByRole('heading', { name: 'Create New Offer' }),
  ).toBeVisible()

  await page.getByRole('button', { name: 'Create Technical Offer' }).click()

  const editor = technicalOfferEditor(page)
  await expect(editor).toBeVisible({ timeout: 20_000 })
  await expect(
    editor.getByRole('heading', { name: 'Edit Technical Offer' }),
  ).toBeVisible({ timeout: 20_000 })
  await expect(page.getByText('Offer created', { exact: true })).toBeVisible({
    timeout: 15_000,
  })
  await expect(editor.getByRole('button', { name: 'Sync' })).toBeEnabled({
    timeout: 15_000,
  })

  await editor.getByRole('tab', { name: 'Equipment' }).click()
  await editor.getByRole('button', { name: 'Add Group' }).click()
  await expect(editor.getByPlaceholder('Enter group name').last()).toBeVisible({
    timeout: 15_000,
  })
  await editor.getByPlaceholder('Enter group name').last().fill('E2E Equipment')
  await expect(
    editor.getByRole('button', { name: 'Add custom line' }),
  ).toBeVisible({ timeout: 10_000 })
  await editor.getByRole('button', { name: 'Add custom line' }).click()

  const description = editor
    .getByPlaceholder('Description (e.g. one-off fee)')
    .last()
  await description.fill(CUSTOM_LINE_LABEL)
  await editor.locator('input[type="number"]').last().fill('1000')

  await editor.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Offer updated', { exact: true })).toBeVisible({
    timeout: 15_000,
  })
  await expect(description).toHaveValue(CUSTOM_LINE_LABEL)

  await editor.getByRole('button', { name: 'Close' }).click()
  await expect(editor).toBeHidden({ timeout: 10_000 })
}

async function lockDraftOfferFromOffersTab(
  page: import('@playwright/test').Page,
) {
  await expect(page.getByRole('heading', { name: 'Offers' })).toBeVisible()

  await page.getByRole('button', { name: 'Offer actions' }).first().click()
  await page.getByRole('menuitem', { name: 'Lock & send' }).click()

  const linkDialog = page.getByRole('dialog', { name: 'Offer Link Ready' })
  await expect(linkDialog).toBeVisible({ timeout: 30_000 })

  const offerUrl = await linkDialog.locator('input').inputValue()
  expect(offerUrl).toMatch(/\/offer\//)

  await linkDialog.getByRole('button', { name: 'Close' }).click()
  await expect(linkDialog).toBeHidden()

  return offerUrl
}

async function acceptOfferOnPublicPage(
  page: import('@playwright/test').Page,
  offerUrl: string,
) {
  await page.goto(offerUrl)
  await expect(page.getByText(CUSTOM_LINE_LABEL).first()).toBeVisible({
    timeout: 15_000,
  })

  await expect(
    page.getByRole('button', { name: 'Offer actions' }),
  ).toBeVisible()

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
    await createTechnicalOfferWithCustomEquipment(page)
    const offerUrl = await lockDraftOfferFromOffersTab(page)

    const publicPage = await context.newPage()
    await acceptOfferOnPublicPage(publicPage, offerUrl)
    await publicPage.close()

    await page.bringToFront()
    if (!(await page.getByRole('heading', { name: jobTitle }).isVisible())) {
      await openJobsPage(page)
      await page
        .locator('span.rt-r-weight-bold')
        .filter({ hasText: jobTitle })
        .first()
        .click()
      await expect(page.getByRole('heading', { name: jobTitle })).toBeVisible({
        timeout: 15_000,
      })
    }
    await clickJobTab(page, 'Offers')
    await expect(async () => {
      await clickJobTab(page, 'Overview')
      await clickJobTab(page, 'Offers')
      await expect(page.getByText('accepted').first()).toBeVisible({
        timeout: 3_000,
      })
    }).toPass({ timeout: 30_000 })
  })
})
