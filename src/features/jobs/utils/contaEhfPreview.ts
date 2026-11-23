/** Fetch Conta received-EHF / transaction details for Accounting preview. */

import type { components } from '@shared/api/conta/types'

export type ContaExtendedTransaction =
  components['schemas']['RouteV1TransactionModel']

export type ContaEhfPreviewLine = {
  id?: number
  date?: string | null
  dueDate?: string | null
  description?: string | null
  amount?: number | null
  bookkeepingAccountNo?: string | null
  debitBookkeepingAccountNo?: string | null
  creditBookkeepingAccountNo?: string | null
  vatCode?: string | null
  invoiceNo?: string | null
  supplierId?: number | null
  customerId?: number | null
  projectId?: number | null
  departmentId?: number | null
  kind: 'line' | 'advanced'
}

export type ContaEhfPreviewModel = {
  transactionId: number
  transactionNo?: number | null
  transactionNoYear?: string | null
  date?: string | null
  description?: string | null
  transactionSourceType?: string | null
  ehfReceivedId?: number | null
  invoiceId?: number | null
  createdAt?: string | null
  paymentType?: string | null
  lines: Array<ContaEhfPreviewLine>
  attachments: Array<{
    id?: number
    attachmentFileId?: number | null
    bookkeepingInboxFileId?: number | null
    status?: string | null
  }>
}

type ContaGet = (path: string) => Promise<unknown>

/**
 * Load a Conta bookkeeping transaction (includes lines + ehfReceivedId).
 * Used for the Accounting suggestion EHF preview dialog.
 */
export async function fetchContaEhfPreview(input: {
  orgId: string
  transactionId: number
  get: ContaGet
}): Promise<ContaEhfPreviewModel> {
  const tx = (await input.get(
    `/accounting/organizations/${input.orgId}/transactions-advanced/${input.transactionId}`,
  )) as ContaExtendedTransaction

  const lines: Array<ContaEhfPreviewLine> = []

  for (const line of tx.transactionLines || []) {
    lines.push({
      id: line.id,
      date: line.date ?? null,
      dueDate: line.dueDate ?? null,
      description: line.description ?? null,
      amount: line.amount ?? null,
      bookkeepingAccountNo: line.bookkeepingAccountNo ?? null,
      vatCode: line.vatCode ?? null,
      invoiceNo: line.invoiceNo ?? null,
      supplierId: line.supplierId ?? null,
      customerId: line.customerId ?? null,
      projectId: line.projectId ?? null,
      departmentId: line.departmentId ?? null,
      kind: 'line',
    })
  }

  for (const line of tx.transactionLinesAdvanced || []) {
    lines.push({
      id: line.id,
      date: line.date ?? null,
      dueDate: line.dueDate ?? null,
      description: line.description ?? null,
      amount: line.amount ?? null,
      debitBookkeepingAccountNo: line.debitBookkeepingAccountNo ?? null,
      creditBookkeepingAccountNo: line.creditBookkeepingAccountNo ?? null,
      invoiceNo: line.debitInvoiceNo || line.creditInvoiceNo || null,
      supplierId: line.debitSupplierId || line.creditSupplierId || null,
      customerId: line.debitCustomerId || line.creditCustomerId || null,
      projectId: line.projectId ?? null,
      departmentId: line.departmentId ?? null,
      kind: 'advanced',
    })
  }

  return {
    transactionId: tx.id ?? input.transactionId,
    transactionNo: tx.transactionNo ?? null,
    transactionNoYear: tx.transactionNoYear ?? null,
    date: tx.date ?? null,
    description: tx.description ?? null,
    transactionSourceType: tx.transactionSourceType ?? null,
    ehfReceivedId: tx.ehfReceivedId ?? null,
    invoiceId: tx.invoiceId ?? null,
    createdAt: tx.createdAt ?? null,
    paymentType: tx.paymentType ?? null,
    lines,
    attachments: (tx.transactionAttachments || []).map((a) => ({
      id: a.id,
      attachmentFileId: a.attachmentFileId ?? null,
      bookkeepingInboxFileId: a.bookkeepingInboxFileId ?? null,
      status: a.status ?? null,
    })),
  }
}
