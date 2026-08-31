import * as React from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { InfiniteScrollConfig } from './types'

/** Hide the infinite-scroll loader if no additional rows arrive in this window. */
export const LOAD_MORE_STALL_MS = 5000

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

  const headId = rows[0] ? getRowId(rows[0]) : ''
  const lastRow = rows[rows.length - 1]
  const tailId = lastRow ? getRowId(lastRow) : ''
  const [loadMoreStalled, setLoadMoreStalled] = React.useState(false)

  React.useEffect(() => {
    setLoadMoreStalled(false)
  }, [rows.length, headId, tailId])

  React.useEffect(() => {
    if (!infinite?.hasNextPage || loadMoreStalled) return
    const timeoutId = window.setTimeout(() => {
      setLoadMoreStalled(true)
    }, LOAD_MORE_STALL_MS)
    return () => window.clearTimeout(timeoutId)
  }, [infinite?.hasNextPage, loadMoreStalled, rows.length, headId, tailId])

  const hasLoaderRow = (infinite?.hasNextPage ?? false) && !loadMoreStalled
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
    if (loadMoreStalled) return
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
    loadMoreStalled,
    infinite?.hasNextPage,
    infinite?.isFetchingNextPage,
  ])

  return { scrollRef, rowVirtualizer }
}
