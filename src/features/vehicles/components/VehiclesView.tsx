import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Search } from 'iconoir-react'
import { Badge, Box, Button, Flex, Spinner, Text, TextField } from '@radix-ui/themes'
import { useCompany } from '@shared/companies/CompanyProvider'
import { vehiclesIndexQuery } from '../api/queries'
import AddEditVehicleDialog from './dialogs/AddEditVehicleDialog'
import type { VehicleIndexRow } from '../api/queries'

const GRID_COLUMNS = 'minmax(140px, 2fr) minmax(80px, 1fr) minmax(80px, 1fr) minmax(100px, 1fr)'

type SortBy = 'name' | 'registration_no' | 'fuel' | 'owner'
type SortDir = 'asc' | 'desc'

const SORTABLE_COLUMNS: Array<{ id: SortBy; header: string }> = [
  { id: 'name', header: 'Name' },
  { id: 'registration_no', header: 'Reg' },
  { id: 'fuel', header: 'Fuel' },
  { id: 'owner', header: 'Owner' },
]

function compareVehicles(
  a: VehicleIndexRow,
  b: VehicleIndexRow,
  sortBy: SortBy,
  sortDir: SortDir,
): number {
  let cmp = 0
  switch (sortBy) {
    case 'name':
      cmp = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
      break
    case 'registration_no':
      cmp = (a.registration_no ?? '').localeCompare(b.registration_no ?? '', undefined, { sensitivity: 'base' })
      break
    case 'fuel':
      cmp = (a.fuel ?? '').localeCompare(b.fuel ?? '', undefined, { sensitivity: 'base' })
      break
    case 'owner':
      cmp = Number(a.internally_owned) - Number(b.internally_owned)
      if (cmp === 0) {
        cmp = (a.external_owner_name ?? '').localeCompare(b.external_owner_name ?? '', undefined, { sensitivity: 'base' })
      }
      break
    default:
      return 0
  }
  return sortDir === 'asc' ? cmp : -cmp
}

type Props = {
  selectedId: string | null
  onSelect: (id: string) => void
  includeExternal: boolean
  search: string
  onSearch: (v: string) => void
}

export default function VehiclesView({
  selectedId,
  onSelect,
  includeExternal,
  search,
  onSearch,
}: Props) {
  const { companyId } = useCompany()
  const [addOpen, setAddOpen] = React.useState(false)
  const [sortBy, setSortBy] = React.useState<SortBy>('name')
  const [sortDir, setSortDir] = React.useState<SortDir>('asc')

  const containerRef = React.useRef<HTMLDivElement>(null)
  const controlsRef = React.useRef<HTMLDivElement>(null)
  const scrollRef = React.useRef<HTMLDivElement>(null)

  const {
    data: rawRows = [],
    isLoading,
    isFetching,
  } = useQuery({
    ...vehiclesIndexQuery({
      companyId: companyId ?? '__none__',
      includeExternal,
      search,
    }),
    enabled: !!companyId,
  })

  const rows = React.useMemo(
    () => [...rawRows].sort((a, b) => compareVehicles(a, b, sortBy, sortDir)),
    [rawRows, sortBy, sortDir],
  )

  const handleSort = (colId: SortBy) => {
    if (sortBy === colId) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(colId)
      setSortDir('asc')
    }
  }

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 44,
    overscan: 10,
    getItemKey: (index) => rows[index]?.id ?? index,
    enabled: rows.length > 0,
  })

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
      <Flex ref={controlsRef} gap="2" align="center" wrap="wrap">
        <TextField.Root
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search vehicles…"
          size="3"
          style={{ flex: '1 1 260px' }}
        >
          <TextField.Slot side="left">
            <Search />
          </TextField.Slot>
          <TextField.Slot side="right">
            {(isLoading || isFetching) && <Spinner />}
          </TextField.Slot>
        </TextField.Root>

        <Button variant="classic" onClick={() => setAddOpen(true)}>
          Add vehicle
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
        {SORTABLE_COLUMNS.map((col) => {
          const isActive = sortBy === col.id
          const arrow = isActive ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''
          return (
            <div
              key={col.id}
              onClick={() => handleSort(col.id)}
              style={{
                fontSize: 'var(--font-size-1)',
                fontWeight: 600,
                cursor: 'pointer',
                userSelect: 'none',
              }}
              title="Click to sort"
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
              No vehicles
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
                  <Text size="2" weight="medium">
                    {row.name}
                  </Text>
                  <Text size="2" color="gray">
                    {row.registration_no ?? '—'}
                  </Text>
                  <Box>
                    {row.fuel ? (
                      <Badge
                        variant="soft"
                        color={
                          row.fuel === 'electric'
                            ? 'green'
                            : row.fuel === 'diesel'
                              ? 'orange'
                              : 'blue'
                        }
                      >
                        {row.fuel}
                      </Badge>
                    ) : (
                      '—'
                    )}
                  </Box>
                  <Box>
                    {row.internally_owned ? (
                      <Badge variant="soft" color="indigo">
                        Internal
                      </Badge>
                    ) : (
                      <Badge variant="soft" color="violet">
                        {row.external_owner_name ?? 'External'}
                      </Badge>
                    )}
                  </Box>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {rows.length > 0 && (
        <Flex align="center" mt="2">
          <Text size="2" color="gray">
            {rows.length} vehicle{rows.length !== 1 ? 's' : ''}
          </Text>
        </Flex>
      )}

      <AddEditVehicleDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        mode="create"
        onSaved={() => {}}
      />
    </div>
  )
}
