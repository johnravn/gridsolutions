/** Resolve Select value to a query filter (`null` = All / no filter). */
export function projectLeadUserIdFromFilter(
  filterValue: string,
  allSentinel = 'all',
): string | null {
  if (!filterValue || filterValue === allSentinel) return null
  return filterValue
}
