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
    enabled: rows.length > 0 || isFetching,
  })

  React.useEffect(() => {
    if (!infinite) return
    const virtualItems = rowVirtualizer.getVirtualItems()
    if (virtualItems.length === 0) return

    const last = virtualItems[virtualItems.length - 1]
    const isAtLoader = last.index >= rows.length - 1
    if (!isAtLoader) return
    if (infinite.isFetchingNextPage) return
    if (!infinite.hasNextPage) return

    infinite.onLoadMore()
  }, [
    infinite,
    rows.length,
    rowVirtualizer,
    infinite?.hasNextPage,
    infinite?.isFetchingNextPage,
  ])

  return { scrollRef, rowVirtualizer }
}
