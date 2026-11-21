/** Statuses where missing Money fill-in is treated as incomplete for Reporting. */
export const MONEY_INCOMPLETE_STATUSES = [
  'completed',
  'invoiced',
  'paid',
] as const

export type MoneyIncompleteStatus = (typeof MONEY_INCOMPLETE_STATUSES)[number]

export function isMoneyReviewStatus(
  status: string | null | undefined,
): status is MoneyIncompleteStatus {
  return (
    !!status &&
    (MONEY_INCOMPLETE_STATUSES as ReadonlyArray<string>).includes(status)
  )
}

/**
 * Completed/invoiced/paid jobs with no confirmed Money income (or empty ledger)
 * are incomplete for profit reporting.
 */
export function isMoneyIncompleteJob(input: {
  status: string | null | undefined
  income: number
  itemCount: number
}): boolean {
  if (!isMoneyReviewStatus(input.status)) return false
  return input.itemCount <= 0 || input.income <= 0
}

export function filterIncompleteMoneyJobs<
  T extends {
    money_incomplete: boolean
  },
>(rows: Array<T>): Array<T> {
  return rows.filter((r) => r.money_incomplete)
}

/** Same queue as Home/Jobs “Ready to verify Accounting”: paid/invoiced, unverified. */
export const ACCOUNTING_UNVERIFIED_STATUSES = ['invoiced', 'paid'] as const

export function isAccountingUnverifiedJob(input: {
  status: string | null | undefined
  money_verified: boolean
}): boolean {
  if (input.money_verified) return false
  return (
    !!input.status &&
    (ACCOUNTING_UNVERIFIED_STATUSES as ReadonlyArray<string>).includes(
      input.status,
    )
  )
}

export function filterAccountingUnverifiedJobs<
  T extends {
    status: string | null | undefined
    money_verified: boolean
  },
>(rows: Array<T>): Array<T> {
  return rows.filter((r) => isAccountingUnverifiedJob(r))
}
