// src/features/inventory/components/InventoryTable.tsx
import * as React from 'react'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import {
  Badge,
  Button,
  Flex,
  IconButton,
  Spinner,
  Text,
  TextField,
  Tooltip,
} from '@radix-ui/themes'
import { useMediaQuery } from '@app/hooks/useMediaQuery'
import {
  MOBILE_LIST_BOTTOM_PAD,
  MobileBottomActionBar,
  MobilePageList,
} from '@app/layout/mobile'
import { useCompany } from '@shared/companies/CompanyProvider'
import { useCompanyWriteAccess } from '@features/demo/hooks/useCompanyWriteAccess'
import { useDebouncedValue } from '@tanstack/react-pacer'
import { Package, Packages, Search } from 'iconoir-react'
import {
  IndexTableBodySkeleton,
  VirtualIndexTable,
  useVirtualIndexTable,
} from '@shared/ui/index-table'
import {
  INDEX_TABLE_ROW_CLASS,
  INDEX_TABLE_ROW_SELECTED_CLASS,
} from '@shared/ui/index-table/indexTableStyles'
import { HighlightedText } from '@shared/ui/components/HighlightedText'
import { SearchableSelect } from '@shared/ui/components/SearchableSelect'
import { categoryNamesQuery, inventoryIndexQuery } from '../api/queries'
import AddItemDialog from './AddItemDialog'
import AddGroupDialog from './AddGroupDialog'
import type { IndexColumn } from '@shared/ui/index-table'
import type { InventoryIndexRow, SortBy, SortDir } from '../api/queries'

const GRID_COLUMNS =
  'minmax(180px, 2fr) minmax(100px, 1fr) minmax(80px, 1fr) 80px 100px 100px'

const SORTABLE_COLS: Array<SortBy> = [
  'name',
  'category_name',
  'brand_name',
  'on_hand',
  'current_price',
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
  {
    id: 'current_price',
    header: 'Price',
    sortable: true,
    sortKey: 'current_price',
  },
  { id: 'item_kind', header: 'Type', sortable: false, align: 'end' },
]

type Props = {
  selectedId: string | null
  onSelect: (id: string) => void
  showActive: boolean
  showInactive: boolean
  showStock: boolean
  showSubrental: boolean
  showGroupOnlyItems: boolean
  showGroups: boolean
  showItems: boolean
  createShortcutRef?: React.MutableRefObject<(() => void) | null>
  toolbarExtra?: React.ReactNode
}

