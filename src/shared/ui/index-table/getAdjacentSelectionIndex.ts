/**
 * Computes the next selectable row index for ArrowUp/ArrowDown list navigation.
 * Returns null when there is no move (empty list or already at the boundary).
 */
export function getAdjacentSelectionIndex({
  ids,
  selectedId,
  delta,
  isIndexSelectable,
}: {
  ids: ReadonlyArray<string>
  selectedId: string | null | undefined
  delta: 1 | -1
  isIndexSelectable?: (index: number) => boolean
}): number | null {
  if (ids.length === 0) return null

  const canSelect = isIndexSelectable ?? (() => true)
  const current =
    selectedId != null && selectedId !== '' ? ids.indexOf(selectedId) : -1

  if (current === -1) {
    const start = delta > 0 ? 0 : ids.length - 1
    const step = delta > 0 ? 1 : -1
    for (let i = start; delta > 0 ? i < ids.length : i >= 0; i += step) {
      if (canSelect(i)) return i
    }
    return null
  }

  let i = current + delta
  while (i >= 0 && i < ids.length) {
    if (canSelect(i)) return i
    i += delta
  }
  return null
}
