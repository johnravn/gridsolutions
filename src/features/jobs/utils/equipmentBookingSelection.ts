export type CategoryBookingEntry = {
  groupEntries: Array<{ rows: Array<{ id: string }> }>
  directRows: Array<{ id: string }>
}

export function categoryBookingIds(
  category: CategoryBookingEntry,
): Array<string> {
  return [
    ...category.groupEntries.flatMap((chunk) => chunk.rows.map((r) => r.id)),
    ...category.directRows.map((r) => r.id),
  ]
}

export function countSelectedBookingRows(
  categories: Array<CategoryBookingEntry>,
  selectedIds: Set<string>,
): number {
  let count = 0
  for (const category of categories) {
    for (const chunk of category.groupEntries) {
      if (chunk.rows.some((r) => selectedIds.has(r.id))) count += 1
    }
    for (const row of category.directRows) {
      if (selectedIds.has(row.id)) count += 1
    }
  }
  return count
}

export function selectionState(
  selectedIds: Set<string>,
  ids: Array<string>,
): boolean | 'indeterminate' {
  if (ids.length === 0) return false
  let selectedCount = 0
  for (const id of ids) {
    if (selectedIds.has(id)) selectedCount += 1
  }
  if (selectedCount === 0) return false
  if (selectedCount === ids.length) return true
  return 'indeterminate'
}

export function setIdsSelected(
  prev: Set<string>,
  ids: Array<string>,
  selected: boolean,
): Set<string> {
  const next = new Set(prev)
  for (const id of ids) {
    if (selected) next.add(id)
    else next.delete(id)
  }
  return next
}
