// src/features/inventory/components/InventoryTable.tsx
import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Badge,
  Button,
  Flex,
  Select,
  Spinner,
  Text,
  TextField,
} from '@radix-ui/themes'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useCompany } from '@shared/companies/CompanyProvider'
import { useDebouncedValue } from '@tanstack/react-pacer'
import { Plus, Search } from 'iconoir-react'
import {
  categoryNamesQuery,
  inventoryIndexQueryAll,
} from '../api/queries'
import AddItemDialog from './AddItemDialog'
import AddGroupDialog from './AddGroupDialog'
import type { InventoryIndexRow, SortBy, SortDir } from '../api/queries'

const GRID_COLUMNS = 'minmax(180px, 2fr) minmax(100px, 1fr) minmax(80px, 1fr) 80px 100px 100px'

type Props = {
  selectedId: string | null
  onSelect: (id: string) => void
  showActive: boolean
  showInactive: boolean
  showInternal: boolean
  showExternal: boolean
  showGroupOnlyItems: boolean
  showGroups: boolean
  showItems: boolean
}

export default function InventoryTable({
  selectedId,
  onSelect,
  showActive,
  showInactive,
  showInternal,
  showExternal,
  showGroupOnlyItems,
  showGroups,
  showItems,
}: Props) {
  const { companyId } = useCompany()
  const [search, setSearch] = React.useState('')
  const [debouncedSearch] = useDebouncedValue(search, { wait: 300 })
  const [categoryFilter, setCategoryFilter] = React.useState<string | null>(
    null,
  )

  const [sortBy, setSortBy] = React.useState<SortBy>('name')
  const [sortDir, setSortDir] = React.useState<SortDir>('asc')

  const [addItemOpen, setAddItemOpen] = React.useState(false)
  const [addGroupDialog, setAddGroupDialog] = React.useState(false)

  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const controlsRef = React.useRef<HTMLDivElement | null>(null)
  const scrollRef = React.useRef<HTMLDivElement | null>(null)

  const { data, isLoading, isFetching } = useQuery({
    ...inventoryIndexQueryAll({
      companyId: companyId ?? '__none__',
      search: debouncedSearch,
      showActive,
      showInactive,
      showInternal,
      showExternal,
      showGroupOnlyItems,
      showGroups,
      showItems,
      category: categoryFilter,
      sortBy,
      sortDir,
    }),
    enabled: !!companyId,
  })

  const rows = data?.rows ?? []
  const totalCount = data?.count ?? 0

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 44,
    overscan: 10,
    getItemKey: (index) => rows[index]?.id ?? index,
    enabled: rows.length > 0,
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

  const sortableCols: Array<SortBy> = [
    'name',
    'category_name',
    'brand_name',
    'on_hand',
    'current_price',
  ]

  const handleSort = (colId: SortBy) => {
    if (!sortableCols.includes(colId)) return
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
              {row.name}
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
      case 'category_name':
        return (
          <Text size="2" color="gray">
            {String(row.category_name ?? '').toUpperCase()}
          </Text>
        )
      case 'brand_name':
        return (
          <Text size="2" color="gray">
            {String(row.brand_name ?? '')}
          </Text>
        )
      case 'on_hand':
        return String(row.on_hand ?? '')
      case 'current_price':
        if (row.current_price == null) return ''
        return fmt.format(Number(row.current_price))
      case 'owner':
        return row.internally_owned ? (
          <Badge size="1" variant="soft" color="indigo">
            Internal
          </Badge>
        ) : (
          <Badge size="1" variant="soft" color="amber">
            {row.external_owner_name ?? 'External'}
          </Badge>
        )
      default:
        return null
    }
  }

  const columns: Array<{ id: string; header: string; sortable: boolean }> = [
    { id: 'name', header: 'Name', sortable: true },
    { id: 'category_name', header: 'Category', sortable: true },
    { id: 'brand_name', header: 'Brand', sortable: true },
    { id: 'on_hand', header: 'On hand', sortable: true },
    { id: 'current_price', header: 'Price', sortable: true },
    { id: 'owner', header: 'Owner', sortable: false },
  ]

  return (
    <div
      ref={containerRef}
      style={{
        height: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Search bar */}
      <Flex ref={controlsRef} gap="2" align="center" wrap="wrap">
        <TextField.Root
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search items, groups…"
          size="3"
          style={{ flex: '1 1 260px' }}
        >
          <TextField.Slot side="left">
            <Search />
          </TextField.Slot>
          <TextField.Slot side="right">
            {isFetching && <Spinner />}
          </TextField.Slot>
        </TextField.Root>

        <Select.Root
          value={categoryFilter ?? ''}
          size="3"
          onValueChange={(val) =>
            setCategoryFilter(val === '' ? null : val)
          }
        >
          <Select.Trigger
            placeholder="Filter category…"
            style={{ minHeight: 'var(--space-7)' }}
          />
          <Select.Content>
            <Select.Item value="all">All</Select.Item>
            {categories.map((name) => (
              <Select.Item key={name} value={name}>
                {name.toUpperCase()}
              </Select.Item>
            ))}
          </Select.Content>
        </Select.Root>

        <Button size="2" variant="solid" onClick={() => setAddItemOpen(true)}>
          <Plus width={16} height={16} /> Add item
        </Button>
        <Button
          size="2"
          variant="solid"
          onClick={() => setAddGroupDialog(true)}
        >
          <Plus width={16} height={16} /> Add group
        </Button>
      </Flex>

      {/* Table header */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: GRID_COLUMNS,
          gap: 'var(--space-2)',
          padding: 'var(--space-2) var(--space-3)',
          backgroundColor: 'var(--gray-a2)',
          borderRadius: 'var(--radius-2)',
          marginTop: 16,
          flexShrink: 0,
        }}
      >
        {columns.map((col) => {
          const canSort = col.sortable && sortableCols.includes(col.id as SortBy)
          const isActive = sortBy === col.id
          const arrow = isActive ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''

          return (
            <div
              key={col.id}
              onClick={() => canSort && handleSort(col.id as SortBy)}
              style={{
                cursor: canSort ? 'pointer' : undefined,
                userSelect: 'none',
                fontSize: 'var(--font-size-1)',
                fontWeight: 600,
              }}
              title={canSort ? 'Click to sort' : undefined}
            >
              {col.header}
              {arrow}
            </div>
          )
        })}
      </div>

      {/* Virtualized list body */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
          marginTop: 8,
        }}
      >
        {isLoading ? (
          <Flex align="center" justify="center" py="6">
            <Spinner size="2" />
          </Flex>
        ) : rows.length === 0 ? (
          <Flex align="center" justify="center" py="6">
            <Text size="2" color="gray">
              No results
            </Text>
          </Flex>
        ) : (
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const row = rows[virtualRow.index]

              const isActive = row.id === selectedId

              return (
                <div
                  key={row.id}
                  data-index={virtualRow.index}
                  onClick={() => onSelect(row.id)}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                    display: 'grid',
                    gridTemplateColumns: GRID_COLUMNS,
                    gap: 'var(--space-2)',
                    alignItems: 'center',
                    padding: '0 var(--space-3)',
                    cursor: 'pointer',
                    backgroundColor: isActive ? 'var(--accent-a3)' : 'transparent',
                    borderRadius: 'var(--radius-2)',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = 'var(--gray-a2)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = 'transparent'
                    }
                  }}
                >
                  {columns.map((col) => (
                    <div key={col.id}>{renderCell(row, col.id)}</div>
                  ))}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Item count */}
      {totalCount > 0 && (
        <Flex align="center" mt="2">
          <Text size="2" color="gray">
            {totalCount} item{totalCount !== 1 ? 's' : ''}
          </Text>
        </Flex>
      )}

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
    </div>
  )
}
