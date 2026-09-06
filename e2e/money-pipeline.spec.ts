import { test, expect } from './fixtures'
import { clickJobTab, createDraftJob, openJobsPage } from './helpers/navigation'
import {
  expectOfferBasisSaved,
  offerBasisEditor,
  readLockedOfferUrl,
  returnToOffersTabAfterBasisSave,
  closeOfferEditors,
} from './helpers/offers'
import { openPublicOfferAction } from './helpers/public-offer'
import {
  MONEY_PIPELINE,
  moneyPipelineExpected,
  addMoneyPipelineCustomEquipment,
  assertOfferEditorTotals,
  assignJobContaCustomer,
  expectMoneyTexts,
  expectPrettyMoneyTotal,
  fillOfferMoneyFields,
  openInvoiceFromAcceptedOffer,
  sendInvoiceAndCaptureContaBody,
  setOfferLineItemsExpanded,
  formatOfferMoney,
} from './helpers/money'

function technicalOfferEditor(page: import('@playwright/test').Page) {
  return page.getByRole('dialog').filter({
    has: page.getByRole('heading', { name: /Technical Offer/i }),
  })
}

function prettyOfferEditor(page: import('@playwright/test').Page) {
  return page.getByRole('dialog').filter({
    has: page.getByRole('heading', { name: /Pretty Offer/i }),
  })
}

async function createMoneyPipelineBasis(
  page: import('@playwright/test').Page,
  jobTitle: string,
) {
  await clickJobTab(page, 'Offers')
  await expect(page.getByRole('heading', { name: 'Offers' })).toBeVisible({
    timeout: 15_000,
  })

  await page.getByRole('button', { name: 'New basis' }).click()
  const basis = offerBasisEditor(page)
  await expect(basis).toBeVisible({ timeout: 20_000 })

  await fillOfferMoneyFields(basis)
  await addMoneyPipelineCustomEquipment(basis)
  await assertOfferEditorTotals(basis)

  await basis.getByRole('button', { name: 'Save' }).click()
  await expectOfferBasisSaved(page)
  await returnToOffersTabAfterBasisSave(page, jobTitle)
}

async function assertPrettyTotalsFromBasis(
  page: import('@playwright/test').Page,
  jobTitle: string,
) {
  await page
    .getByRole('button', { name: 'Create pretty offer' })
    .first()
    .click()
  const pretty = prettyOfferEditor(page)
  await expect(pretty).toBeVisible({ timeout: 20_000 })

  await pretty.getByRole('tab', { name: 'Modules' }).click()
  const addModule = pretty
    .getByRole('tabpanel', { name: 'Modules' })
    .getByRole('button', { name: 'Add', exact: true })
  await addModule.evaluate((el: HTMLButtonElement) => el.click())
  await expect(
    pretty.getByText('Untitled module', { exact: true }).first(),
  ).toBeVisible({ timeout: 15_000 })

  const titleField = pretty.getByPlaceholder('e.g. Audio').first()
  await expect(titleField).toBeVisible({ timeout: 10_000 })
  await titleField.fill(MONEY_PIPELINE.equipmentGroupName)

  await pretty.getByRole('tab', { name: 'Pricing basis' }).click()
  const existingBasisTab = pretty.locator('.pretty-offer-basis-tab').first()
  if (!(await existingBasisTab.isVisible().catch(() => false))) {
    await pretty
      .getByRole('button', { name: 'Offer basis', exact: true })
      .first()
      .click()
  }
  const markupLabel = pretty.getByText(/Apply subcontractor markup/)
  if (await markupLabel.isVisible().catch(() => false)) {
    const checkbox = pretty.getByRole('checkbox').first()
    if (await checkbox.isChecked()) {
      await checkbox.click()
    }
  }
  const getSplits = pretty.getByRole('button', {
    name: 'Get splits from categories',
  })
  if (await getSplits.isVisible().catch(() => false)) {
    // Sticky tab chrome intercepts normal clicks on mobile viewports.
    await getSplits.evaluate((el: HTMLButtonElement) => el.click())
  }

  await pretty.getByRole('tab', { name: 'Totals' }).click()
  await expectPrettyMoneyTotal(pretty, moneyPipelineExpected.totalWithVat)
  await closeOfferEditors(page)
  await returnToOffersTabAfterBasisSave(page, jobTitle)
}

