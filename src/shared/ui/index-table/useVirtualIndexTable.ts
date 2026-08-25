import * as React from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { InfiniteScrollConfig } from './types'

type UseVirtualIndexTableOptions<TRow> = {
  rows: Array<TRow>
  getRowId: (row: TRow) => string
  estimateRowSize?: number
  overscan?: number
  infinite?: InfiniteScrollConfig
  isFetching?: boolean
}

export function useVirtualIndexTable<TRow>({
  rows,
  getRowId,
  estimateRowSize = 44,
  overscan = 10,
  infinite,
  isFetching = false,
}: UseVirtualIndexTableOptions<TRow>) {
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const onLoadMoreRef = React.useRef(infinite?.onLoadMore)
  onLoadMoreRef.current = infinite?.onLoadMore

  const hasLoaderRow = infinite?.hasNextPage ?? false
  const virtualCount = rows.length + (hasLoaderRow ? 1 : 0)

  const rowVirtualizer = useVirtualizer({
    count: virtualCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => estimateRowSize,
    overscan,
    getItemKey: (index) => {
      const row = rows[index]
      if (row) return getRowId(row)
      return `loader-${index}`
    },
    enabled: rows.length > 0 || isFetching || hasLoaderRow,
  })

  const lastVirtualIndex = rowVirtualizer.getVirtualItems().at(-1)?.index ?? -1

  React.useEffect(() => {
    if (infinite?.isFetchingNextPage) return
    if (!infinite?.hasNextPage) return

    const el = scrollRef.current
    const sawLastRow =
      lastVirtualIndex >= 0 && lastVirtualIndex >= rows.length - 1
    // If the first page does not overflow, the user cannot scroll to the
    // loader row — fetch the next page until the list becomes scrollable.
    const canMeasure = !!el && el.clientHeight > 0
    const notOverflowing = canMeasure && el.scrollHeight <= el.clientHeight + 1

    if (!sawLastRow && !notOverflowing) return
    onLoadMoreRef.current?.()
  }, [
    lastVirtualIndex,
    rows.length,
    infinite?.hasNextPage,
    infinite?.isFetchingNextPage,
  ])

  return { scrollRef, rowVirtualizer }
}
