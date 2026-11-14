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
