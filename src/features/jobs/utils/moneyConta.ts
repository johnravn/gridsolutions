/** Conta Money-tab matching helpers (confidence + date window). */

export type ContaMatchConfidence = 'high' | 'medium' | 'low'

export type ContaDatePadOption = 'job' | 'pad30' | 'pad90' | 'open'

export const CONTA_DATE_PAD_OPTIONS: Array<{
  value: ContaDatePadOption
  label: string
  hint: string
}> = [
  {
    value: 'job',
    label: 'Job dates',
    hint: 'Only ledger lines inside the job start–end window',
  },
  {
    value: 'pad30',
    label: '±30 days',
    hint: 'Widen 30 days before start and after end',
  },
  {
    value: 'pad90',
    label: '±90 days',
    hint: 'Widen 90 days before start and after end',
  },
  {
    value: 'open',
    label: 'No date filter',
    hint: 'Fetch without start/end (may include unrelated lines)',
  },
]

export const CONTA_CONFIDENCE_LABEL: Record<ContaMatchConfidence, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}

export const CONTA_CONFIDENCE_COLOR: Record<
  ContaMatchConfidence,
  'green' | 'amber' | 'orange' | 'gray'
> = {
  high: 'green',
  medium: 'amber',
  low: 'orange',
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return ymd(d)
}

/**
 * Build Conta supplier-ledger date params from job window + pad option.
 * Returns empty object when option is `open` or job has no dates.
 */
export function contaLedgerDateRange(
  startAt: string | null | undefined,
  endAt: string | null | undefined,
  pad: ContaDatePadOption,
): { startDate?: string; endDate?: string } {
  if (pad === 'open') return {}

  const start = startAt?.split('T')[0] ?? null
  const end = endAt?.split('T')[0] ?? null
  if (!start && !end) return {}

  const padDays = pad === 'job' ? 0 : pad === 'pad30' ? 30 : 90

  const out: { startDate?: string; endDate?: string } = {}
  if (start) {
    out.startDate = padDays > 0 ? addDays(start, -padDays) : start
  }
  if (end) {
    out.endDate = padDays > 0 ? addDays(end, padDays) : end
  } else if (start && padDays > 0) {
    // No end date: still widen forward from start
    out.endDate = addDays(start, padDays)
  }
  return out
}

export type ContaExpenseMatchMode = 'project' | 'jobnr'

export function contaExpenseConfidence(
  mode: ContaExpenseMatchMode,
): ContaMatchConfidence {
  return mode === 'project' ? 'high' : 'medium'
}

export function contaExpenseConfidenceReason(
  mode: ContaExpenseMatchMode,
): string {
  return mode === 'project'
    ? 'Matched Conta project'
    : 'Matched job number in description'
}

/** Sales invoice income confidence from Grid job_invoices rows. */
export function contaIncomeConfidence(
  invoiceCount: number,
): ContaMatchConfidence {
  if (invoiceCount <= 1) return 'high'
  return 'medium'
}

export function contaIncomeConfidenceReason(invoiceCount: number): string {
  if (invoiceCount <= 0) return 'No Conta sales invoice'
  if (invoiceCount === 1) return 'Single Conta sales invoice'
  return `${invoiceCount} Conta sales invoices — review which to confirm`
}

export type ContaLinkStatus =
  | 'not_configured'
  | 'configured_no_project'
  | 'configured_with_project'
  | 'configured_jobnr_only'

export function resolveContaLinkStatus(input: {
  hasOrganizationId: boolean
  contaProjectId: number | null | undefined
  hasJobnr: boolean
}): ContaLinkStatus {
  if (!input.hasOrganizationId) return 'not_configured'
  if (input.contaProjectId) return 'configured_with_project'
  if (input.hasJobnr) return 'configured_jobnr_only'
  return 'configured_no_project'
}

export function contaLinkStatusMessage(status: ContaLinkStatus): string {
  switch (status) {
    case 'not_configured':
      return 'Conta is not connected for this company. Connect it in Company settings to pull supplier costs and prefer Conta invoice income.'
    case 'configured_with_project':
      return 'Conta project linked — supplier costs use high-confidence project match.'
    case 'configured_jobnr_only':
      return 'No Conta project linked yet. Costs may match by job number (medium confidence). Create a Conta invoice to link the project.'
    case 'configured_no_project':
      return 'Conta is connected, but this job has no project link and no job number — supplier cost suggestions cannot be matched automatically.'
  }
}
