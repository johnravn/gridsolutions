import { test, expect } from './fixtures'
import { createDraftJob, openJobsPage } from './helpers/navigation'

async function createTechnicalOfferWithEquipment(
  page: import('@playwright/test').Page,
) {
  await page.getByRole('tab', { name: 'Offers' }).click()
  await expect(page.getByRole('heading', { name: 'Offers' })).toBeVisible({
    timeout: 15_000,
  })

  await page.getByRole('button', { name: 'New Offer' }).click()
  await expect(
    page.getByRole('heading', { name: 'Create New Offer' }),
  ).toBeVisible()

  await page.getByRole('button', { name: 'Create Technical Offer' }).click()

  const editor = page.getByRole('dialog').filter({
    has: page.getByRole('heading', {
      name: /Technical Offer/i,
    }),
  })
  await expect(editor).toBeVisible({ timeout: 20_000 })

  await editor.getByRole('tab', { name: 'Equipment' }).click()
  await editor.getByRole('button', { name: 'Add Group' }).click()
  await expect(editor.getByPlaceholder('Enter group name')).toBeVisible({
    timeout: 15_000,
  })
  const addCustomLine = editor.getByRole('button', { name: 'Add custom line' })
  await expect(addCustomLine).toBeVisible({ timeout: 15_000 })
  await addCustomLine.click()

  await editor
    .getByPlaceholder('Description (e.g. one-off fee)')
    .fill('E2E test microphone')

  const unitPriceInput = editor
    .locator('input[type="number"][step="0.01"]')
    .last()
  await unitPriceInput.fill('1000')

  await editor.getByRole('button', { name: 'Save' }).click()
  await expect(editor.getByRole('button', { name: 'Saving…' })).toBeHidden({
    timeout: 20_000,
  })
  await expect(
    editor.getByRole('heading', { name: 'Edit Technical Offer' }),
  ).toBeVisible({ timeout: 15_000 })

  await editor.getByRole('button', { name: 'Close' }).click()

  const unsavedDialog = page.getByRole('dialog').filter({
    has: page.getByRole('heading', { name: 'Unsaved changes' }),
  })
  if (await unsavedDialog.isVisible()) {
    await unsavedDialog.getByRole('button', { name: 'Save & close' }).click()
    await expect(editor.getByRole('button', { name: 'Saving…' })).toBeHidden({
      timeout: 20_000,
    })
  }

  await expect(editor).toBeHidden({ timeout: 10_000 })
}

async function lockOfferFromOffersTab(page: import('@playwright/test').Page) {
  await page.getByRole('tab', { name: 'Offers' }).click()
  await expect(page.getByRole('heading', { name: 'Offers' })).toBeVisible({
    timeout: 15_000,
  })

  await page.getByRole('button', { name: 'Offer actions' }).first().click()
  await page.getByRole('menuitem', { name: /Lock & send/i }).click()

  const linkDialog = page.getByRole('dialog').filter({
    has: page.getByRole('heading', { name: 'Offer Link Ready' }),
  })
  await expect(linkDialog).toBeVisible({ timeout: 20_000 })

  const offerUrl = await linkDialog.locator('input[readonly]').inputValue()
  expect(offerUrl).toMatch(/\/offer\//)

  await linkDialog.getByRole('button', { name: 'Close' }).click()
  return offerUrl
}

async function acceptOfferOnPublicPage(
  page: import('@playwright/test').Page,
  offerUrl: string,
) {
  await page.goto(offerUrl)
  await expect(page.getByText('E2E test microphone').first()).toBeVisible({
    timeout: 15_000,
  })
  await expect(page.getByRole('button', { name: 'Accept Offer' })).toBeVisible()

  await page.getByRole('button', { name: 'Accept Offer' }).click()
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
    test.setTimeout(90_000)

    const jobTitle = await createDraftJob(page)
    await createTechnicalOfferWithEquipment(page)

    const offerUrl = await lockOfferFromOffersTab(page)

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
    await page.getByRole('tab', { name: 'Offers' }).click()
    await expect(async () => {
      await page.getByRole('tab', { name: 'Overview' }).click()
      await page.getByRole('tab', { name: 'Offers' }).click()
      await expect(page.getByText('accepted').first()).toBeVisible({
        timeout: 3_000,
      })
    }).toPass({ timeout: 30_000 })
  })
})
