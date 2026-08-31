import * as React from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import {
  Badge,
  Flex,
  IconButton,
  Spinner,
  Text,
  TextField,
} from '@radix-ui/themes'
import { useDebouncedValue } from '@tanstack/react-pacer'
import { Plus, Search } from 'iconoir-react'
import { HighlightedText } from '@shared/ui/components/SearchableSelect'
import { VirtualIndexTable, useVirtualIndexTable } from '@shared/ui/index-table'
import { inventoryIndexQuery } from '@features/inventory/api/queries'
import type { IndexColumn } from '@shared/ui/index-table'
import type {
  InventoryIndexRow,
  SortBy,
  SortDir,
} from '@features/inventory/api/queries'

const GRID_COLUMNS =
  'minmax(180px, 2fr) minmax(100px, 1fr) minmax(80px, 1fr) 80px 100px'

const SORTABLE_COLS: Array<SortBy> = [
  'name',
  'category_name',
  'brand_name',
  'on_hand',
]

const COLUMNS: Array<IndexColumn<SortBy>> = [
  { id: 'name', header: 'Name', sortable: true, sortKey: 'name' },
  {
    id: 'category_name',
    header: 'Category',
    sortable: true,
    sortKey: 'category_name',
  },
  { id: 'brand_name', header: 'Brand', sortable: true, sortKey: 'brand_name' },
  { id: 'on_hand', header: 'On hand', sortable: true, sortKey: 'on_hand' },
  { id: 'item_kind', header: 'Type', sortable: false, align: 'end' },
]

const PAGE_SIZE = 200

export default function BookEquipmentPickerList({
  companyId,
  open,
  categoryFilter,
  subrentalOnly,
  onAdd,
}: {
  companyId: string
  open: boolean
  categoryFilter: string | null
  subrentalOnly: boolean
  onAdd: (row: InventoryIndexRow) => void
}) {
  const [search, setSearch] = React.useState('')
  const [debouncedSearch] = useDebouncedValue(search, { wait: 300 })
  const [sortBy, setSortBy] = React.useState<SortBy>('name')
  const [sortDir, setSortDir] = React.useState<SortDir>('asc')

  React.useEffect(() => {
    if (!open) {
      setSearch('')
      setSortBy('name')
      setSortDir('asc')
    }
  }, [open])

  const showStock = !subrentalOnly
  const showSubrental = true

  const inventoryQuery = useInfiniteQuery({
    queryKey: [
      'company',
      companyId,
      'inventory-index',
      'book-equipment',
      debouncedSearch,
      showStock,
      showSubrental,
      categoryFilter,
      sortBy,
      sortDir,
    ] as const,
    enabled: open && !!companyId,
    initialPageParam: 1,
    queryFn: async ({
      pageParam,
    }): Promise<{ rows: Array<InventoryIndexRow>; count: number }> => {
      const page = Number(pageParam) || 1
      const { queryFn } = inventoryIndexQuery({
        companyId,
        page,
        pageSize: PAGE_SIZE,
        search: debouncedSearch,
        showActive: true,
        showInactive: false,
        showStock,
        showSubrental,
        showGroupOnlyItems: false,
        showGroups: true,
        showItems: true,
        category: categoryFilter,
        sortBy,
        sortDir,
      })
      return await (
        queryFn as () => Promise<{
          rows: Array<InventoryIndexRow>
          count: number
        }>
      )()
    },
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((acc, p) => acc + p.rows.length, 0)
      const total = lastPage.count
      if (loaded >= total) return undefined
      return allPages.length + 1
    },
    staleTime: 10_000,
  })

  const rows = React.useMemo(
    () =>
      inventoryQuery.data
        ? inventoryQuery.data.pages.flatMap((p) => p.rows)
        : [],
    [inventoryQuery.data],
  )
  const totalCount = inventoryQuery.data
    ? (inventoryQuery.data.pages[0]?.count ?? 0)
    : 0

  const { scrollRef, rowVirtualizer } = useVirtualIndexTable({
    rows,
    getRowId: (r) => r.id,
    estimateRowSize: 44,
    isFetching: inventoryQuery.isFetching,
    infinite: {
      hasNextPage: inventoryQuery.hasNextPage,
      isFetchingNextPage: inventoryQuery.isFetchingNextPage,
      onLoadMore: () => {
        void inventoryQuery.fetchNextPage()
      },
    },
  })

  const handleSort = (colId: SortBy) => {
    if (!SORTABLE_COLS.includes(colId)) return
    if (sortBy === colId) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(colId)
      setSortDir('asc')
    }
  }

  const renderCell = (row: InventoryIndexRow, colId: string) => {
    switch (colId) {
      case 'name':
        return (
          <Flex align="center" gap="2" style={{ minWidth: 0 }}>
            <Text size="2" weight="medium" style={{ minWidth: 0 }}>
              <HighlightedText text={row.name} query={search} />
            </Text>
            {row.is_group && (
              <Badge size="1" variant="soft" color="pink">
                Group
              </Badge>
            )}
          </Flex>
        )
      case 'category_name':
        return (
          <Text size="2" color="gray">
            <HighlightedText
              text={String(row.category_name ?? '').toUpperCase()}
              query={search}
            />
          </Text>
        )
      case 'brand_name':
        return (
          <Text size="2" color="gray">
            <HighlightedText
              text={String(row.brand_name ?? '')}
              query={search}
            />
          </Text>
        )
      case 'on_hand':
        return String(row.on_hand ?? '')
      case 'item_kind':
        return row.item_kind === 'stock' ? (
          <Badge size="1" variant="soft" color="indigo">
            Stock
          </Badge>
        ) : (
          <Badge size="1" variant="soft" color="amber">
            Subrental
          </Badge>
        )
      default:
        return null
    }
  }

  const toolbar = (
    <TextField.Root
      value={search}
      onChange={(e) => setSearch(e.target.value)}
      placeholder="Search items or groups to add..."
      size="3"
      style={{ width: '100%', minWidth: 0 }}
    >
      <TextField.Slot side="left">
        <Search />
      </TextField.Slot>
      <TextField.Slot side="right">
        {(inventoryQuery.isFetching || inventoryQuery.isFetchingNextPage) && (
          <Spinner />
        )}
      </TextField.Slot>
    </TextField.Root>
  )

  return (
    <VirtualIndexTable
      rows={rows}
      columns={COLUMNS}
      gridTemplateColumns={GRID_COLUMNS}
      getRowId={(r) => r.id}
      renderCell={renderCell}
      selectable={false}
      sortBy={sortBy}
      sortDir={sortDir}
      onSort={handleSort}
      sortableColumns={SORTABLE_COLS}
      scrollRef={scrollRef}
      rowVirtualizer={rowVirtualizer}
      isLoading={inventoryQuery.isLoading}
      emptyMessage="No results"
      footerCount={{
        shown: totalCount,
        label: (n) => `${n} item${n !== 1 ? 's' : ''}`,
      }}
      infinite={{
        hasNextPage: inventoryQuery.hasNextPage,
        isFetchingNextPage: inventoryQuery.isFetchingNextPage,
        onLoadMore: () => {
          void inventoryQuery.fetchNextPage()
        },
      }}
      toolbar={toolbar}
      horizontalScroll={false}
      renderRowActions={(row) => (
        <IconButton
          size="1"
          variant="ghost"
          aria-label={`Add ${row.name}`}
          onClick={(e) => {
            e.stopPropagation()
            onAdd(row)
          }}
        >
          <Plus width={16} height={16} />
        </IconButton>
      )}
      actionsColumnWidth="44px"
    />
  )
}
