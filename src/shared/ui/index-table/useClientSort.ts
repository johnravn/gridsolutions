import * as React from 'react'
import type { SortDir } from './types'

export function useClientSort<TSort extends string>(
  initialSortBy: TSort,
  initialSortDir: SortDir = 'asc',
) {
  const [sortBy, setSortBy] = React.useState<TSort>(initialSortBy)
  const [sortDir, setSortDir] = React.useState<SortDir>(initialSortDir)

  const handleSort = React.useCallback(
    (col: TSort) => {
      if (sortBy === col) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
      } else {
        setSortBy(col)
        setSortDir('asc')
      }
    },
    [sortBy],
  )

  return { sortBy, sortDir, setSortBy, setSortDir, handleSort }
}

export function applySortDir(cmp: number, sortDir: SortDir): number {
  return sortDir === 'asc' ? cmp : -cmp
}
