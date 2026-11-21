/** Normalize Conta / stored invoice_data for Accounting invoice display. */

export type ContaInvoiceDisplayLine = {
  lineNo: number | null
  description: string
  quantity: number
  price: number
  discount: number
  vatCode: string | null
  sumNet: number
}

export type ContaInvoiceDisplayHeader = {
  invoiceNo: string | null
  status: string | null
  invoiceDate: string | null
  invoiceDueDate: string | null
  /** Org / sender reference on the PDF. */
  orgReference: string | null
  customerReference: string | null
  /** Personal message / invoice title text on the PDF. */
  personalMessage: string | null
  ehfOrderReference: string | null
  currency: string | null
  kid: string | null
  projectId: string | null
  customerId: string | null
  sumNet: number | null
  sumVat: number | null
  sumTotal: number | null
}

export type ContaInvoiceDisplay = {
  header: ContaInvoiceDisplayHeader
  lines: Array<ContaInvoiceDisplayLine>
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function asString(value: unknown): string | null {
  if (value == null) return null
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : null
  }
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return null
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100
}

function lineNet(price: number, quantity: number, discount: number): number {
  return roundMoney(price * quantity * (1 - discount / 100))
}

export function parseContaInvoiceLines(
  invoiceLines: unknown,
): Array<ContaInvoiceDisplayLine> {
  if (!Array.isArray(invoiceLines)) return []
  const rows: Array<ContaInvoiceDisplayLine> = []
  invoiceLines.forEach((line, index) => {
    const row = asRecord(line)
    if (!row) return
    const price = asNumber(row.price) ?? 0
    const quantity = asNumber(row.quantity) ?? 0
    const discount = asNumber(row.discount) ?? 0
    const sumNet = asNumber(row.sumNet) ?? lineNet(price, quantity, discount)
    rows.push({
      lineNo: asNumber(row.lineNo) ?? index + 1,
      description: asString(row.description) ?? '—',
      quantity,
      price,
      discount,
      vatCode: asString(row.vatCode),
      sumNet,
    })
  })
  return rows
}

function headerFromSource(
  source: Record<string, unknown> | null,
  fallbacks: {
    invoiceNo?: string | null
    status?: string | null
  } = {},
): ContaInvoiceDisplayHeader {
  const lines = parseContaInvoiceLines(source?.invoiceLines)
  const linesNet =
    lines.length > 0
      ? roundMoney(lines.reduce((sum, line) => sum + line.sumNet, 0))
      : null

  return {
    invoiceNo:
      asString(source?.invoiceNo) ??
      asString(source?.id) ??
      fallbacks.invoiceNo ??
      null,
    status: asString(source?.status) ?? fallbacks.status ?? null,
    invoiceDate: asString(source?.invoiceDate),
    invoiceDueDate: asString(source?.invoiceDueDate),
    orgReference: asString(source?.orgReference),
    customerReference: asString(source?.customerReference),
    personalMessage: asString(source?.personalMessage),
    ehfOrderReference:
      asString(source?.ehfOrderReference) ??
      asString(source?.ehfAdditionalDocumentReference),
    currency: asString(source?.invoiceCurrency) ?? 'NOK',
    kid: asString(source?.kid),
    projectId: asString(source?.projectId),
    customerId: asString(source?.customerId),
    sumNet: asNumber(source?.sumNet) ?? linesNet,
    sumVat: asNumber(source?.sumVAT) ?? asNumber(source?.sumVat),
    sumTotal:
      asNumber(source?.sumTotal) ??
      asNumber(source?.amount) ??
      asNumber(source?.totalAmount),
  }
}

/**
 * Prefer live Conta payload, then stored conta_response, then invoice_data
 * (what we sent). Lines always prefer the richest invoiceLines array found.
 */
