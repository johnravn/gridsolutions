import { expect, type Page, type Route } from '@playwright/test'
import {
  formatOfferMoney,
  formatOfferMoneyWhole,
  MONEY_PIPELINE,
  moneyPipelineExpected,
} from '../../src/features/jobs/utils/moneyPipeline.fixture'
import { clickJobTab } from './navigation'

export { MONEY_PIPELINE, moneyPipelineExpected, formatOfferMoney }

/** Assert one or more fixture money strings are visible in the given scope. */
export async function expectMoneyTexts(
  scope: Page | ReturnType<Page['getByRole']>,
  amounts: Array<number | string>,
) {
  for (const amount of amounts) {
    const text = typeof amount === 'number' ? formatOfferMoney(amount) : amount
    await expect(scope.getByText(text, { exact: true }).first()).toBeVisible({
      timeout: 15_000,
    })
  }
}

/** Pretty Totals use whole kroner. */
export async function expectPrettyMoneyTotal(
  scope: Page | ReturnType<Page['getByRole']>,
  amount: number,
) {
  const whole = formatOfferMoneyWhole(amount)
  await expect(scope.getByText(whole, { exact: true }).first()).toBeVisible({
    timeout: 15_000,
  })
}

export async function fillOfferMoneyFields(
  editor: ReturnType<Page['getByRole']>,
) {
  // Call before adding equipment lines so the first two number inputs are Days + Discount.
  const numberInputs = editor.locator('input[type="number"]')
  await expect(numberInputs.nth(0)).toBeVisible({ timeout: 10_000 })
  await numberInputs.nth(0).fill(String(MONEY_PIPELINE.daysOfUse))
  await numberInputs.nth(1).fill(String(MONEY_PIPELINE.discountPercent))
}

export async function addMoneyPipelineCustomEquipment(
  editor: ReturnType<Page['getByRole']>,
) {
  await editor.getByRole('tab', { name: 'Equipment' }).click()
  await editor.getByRole('button', { name: 'Add Group' }).click()
  await expect(editor.getByPlaceholder('Enter group name').last()).toBeVisible({
    timeout: 15_000,
  })
  await editor
    .getByPlaceholder('Enter group name')
    .last()
    .fill(MONEY_PIPELINE.equipmentGroupName)
  await editor
    .getByRole('button', { name: 'Add custom line' })
    .evaluate((el: HTMLButtonElement) => el.click())
  await editor
    .getByPlaceholder('Description (e.g. one-off fee)')
    .last()
    .fill(MONEY_PIPELINE.customLineDescription)
  await editor
    .locator('input[type="number"]')
    .last()
    .fill(String(MONEY_PIPELINE.dailyUnitPrice))
}

export async function assertOfferEditorTotals(
  editor: ReturnType<Page['getByRole']>,
) {
  await editor.getByRole('tab', { name: 'Totals' }).click()
  await expect(editor.getByRole('heading', { name: 'Totals' })).toBeVisible()
  await expectMoneyTexts(editor, [
    moneyPipelineExpected.equipmentSubtotal,
    moneyPipelineExpected.totalAfterDiscount,
    moneyPipelineExpected.totalWithVat,
  ])
}

export async function assignJobContaCustomer(page: Page, jobTitle: string) {
  await expect(page.getByRole('heading', { name: jobTitle })).toBeVisible({
    timeout: 15_000,
  })
  await page.getByRole('button', { name: 'Edit job' }).click()
  const dialog = page.getByRole('dialog').filter({
    has: page.getByRole('heading', { name: 'Edit job' }),
  })
  await expect(dialog).toBeVisible({ timeout: 15_000 })

  const customerInput = dialog.getByPlaceholder('Search customer…')
  await customerInput.click()
  await customerInput.fill(MONEY_PIPELINE.contaCustomerName)
  const option = page
    .locator('[data-searchable-select-dropdown]')
    .getByText(MONEY_PIPELINE.contaCustomerName, { exact: true })
  await expect(option).toBeVisible({ timeout: 15_000 })
  await option.click()

  const save = dialog.getByRole('button', { name: 'Save' })
  await expect(save).toBeEnabled({ timeout: 10_000 })
  await save.click()
  await expect(dialog).toBeHidden({ timeout: 20_000 })

  // Mobile may leave the inspector closed after edit; reopen so job tabs work.
  await expect(page.getByRole('heading', { name: jobTitle })).toBeVisible({
    timeout: 15_000,
  })
  const openInspector = page.getByRole('button', { name: 'Open inspector' })
  if (await openInspector.isVisible().catch(() => false)) {
    await openInspector.click({ force: true })
  }
  await expect(
    page
      .getByText('Tab', { exact: true })
      .or(page.getByRole('tab', { name: 'Offers', exact: true })),
  ).toBeVisible({ timeout: 15_000 })
}

