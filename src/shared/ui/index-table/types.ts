import type { Virtualizer } from '@tanstack/react-virtual'
import type * as React from 'react'

export type SortDir = 'asc' | 'desc'

export type IndexColumn<TSort extends string = string> = {
  id: string
  header: React.ReactNode
  sortable?: boolean
  sortKey?: TSort
  align?: 'start' | 'end' | 'center'
}

export type FooterCount =
  | number
  | {
      shown: number
      total?: number
      label?: (n: number) => string
    }

export type InfiniteScrollConfig = {
  hasNextPage: boolean
  isFetchingNextPage: boolean
  onLoadMore: () => void
  loaderLabel?: string
}

export type VirtualIndexTableProps<TRow, TSort extends string = string> = {
  rows: Array<TRow>
  columns: Array<IndexColumn<TSort>>
  gridTemplateColumns: string
  getRowId: (row: TRow) => string
  renderCell: (row: TRow, columnId: string) => React.ReactNode

  selectedId?: string | null
  onSelect?: (id: string) => void
  selectable?: boolean
  isRowSelectable?: (row: TRow) => boolean
  getRowClassName?: (row: TRow) => string | undefined
  getRowStyle?: (row: TRow) => React.CSSProperties | undefined

  sortBy?: TSort
  sortDir?: SortDir
  onSort?: (col: TSort) => void
  sortableColumns?: Array<TSort>
  sortIndicator?: 'arrow' | 'text'

  scrollRef: React.RefObject<HTMLDivElement | null>
  rowVirtualizer: Virtualizer<HTMLDivElement, Element>

  isLoading?: boolean
  loadingPlacement?: 'inline' | 'fullscreen'
  loadingVariant?: 'spinner' | 'skeleton'
  emptyMessage?: string
  footerCount?: FooterCount | false

  toolbar?: React.ReactNode
  horizontalScroll?: boolean
  scrollBodyStyle?: React.CSSProperties

  infinite?: InfiniteScrollConfig

  renderRowActions?: (row: TRow) => React.ReactNode
  actionsColumnWidth?: string
}