export default function InventoryTable({
  selectedId,
  onSelect,
  showActive,
  showInactive,
  showStock,
  showSubrental,
  showGroupOnlyItems,
  showGroups,
  showItems,
  createShortcutRef,
  toolbarExtra,
}: Props) {
  const { companyId } = useCompany()
  const { canWrite } = useCompanyWriteAccess()
  const [search, setSearch] = React.useState('')
  const [debouncedSearch] = useDebouncedValue(search, { wait: 300 })
  const [categoryFilter, setCategoryFilter] = React.useState<string | null>(
    null,
  )

  const [sortBy, setSortBy] = React.useState<SortBy>('name')
  const [sortDir, setSortDir] = React.useState<SortDir>('asc')

  const [addItemOpen, setAddItemOpen] = React.useState(false)
  const [addGroupDialog, setAddGroupDialog] = React.useState(false)
  React.useEffect(() => {
    if (!createShortcutRef) return
    createShortcutRef.current = () => setAddItemOpen(true)
    return () => {
      createShortcutRef.current = null
    }
  }, [createShortcutRef])

  const isSmallScreen = useMediaQuery('(max-width: 768px)')
  const isMobile = useMediaQuery('(max-width: 1023px)')

  const PAGE_SIZE = 200

  const inventoryQuery = useInfiniteQuery({
    // Nest under `inventory-index` so create/edit/delete invalidations refresh this list
    queryKey: [
      'company',
      companyId,
      'inventory-index',
      'infinite',
      debouncedSearch,
      showActive,
      showInactive,
      showStock,
      showSubrental,
      showGroupOnlyItems,
      showGroups,
      showItems,
      categoryFilter,
      sortBy,
      sortDir,
    ] as const,
    enabled: !!companyId,
    initialPageParam: 1,
    queryFn: async ({
      pageParam,
    }): Promise<{ rows: Array<InventoryIndexRow>; count: number }> => {
      const page = Number(pageParam) || 1
      const { queryFn } = inventoryIndexQuery({
        companyId: companyId ?? '__none__',
        page,
        pageSize: PAGE_SIZE,
        search: debouncedSearch,
        showActive,
        showInactive,
        showStock,
        showSubrental,
        showGroupOnlyItems,
        showGroups,
        showItems,
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

  const { data: categories = [] } = useQuery({
    ...categoryNamesQuery({ companyId: companyId ?? '__none__' }),
    enabled: !!companyId,
  })

  const fmt = React.useMemo(
    () =>
      new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: 'NOK',
        minimumFractionDigits: 2,
      }),
    [],
  )

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
          <Flex align="center" gap="2">
            <Text size="2" weight="medium">
              <HighlightedText text={row.name} query={search} />
            </Text>
            {row.is_group && (
              <Badge size="1" variant="soft" color="pink">
                Group
              </Badge>
            )}
            {row.active === false && (
              <Badge size="1" variant="soft" color="red">
                Inactive
              </Badge>
            )}
          </Flex>
        )
      case 'category_name': {
        const category = String(row.category_name ?? '').toUpperCase()
        return (
          <Text size="2" color="gray">
            {category ? (
              <HighlightedText text={category} query={search} />
            ) : null}
          </Text>
        )
      }
      case 'brand_name': {
        const brand = String(row.brand_name ?? '')
        return (
          <Text size="2" color="gray">
            {brand ? <HighlightedText text={brand} query={search} /> : null}
          </Text>
        )
      }
      case 'on_hand':
        return String(row.on_hand ?? '')
      case 'current_price':
        if (row.current_price == null) return ''
        return fmt.format(Number(row.current_price))
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
    <Flex
      gap={isMobile ? '4' : '2'}
      align="center"
      wrap="wrap"
      style={{ minWidth: 0 }}
    >
      <Flex
        gap="3"
        align="center"
        wrap="wrap"
        style={{ width: isMobile ? '100%' : undefined, flex: 1, minWidth: 0 }}
      >
        <TextField.Root
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search items, groups…"
          size="3"
          style={{ flex: '1 1 min(260px, 100%)', minWidth: 0 }}
        >
          <TextField.Slot side="left">
            <Search />
          </TextField.Slot>
          <TextField.Slot side="right">
            {(inventoryQuery.isFetching ||
              inventoryQuery.isFetchingNextPage) && <Spinner />}
          </TextField.Slot>
        </TextField.Root>
        {isMobile ? toolbarExtra : null}
      </Flex>

      {!isSmallScreen && (
        <SearchableSelect
          options={[
            { value: 'all', label: 'All' },
            ...categories.map((name) => ({
              value: name,
              label: name.toUpperCase(),
            })),
          ]}
          value={categoryFilter ?? 'all'}
          onValueChange={(val) => setCategoryFilter(val === 'all' ? null : val)}
          placeholder="Filter category…"
          emptyMessage="No categories found"
          size="3"
          dropdownMaxWidth={240}
          style={{ width: 200, maxWidth: 240 }}
        />
      )}

      {canWrite && !isMobile && (
        <Flex gap="2">
          <Tooltip content="Add group">
            <IconButton
              size="3"
              variant="outline"
              aria-label="Add group"
              onClick={() => setAddGroupDialog(true)}
            >
              <Packages width={20} height={20} />
            </IconButton>
          </Tooltip>
          <Tooltip content="Add item">
            <IconButton
              size="3"
              variant="solid"
              aria-label="Add item"
              onClick={() => setAddItemOpen(true)}
            >
              <Package width={20} height={20} />
            </IconButton>
          </Tooltip>
        </Flex>
      )}
    </Flex>
  )

  const dialogs = (
    <>
      <AddItemDialog
        open={addItemOpen}
        onOpenChange={setAddItemOpen}
        companyId={companyId ?? ''}
        showTrigger={false}
      />
      <AddGroupDialog
        open={addGroupDialog}
        onOpenChange={setAddGroupDialog}
        companyId={companyId ?? ''}
        showTrigger={false}
      />
    </>
  )

  if (isMobile) {
    return (
      <>
        <MobilePageList toolbar={toolbar}>
          {inventoryQuery.isLoading ? (
            <IndexTableBodySkeleton rowCount={8} rowHeight={64} />
          ) : rows.length === 0 ? (
            <Text size="2" color="gray">
              No results
            </Text>
          ) : (
            <Flex
              direction="column"
              gap="2"
              style={{ paddingBottom: MOBILE_LIST_BOTTOM_PAD }}
            >
              {rows.map((row) => {
                const isSelected = row.id === selectedId
                return (
                  <div
                    key={row.id}
                    className={[
                      INDEX_TABLE_ROW_CLASS,
                      isSelected ? INDEX_TABLE_ROW_SELECTED_CLASS : undefined,
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelect(row.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        onSelect(row.id)
                      }
                    }}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(0, 1fr) auto',
                      gap: 'var(--space-3)',
                      alignItems: 'center',
                      padding: '16px 12px',
                      minHeight: 64,
                      cursor: 'pointer',
                      borderRadius: 'var(--radius-3)',
                    }}
                  >
                    <div style={{ minWidth: 0 }}>{renderCell(row, 'name')}</div>
                    {renderCell(row, 'item_kind')}
                  </div>
                )
              })}
              {inventoryQuery.hasNextPage && (
                <Button
                  variant="soft"
                  onClick={() => {
                    void inventoryQuery.fetchNextPage()
                  }}
                  disabled={inventoryQuery.isFetchingNextPage}
                >
                  {inventoryQuery.isFetchingNextPage
                    ? 'Loading more…'
                    : 'Load more'}
                </Button>
              )}
            </Flex>
          )}
          {rows.length > 0 && (
            <Text size="2" color="gray">
              {totalCount} item{totalCount !== 1 ? 's' : ''}
            </Text>
          )}
        </MobilePageList>
        {canWrite && (
          <MobileBottomActionBar>
            <Button
              variant="ghost"
              size="3"
              className="app-mobile-bottom-action-icon"
              aria-label="Add group"
              onClick={() => setAddGroupDialog(true)}
            >
              <Packages width={20} height={20} />
            </Button>
            <Button
              variant="ghost"
              size="3"
              className="app-mobile-bottom-action-icon"
              aria-label="Add item"
              onClick={() => setAddItemOpen(true)}
            >
              <Package width={20} height={20} />
            </Button>
          </MobileBottomActionBar>
        )}
        {dialogs}
      </>
    )
  }

  return (
    <>
      <VirtualIndexTable
        rows={rows}
        columns={COLUMNS}
        gridTemplateColumns={GRID_COLUMNS}
        getRowId={(r) => r.id}
        renderCell={renderCell}
        selectedId={selectedId}
        onSelect={onSelect}
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
      />
      {dialogs}
    </>
  )
}
