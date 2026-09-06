import * as React from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Box, Flex, Spinner, Text } from '@radix-ui/themes'

type MonitorVirtualListProps<T> = {
  items: Array<T>
  getItemKey: (item: T, index: number) => string
  estimateSize: number
  maxHeight: number
  overscan?: number
  /** Re-measure when this changes (e.g. expanded row id). */
  measureKey?: string | number | null
  hasNextPage?: boolean
  isFetchingNextPage?: boolean
  onLoadMore?: () => void
  renderItem: (item: T, index: number) => React.ReactNode
}

/**
 * Fixed-height scroll viewport with TanStack Virtual — only visible rows mount.
 */
export function MonitorVirtualList<T>({
  items,
  getItemKey,
  estimateSize,
  maxHeight,
  overscan = 6,
  measureKey = null,
  hasNextPage = false,
  isFetchingNextPage = false,
  onLoadMore,
  renderItem,
}: MonitorVirtualListProps<T>) {
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const onLoadMoreRef = React.useRef(onLoadMore)
  onLoadMoreRef.current = onLoadMore

  const hasLoaderRow = hasNextPage
  const count = items.length + (hasLoaderRow ? 1 : 0)

  const rowVirtualizer = useVirtualizer({
    count,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => estimateSize,
    overscan,
    getItemKey: (index) => {
      if (index >= items.length) return `loader-${index}`
      const item = items[index]
      return item ? getItemKey(item, index) : index
    },
    enabled: items.length > 0 || hasLoaderRow,
  })

  React.useEffect(() => {
    rowVirtualizer.measure()
  }, [measureKey, rowVirtualizer])

  const lastVirtualIndex = rowVirtualizer.getVirtualItems().at(-1)?.index ?? -1

  React.useEffect(() => {
    if (!hasNextPage || isFetchingNextPage) return
    if (lastVirtualIndex < 0) return
    if (lastVirtualIndex < items.length - 1) return
    onLoadMoreRef.current?.()
  }, [lastVirtualIndex, items.length, hasNextPage, isFetchingNextPage])

  if (items.length === 0 && !hasLoaderRow) return null

  const totalSize = rowVirtualizer.getTotalSize()
  // Cap the scroll viewport; shrink when the list is shorter than maxHeight.
  const viewportHeight = Math.min(maxHeight, Math.max(totalSize, estimateSize))

  return (
    <Box
      ref={scrollRef}
      style={{
        height: viewportHeight,
        overflow: 'auto',
        borderRadius: 'var(--radius-3)',
        border: '1px solid var(--gray-a4)',
      }}
    >
      <div
        style={{
          height: `${totalSize}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const isLoader = virtualRow.index >= items.length
          const item = items[virtualRow.index]

          return (
            <div
              key={virtualRow.key}
              data-index={virtualRow.index}
              ref={rowVirtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
                padding: 'var(--space-1)',
                boxSizing: 'border-box',
              }}
            >
              {isLoader ? (
                <Flex align="center" justify="center" gap="2" py="3">
                  <Spinner size="1" />
                  <Text size="1" color="gray">
                    Loading more…
                  </Text>
                </Flex>
              ) : item ? (
                renderItem(item, virtualRow.index)
              ) : null}
            </div>
          )
        })}
      </div>
    </Box>
  )
}
