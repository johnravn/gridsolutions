import * as React from 'react'
import { fuzzySearch } from '@shared/lib/generalFunctions'

export function useClientTableFilter<TRow>(
  rows: Array<TRow>,
  search: string,
  fields: Array<(row: TRow) => string | null | undefined>,
  threshold = 0.3,
): Array<TRow> {
  return React.useMemo(() => {
    if (!search.trim()) return rows
    return fuzzySearch(rows, search, fields, threshold)
  }, [rows, search, fields, threshold])
}