async function createTechnicalFromBasis(page: import('@playwright/test').Page) {
  const bigButton = page.getByRole('button', { name: 'Create technical offer' })
  if (
    await bigButton
      .first()
      .isVisible()
      .catch(() => false)
  ) {
    await bigButton.first().click()
  } else {
    await page
      .getByRole('button', { name: 'Create offer' })
      .first()
      .click({ force: true })
    await page
      .getByRole('menuitem', { name: /Create technical offer/i })
      .click()
  }

  const tech = technicalOfferEditor(page)
  await expect(tech).toBeVisible({ timeout: 20_000 })
  await assertOfferEditorTotals(tech)

  await tech.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Offer updated', { exact: true })).toBeVisible({
    timeout: 15_000,
  })

  return tech
}

async function lockAndSendTechnical(
  page: import('@playwright/test').Page,
  tech: ReturnType<typeof technicalOfferEditor>,
  jobTitle: string,
) {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
  await tech.getByRole('button', { name: 'Lock & send' }).click()
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

async function reopenJobOffers(
  page: import('@playwright/test').Page,
  jobTitle: string,
) {
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
}

test.describe('Money pipeline', () => {
  // Conta mock + long job journey; avoid parallel workers racing the same DB seed.
  test.describe.configure({ mode: 'serial' })

  test('basis → pretty → technical → public → invoice → Conta payload', async ({
    authedPage: page,
    context,
  }) => {
    test.setTimeout(300_000)

    const jobTitle = await createDraftJob(page)
    await assignJobContaCustomer(page, jobTitle)

    await createMoneyPipelineBasis(page, jobTitle)
    await assertPrettyTotalsFromBasis(page, jobTitle)

    const tech = await createTechnicalFromBasis(page)
    const offerUrl = await lockAndSendTechnical(page, tech, jobTitle)

    await expect(
      page.getByText(formatOfferMoney(moneyPipelineExpected.totalWithVat), {
        exact: true,
      }),
    ).toBeVisible({ timeout: 15_000 })

    const publicPage = await context.newPage()
    await publicPage.goto(offerUrl)
    await expect(
      publicPage.getByText(MONEY_PIPELINE.customLineDescription).first(),
    ).toBeVisible({ timeout: 15_000 })
    await expectMoneyTexts(publicPage, [moneyPipelineExpected.totalWithVat])

    await openPublicOfferAction(publicPage, 'Accept Offer')
    await publicPage.getByPlaceholder('First name').fill('E2E')
    await publicPage.getByPlaceholder('Last name').fill('Money')
    await publicPage.getByPlaceholder('Enter phone number').fill('91234567')
    await publicPage
      .getByRole('button', { name: 'Accept', exact: true })
      .click()
    await expect(publicPage.getByText('Offer Accepted').first()).toBeVisible({
      timeout: 15_000,
    })
    await publicPage.close()

    await page.bringToFront()
    await reopenJobOffers(page, jobTitle)
    await expect(async () => {
      await clickJobTab(page, 'Overview')
      await clickJobTab(page, 'Offers')
      await expect(page.getByText('accepted').first()).toBeVisible({
        timeout: 3_000,
      })
    }).toPass({ timeout: 30_000 })

    const preview = await openInvoiceFromAcceptedOffer(page)
    await expectMoneyTexts(preview, [
      moneyPipelineExpected.totalAfterDiscount,
      moneyPipelineExpected.vatAmount,
      moneyPipelineExpected.totalWithVat,
    ])

    await setOfferLineItemsExpanded(preview, true)
    await expect(
      preview.getByText(MONEY_PIPELINE.customLineDescription).first(),
    ).toBeVisible({ timeout: 15_000 })
    await expectMoneyTexts(preview, [
      moneyPipelineExpected.totalAfterDiscount,
      moneyPipelineExpected.vatAmount,
      moneyPipelineExpected.totalWithVat,
    ])

    const body = await sendInvoiceAndCaptureContaBody(page, preview)
    const lines = body.invoiceLines as Array<{
      description?: string
      quantity?: number
      price?: number
      discount?: number
    }>
    expect(Array.isArray(lines)).toBe(true)
    expect(lines.length).toBeGreaterThanOrEqual(1)
    const equipmentLine = lines.find(
      (l) =>
        l.description?.includes(MONEY_PIPELINE.customLineDescription) ||
        l.price === moneyPipelineExpected.expandedLine.unitPrice,
    )
    expect(equipmentLine).toBeTruthy()
    expect(equipmentLine?.quantity).toBe(MONEY_PIPELINE.quantity)
    expect(equipmentLine?.discount).toBe(MONEY_PIPELINE.discountPercent)
    expect(equipmentLine?.price).toBe(
      moneyPipelineExpected.expandedLine.unitPrice,
    )
  })
})
