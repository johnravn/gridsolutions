import type { SortDir } from '../types'

export function compareValues(
  a: string | number | null | undefined,
  b: string | number | null | undefined,
  dir: SortDir,
): number {
  const aNull = a == null || a === ''
  const bNull = b == null || b === ''
  if (aNull && bNull) return 0
  if (aNull) return 1
  if (bNull) return -1

  let cmp = 0
  if (typeof a === 'number' && typeof b === 'number') {
    cmp = a - b
  } else {
    cmp = String(a).localeCompare(String(b), 'nb', { numeric: true })
  }
  return dir === 'asc' ? cmp : -cmp
}

export function toggleSort(
  currentKey: string | null,
  currentDir: SortDir,
  nextKey: string,
): { key: string; dir: SortDir } {
  if (currentKey === nextKey) {
    return { key: nextKey, dir: currentDir === 'asc' ? 'desc' : 'asc' }
  }
  return { key: nextKey, dir: 'desc' }
}
