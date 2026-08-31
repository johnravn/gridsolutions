import * as React from 'react'
import { searchInventoryItems } from '../api/searchInventoryItems'
import type {
  InventorySearchHit,
  InventorySearchOptions,
} from '../api/searchInventoryItems'

export function useInventoryItemSearch(
  companyId: string | undefined,
  options: InventorySearchOptions = {},
) {
  const subrentalOnly = options.subrentalOnly ?? false
  const categoryName = options.categoryName ?? null
  const [searchResults, setSearchResults] = React.useState<
    Array<InventorySearchHit>
  >([])
  const [searchLoading, setSearchLoading] = React.useState(false)
  const searchSeqRef = React.useRef(0)

  const searchItems = React.useCallback(
    async (term: string) => {
      const seq = ++searchSeqRef.current
      if (!companyId || !term.trim()) {
        setSearchResults([])
        setSearchLoading(false)
        return
      }

      setSearchLoading(true)
      try {
        const results = await searchInventoryItems(companyId, term, {
          subrentalOnly,
          categoryName,
        })
        if (seq !== searchSeqRef.current) return
        setSearchResults(results)
      } catch (error) {
        if (seq !== searchSeqRef.current) return
        console.error('Search error:', error)
        setSearchResults([])
      } finally {
        if (seq === searchSeqRef.current) setSearchLoading(false)
      }
    },
    [companyId, subrentalOnly, categoryName],
  )

  const clearSearch = React.useCallback(() => {
    searchSeqRef.current += 1
    setSearchResults([])
    setSearchLoading(false)
  }, [])

  return { searchResults, searchLoading, searchItems, clearSearch }
}
