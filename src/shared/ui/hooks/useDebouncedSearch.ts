import * as React from 'react'
import { useDebouncedValue } from '@tanstack/react-pacer'

const DEFAULT_WAIT_MS = 300

/**
 * Local search text + debounced value for server query keys.
 * Keep `search` for HighlightedText / controlled inputs; put only
 * `debouncedSearch` in React Query keys. Treat `isPending` as loading
 * so empty results do not flash before the fetch starts.
 */
export function useDebouncedSearch(
  initial = '',
  wait: number = DEFAULT_WAIT_MS,
): {
  search: string
  debouncedSearch: string
  setSearch: React.Dispatch<React.SetStateAction<string>>
  isPending: boolean
} {
  const [search, setSearch] = React.useState(initial)
  const [debouncedSearch] = useDebouncedValue(search, { wait })
  const isPending = search !== debouncedSearch
  return { search, debouncedSearch, setSearch, isPending }
}