export async function openInvoiceFromAcceptedOffer(page: Page) {
  await clickJobTab(page, 'Invoice')
  await expect(
    page.getByRole('heading', { name: 'Create invoice' }),
  ).toBeVisible({
    timeout: 15_000,
  })
  const fromOffer = page.getByRole('button', { name: 'From accepted offer' })
  await expect(fromOffer).toBeEnabled({ timeout: 20_000 })
  await fromOffer.click()

  const preview = page.getByRole('dialog').filter({
    has: page.getByText('Subtotal (ex VAT)'),
  })
  await expect(preview).toBeVisible({ timeout: 20_000 })
  return preview
}

export async function setOfferLineItemsExpanded(
  preview: ReturnType<Page['getByRole']>,
  expanded: boolean,
) {
  // Expand the settings card if collapsed
  const hint = preview.getByText(
    'Show individual equipment, crew, and transport lines from the offer',
  )
  if (!(await hint.isVisible().catch(() => false))) {
    await preview.getByText('Settings', { exact: true }).click()
  }
  await expect(hint).toBeVisible({ timeout: 10_000 })
  // First switch in the preview is Offer line items; VAT toggle is later.
  const switchControl = preview.getByRole('switch').first()
  await expect(switchControl).toBeEnabled({ timeout: 10_000 })
  const isChecked = await switchControl.isChecked()
  if (isChecked !== expanded) {
    await switchControl.click()
  }
  await expect(switchControl).toHaveAttribute(
    'data-state',
    expanded ? 'checked' : 'unchecked',
  )
}

export type ContaInvoiceMock = {
  getLastInvoiceBody: () => Record<string, unknown> | null
  dispose: () => Promise<void>
}

/**
 * Mock Conta gateway + local RPCs needed for Send Invoice without a real API key.
 */
export async function mockContaInvoiceRoutes(
  page: Page,
): Promise<ContaInvoiceMock> {
  let lastInvoiceBody: Record<string, unknown> | null = null

  const fulfillJson = async (route: Route, body: unknown) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    })
  }

  const rpcHandler = async (route: Route) => {
    const url = route.request().url()
    if (url.includes('get_conta_api_key')) {
      await fulfillJson(route, 'e2e-fake-conta-key')
      return
    }
    if (url.includes('get_accounting_api_environment')) {
      await fulfillJson(route, 'sandbox')
      return
    }
    if (url.includes('get_accounting_read_only')) {
      await fulfillJson(route, false)
      return
    }
    await route.continue()
  }

  const contaHandler = async (route: Route) => {
    const req = route.request()
    const url = req.url()
    const method = req.method()

    if (url.includes('/bank-accounts')) {
      await fulfillJson(route, [{ id: 1 }])
      return
    }

    if (url.includes('/projects')) {
      if (method === 'GET') {
        await fulfillJson(route, { hits: [], hitCount: 0, pageCount: 0 })
        return
      }
      if (method === 'POST') {
        await fulfillJson(route, { id: 999001 })
        return
      }
    }

    if (url.includes('/invoices') && method === 'POST') {
      try {
        lastInvoiceBody = req.postDataJSON() as Record<string, unknown>
      } catch {
        lastInvoiceBody = null
      }
      await fulfillJson(route, {
        id: 1,
        invoiceNo: 'E2E-42',
        invoiceFileId: null,
      })
      return
    }

    await fulfillJson(route, {})
  }

  await page.route('**/rest/v1/rpc/**', rpcHandler)
  await page.route(/api\.gateway\.conta/i, contaHandler)

  return {
    getLastInvoiceBody: () => lastInvoiceBody,
    dispose: async () => {
      await page.unroute('**/rest/v1/rpc/**', rpcHandler)
      await page.unroute(/api\.gateway\.conta/i, contaHandler)
    },
  }
}

export async function sendInvoiceAndCaptureContaBody(
  page: Page,
  preview: ReturnType<Page['getByRole']>,
) {
  const mock = await mockContaInvoiceRoutes(page)
  try {
    await preview.getByRole('button', { name: 'Send Invoice' }).click()
    const manual = page.getByRole('dialog').filter({
      has: page.getByRole('heading', { name: 'Customer cannot receive EHF' }),
    })
    await expect(manual).toBeVisible({ timeout: 20_000 })
    await manual
      .getByRole('button', { name: 'Download PDF and send myself' })
      .click()

    await expect
      .poll(() => mock.getLastInvoiceBody(), { timeout: 30_000 })
      .not.toBeNull()

    const body = mock.getLastInvoiceBody()!
    // Job status flips to invoiced and can drop the inspector (and its toast).
    const sent = page.getByText('Invoice sent successfully', { exact: true })
    await sent
      .first()
      .waitFor({ state: 'visible', timeout: 8_000 })
      .catch(() => undefined)

    return body
  } finally {
    await mock.dispose()
  }
}