export function buildContaInvoiceDisplay(input: {
  invoice_data?: unknown
  conta_response?: unknown
  fetched?: unknown
  conta_invoice_id?: string | null
  status?: string | null
}): ContaInvoiceDisplay {
  const fetched = asRecord(input.fetched)
  const response = asRecord(input.conta_response)
  const stored = asRecord(input.invoice_data)

  const primary = fetched ?? response ?? stored
  const header = headerFromSource(primary, {
    invoiceNo: input.conta_invoice_id,
    status: input.status,
  })

  // Fill missing header fields from older sources without overwriting.
  const mergeHeader = (
    base: ContaInvoiceDisplayHeader,
    fill: ContaInvoiceDisplayHeader,
  ): ContaInvoiceDisplayHeader => ({
    invoiceNo: base.invoiceNo ?? fill.invoiceNo,
    status: base.status ?? fill.status,
    invoiceDate: base.invoiceDate ?? fill.invoiceDate,
    invoiceDueDate: base.invoiceDueDate ?? fill.invoiceDueDate,
    orgReference: base.orgReference ?? fill.orgReference,
    customerReference: base.customerReference ?? fill.customerReference,
    personalMessage: base.personalMessage ?? fill.personalMessage,
    ehfOrderReference: base.ehfOrderReference ?? fill.ehfOrderReference,
    currency: base.currency ?? fill.currency,
    kid: base.kid ?? fill.kid,
    projectId: base.projectId ?? fill.projectId,
    customerId: base.customerId ?? fill.customerId,
    sumNet: base.sumNet ?? fill.sumNet,
    sumVat: base.sumVat ?? fill.sumVat,
    sumTotal: base.sumTotal ?? fill.sumTotal,
  })

  let mergedHeader = header
  for (const source of [response, stored]) {
    if (!source || source === primary) continue
    mergedHeader = mergeHeader(
      mergedHeader,
      headerFromSource(source, {
        invoiceNo: input.conta_invoice_id,
        status: input.status,
      }),
    )
  }

  const lines =
    parseContaInvoiceLines(fetched?.invoiceLines).length > 0
      ? parseContaInvoiceLines(fetched?.invoiceLines)
      : parseContaInvoiceLines(response?.invoiceLines).length > 0
        ? parseContaInvoiceLines(response?.invoiceLines)
        : parseContaInvoiceLines(stored?.invoiceLines)

  if (mergedHeader.sumNet == null && lines.length > 0) {
    mergedHeader = {
      ...mergedHeader,
      sumNet: roundMoney(lines.reduce((sum, line) => sum + line.sumNet, 0)),
    }
  }

  return { header: mergedHeader, lines }
}

export function formatContaInvoiceMoney(amount: number | null): string {
  if (amount == null || !Number.isFinite(amount)) return '—'
  return new Intl.NumberFormat('nb-NO', {
    style: 'currency',
    currency: 'NOK',
    minimumFractionDigits: 2,
  }).format(amount)
}

/** Conta vatCode → percent. Unknown codes default to high (25%). */
export function contaVatCodeToPercent(
  vatCode: string | null | undefined,
): number {
  if (!vatCode || vatCode === 'no.vat') return 0
  if (vatCode === 'high') return 25
  if (vatCode === 'medium') return 15
  if (vatCode === 'low') return 10
  return 25
}

/**
 * Gross (incl. MVA) total from Conta-style invoice lines.
 * Returns null when there are no lines.
 */
export function invoiceLinesGrossTotal(invoiceLines: unknown): number | null {
  const lines = parseContaInvoiceLines(invoiceLines)
  if (lines.length === 0) return null
  let total = 0
  for (const line of lines) {
    const vatPercent = contaVatCodeToPercent(line.vatCode)
    total += line.sumNet * (1 + vatPercent / 100)
  }
  return roundMoney(total)
}

/**
 * Invoice tab / history gross total (incl. MVA).
 *
 * Conta’s invoice model uses `sumTotal` / `sumNet` / `sumVAT`. Older UI code
 * incorrectly preferred `sumRemaining`, which is **0 for paid invoices** and
 * is a balance remaining — not the invoice total.
 *
 * Prefer Conta header totals, then line math from the richest available source.
 * Never treat `sumRemaining` as the invoice total.
 */
export function resolveContaInvoiceGrossTotal(input: {
  invoice_data?: unknown
  conta_response?: unknown
  fetched?: unknown
}): number | null {
  const display = buildContaInvoiceDisplay(input)
  if (display.header.sumTotal != null) {
    return roundMoney(display.header.sumTotal)
  }

  const sumNet = display.header.sumNet
  const sumVat = display.header.sumVat
  if (
    sumNet != null &&
    sumVat != null &&
    Number.isFinite(sumNet) &&
    Number.isFinite(sumVat)
  ) {
    return roundMoney(sumNet + sumVat)
  }

  const fetched = asRecord(input.fetched)
  const response = asRecord(input.conta_response)
  const stored = asRecord(input.invoice_data)
  for (const source of [fetched, response, stored]) {
    const fromLines = invoiceLinesGrossTotal(source?.invoiceLines)
    if (fromLines != null) return fromLines
  }

  if (display.lines.length > 0) {
    return invoiceLinesGrossTotal(
      display.lines.map((line) => ({
        price: line.price,
        quantity: line.quantity,
        discount: line.discount,
        vatCode: line.vatCode,
        sumNet: line.sumNet,
      })),
    )
  }

  return null
}

/** True when stored Conta / invoice_data already has displayable lines. */
export function hasContaInvoiceDisplayLines(
  input: Parameters<typeof buildContaInvoiceDisplay>[0],
): boolean {
  return buildContaInvoiceDisplay(input).lines.length > 0
}
