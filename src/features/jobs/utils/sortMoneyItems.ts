/** Shared sort keys for confirmed money items and suggestions. */
export type MoneySortable = {
  type: string
  source: string
  amount: number
}

/** Compare by type, then source, then amount (all ascending). */
export function compareMoneyItems(a: MoneySortable, b: MoneySortable): number {
  const byType = a.type.localeCompare(b.type)
  if (byType !== 0) return byType
  const bySource = a.source.localeCompare(b.source)
  if (bySource !== 0) return bySource
  return a.amount - b.amount
}

/** Return a new array sorted type → source → amount. */
export function sortMoneyItems<T extends MoneySortable>(
  items: Array<T>,
): Array<T> {
  return [...items].sort(compareMoneyItems)
}
