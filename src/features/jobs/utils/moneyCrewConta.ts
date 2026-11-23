/** Conta supplier-ledger fetch for crew orgnr expense matching (#174). */

import { normalizeOrgNo } from '@shared/conta/contaCustomerMatch'
import { pickContaSupplierIdByOrgNo } from './moneyConta'
import { contaLedgerLineKey } from './moneySuggestions'

export type CrewContaLedgerLine = {
  id?: number
  date?: string
  dueDate?: string
  description?: string
  amount?: number
  invoiceNo?: string
  invoiceId?: number
  transactionId?: number
  /** Conta bilag number (UI “Bilag”) — not the internal `transactionId`. */
  transactionNo?: number
  transactionSourceType?: string
  supplierName?: string
  supplierOrgNo?: string
  supplierId?: number
  bookkeepingAccountName?: string
  externalUrl?: string | null
}

export type CrewContaTransactionUrlInput = {
  orgId: string
  /** Conta `transactionNo` (bilag number). */
  bilagNo: number | null | undefined
  date?: string | null
}

type ContaGet = (path: string) => Promise<unknown>

type SupplierLedgerReport = {
  bookkeepingAccountLedgers?: Array<{
    name?: string
    orgNo?: string
    sumChanged?: number
    ledgerLines?: Array<CrewContaLedgerLine>
  }>
}

type SupplierSearchResult = {
  hits?: Array<{ id?: number; orgNo?: string | null }>
}

export type FetchCrewContaInvoiceLinesInput = {
  orgId: string
  orgNumbers: Array<string>
  startDate: string
  endDate: string
  get: ContaGet
  transactionUrl: (input: CrewContaTransactionUrlInput) => string | null
  /** Cap lines per ledger request (default 200). */
  maxTransactionsPerPage?: number
}

/**
 * Resolve Conta suppliers by orgnr, then pull supplier-scoped ledgers in parallel.
 * One unscoped window scan covers orgnrs without a supplier hit (not N scans).
 */
export async function fetchCrewContaInvoiceLines(
  input: FetchCrewContaInvoiceLinesInput,
): Promise<Array<CrewContaLedgerLine>> {
  const {
    orgId,
    orgNumbers,
    startDate,
    endDate,
    get,
    transactionUrl,
    maxTransactionsPerPage = 200,
  } = input

  if (!orgNumbers.length) return []

  const out: Array<CrewContaLedgerLine> = []
  const seen = new Set<string>()

  const pushLine = (
    line: CrewContaLedgerLine,
    supplierOrgNo: string,
    supplierName?: string | null,
  ) => {
    const key = contaLedgerLineKey(line)
    if (seen.has(key)) return
    seen.add(key)
    out.push({
      ...line,
      supplierName: line.supplierName || supplierName || undefined,
      supplierOrgNo,
      externalUrl: transactionUrl({
        orgId,
        bilagNo: line.transactionNo ?? null,
        date: line.date ?? null,
      }),
    })
  }

  const fetchLedger = async (
    supplierId: number | null,
    /** When set, stamp/filter lines to these org numbers. */
    acceptOrgNos: Set<string>,
  ) => {
    const params = new URLSearchParams({
      includeLedgerLines: 'true',
      includeClosedLedgerLines: 'true',
      includeOldTransactions: 'true',
      maxTransactionsPerPage: String(maxTransactionsPerPage),
      startDate,
      endDate,
    })
    if (supplierId != null) params.set('supplierId', String(supplierId))

    const report = (await get(
      `/accounting/organizations/${orgId}/reports/supplier-ledger?${params.toString()}`,
    )) as SupplierLedgerReport

    for (const ledger of report.bookkeepingAccountLedgers || []) {
      const ledgerOrg = normalizeOrgNo(ledger.orgNo)
      const lines = ledger.ledgerLines || []

      if (supplierId != null) {
        // Supplier-scoped: stamp the known orgnr even if Conta omits it on lines.
        const stampOrg = [...acceptOrgNos][0]
        if (!stampOrg) continue
        if (lines.length === 0) {
          const amount = Math.abs(Number(ledger.sumChanged ?? 0))
          if (amount > 0) {
            pushLine(
              {
                amount: ledger.sumChanged,
                description: ledger.name || 'Conta supplier ledger',
                supplierName: ledger.name,
                supplierOrgNo: stampOrg,
              },
              stampOrg,
              ledger.name,
            )
          }
          continue
        }
        for (const line of lines) {
          pushLine(line, stampOrg, ledger.name)
        }
        continue
      }

      for (const line of lines) {
        const lineOrg = normalizeOrgNo(line.supplierOrgNo || ledger.orgNo || '')
        const matched =
          (lineOrg && acceptOrgNos.has(lineOrg) && lineOrg) ||
          (ledgerOrg && acceptOrgNos.has(ledgerOrg) && ledgerOrg) ||
          null
        if (!matched) continue
        pushLine(line, matched, ledger.name || line.supplierName)
      }
    }
  }

  const supplierIds = await Promise.all(
    orgNumbers.map(async (orgNo) => {
      try {
        const search = (await get(
          `/accounting/organizations/${orgId}/suppliers?${new URLSearchParams({
            q: orgNo,
            hits: '20',
          }).toString()}`,
        )) as SupplierSearchResult
        return {
          orgNo,
          supplierId: pickContaSupplierIdByOrgNo(search.hits || [], orgNo),
        }
      } catch {
        return { orgNo, supplierId: null as number | null }
      }
    }),
  )

  const withSupplier = supplierIds.filter(
    (row): row is { orgNo: string; supplierId: number } =>
      row.supplierId != null,
  )
  const withoutSupplier = supplierIds
    .filter((row) => row.supplierId == null)
    .map((row) => row.orgNo)

  await Promise.all(
    withSupplier.map(({ orgNo, supplierId }) =>
      fetchLedger(supplierId, new Set([orgNo])),
    ),
  )

  if (withoutSupplier.length > 0) {
    await fetchLedger(null, new Set(withoutSupplier))
  }

  return out
}
