import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus, Search } from 'iconoir-react'
import { Badge, Button, Flex, Spinner, Text, TextField } from '@radix-ui/themes'
import { useMediaQuery } from '@app/hooks/useMediaQuery'
import {
  MOBILE_LIST_BOTTOM_PAD,
  MobileBottomActionBar,
  MobilePageList,
} from '@app/layout/mobile'
import { useCompany } from '@shared/companies/CompanyProvider'
import { useCompanyWriteAccess } from '@features/demo/hooks/useCompanyWriteAccess'
import {
  IndexTableBodySkeleton,
  VirtualIndexTable,
  applySortDir,
  useClientSort,
  useVirtualIndexTable,
} from '@shared/ui/index-table'
import {
  INDEX_TABLE_ROW_CLASS,
  INDEX_TABLE_ROW_SELECTED_CLASS,
} from '@shared/ui/index-table/indexTableStyles'
import { HighlightedText } from '@shared/ui/components/HighlightedText'
import { vehiclesIndexQuery } from '../api/queries'
import { vehicleOwnerBadge, vehicleOwnerLabel } from '../lib/ownership'
import AddEditVehicleDialog from './dialogs/AddEditVehicleDialog'
import type { IndexColumn } from '@shared/ui/index-table'
import type { VehicleIndexRow } from '../api/queries'

const GRID_COLUMNS =
  'minmax(140px, 2fr) minmax(80px, 1fr) minmax(80px, 1fr) minmax(100px, 1fr)'
const PAGE_GRID_COLUMNS = 'minmax(0, 1fr) auto auto'

type SortBy = 'name' | 'registration_no' | 'fuel' | 'owner'

const COLUMNS: Array<IndexColumn<SortBy>> = [
  { id: 'name', header: 'Name', sortable: true, sortKey: 'name' },
  {
    id: 'registration_no',
    header: 'Reg',
    sortable: true,
    sortKey: 'registration_no',
  },
  { id: 'fuel', header: 'Fuel', sortable: true, sortKey: 'fuel' },
  { id: 'owner', header: 'Owner', sortable: true, sortKey: 'owner' },
]

function compareVehicles(
  a: VehicleIndexRow,
  b: VehicleIndexRow,
  sortBy: SortBy,
  sortDir: 'asc' | 'desc',
): number {
  let cmp = 0
  switch (sortBy) {
    case 'name':
      cmp = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
      break
    case 'registration_no':
      cmp = (a.registration_no ?? '').localeCompare(
        b.registration_no ?? '',
        undefined,
        { sensitivity: 'base' },
      )
      break
    case 'fuel':
      cmp = (a.fuel ?? '').localeCompare(b.fuel ?? '', undefined, {
        sensitivity: 'base',
      })
      break
    case 'owner':
      cmp = vehicleOwnerLabel(a).localeCompare(
        vehicleOwnerLabel(b),
        undefined,
        { sensitivity: 'base' },
      )
      break
  }
  return applySortDir(cmp, sortDir)
}

type Props = {
  selectedId: string | null
  onSelect: (id: string) => void
  includeExternal: boolean
  search: string
  onSearch: (v: string) => void
  createShortcutRef?: React.MutableRefObject<(() => void) | null>
  toolbarExtra?: React.ReactNode
}

export default function VehiclesView({
  selectedId,
  onSelect,
  includeExternal,
  search,
  onSearch,
  createShortcutRef,
  toolbarExtra,
}: Props) {
  const { companyId } = useCompany()
  const { canWrite } = useCompanyWriteAccess()
  const isMobile = useMediaQuery('(max-width: 1023px)')
  const [addOpen, setAddOpen] = React.useState(false)
  React.useEffect(() => {
    if (!createShortcutRef) return
    createShortcutRef.current = () => setAddOpen(true)
    return () => {
      createShortcutRef.current = null
    }
  }, [createShortcutRef])
  const { sortBy, sortDir, handleSort } = useClientSort<SortBy>('name', 'asc')

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

  const { scrollRef, rowVirtualizer } = useVirtualIndexTable({
    rows,
    getRowId: (r) => r.id,
    estimateRowSize: 44,
  })

  const renderOwner = (row: VehicleIndexRow) => {
    const ownerBadge = vehicleOwnerBadge(row)
    return (
      <Badge variant="soft" color={ownerBadge.color}>
        {ownerBadge.label}
      </Badge>
    )
  }

  const renderFuel = (row: VehicleIndexRow) =>
    row.fuel ? (
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
    )

  const toolbar = (
    <Flex gap={isMobile ? '4' : '2'} align="center" wrap="wrap">
      <Flex
        gap="3"
        align="center"
        style={{ width: isMobile ? '100%' : undefined, flex: 1, minWidth: 0 }}
      >
        <TextField.Root
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search vehicles…"
          size="3"
          style={{
            flex: isMobile ? 1 : '1 1 260px',
            width: '100%',
            minWidth: 0,
          }}
        >
          <TextField.Slot side="left">
            <Search />
          </TextField.Slot>
          <TextField.Slot side="right">
            {(isLoading || isFetching) && <Spinner />}
          </TextField.Slot>
        </TextField.Root>
        {isMobile ? toolbarExtra : null}
      </Flex>

      {canWrite && !isMobile && (
        <Button variant="solid" onClick={() => setAddOpen(true)} size="3">
          <Plus width={18} height={18} />
          Add vehicle
        </Button>
      )}

      <AddEditVehicleDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        mode="create"
        onSaved={() => {}}
      />
    </Flex>
  )

  if (isMobile) {
    return (
      <>
        <MobilePageList toolbar={toolbar}>
          {isLoading ? (
            <IndexTableBodySkeleton rowCount={8} rowHeight={64} />
          ) : rows.length === 0 ? (
            <Text size="2" color="gray">
              No vehicles
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
                      gridTemplateColumns: PAGE_GRID_COLUMNS,
                      gap: 'var(--space-3)',
                      alignItems: 'center',
                      padding: '16px 12px',
                      minHeight: 64,
                      cursor: 'pointer',
                      borderRadius: 'var(--radius-3)',
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <Text size="2" weight="medium">
                        <HighlightedText text={row.name} query={search} />
                      </Text>
                      <Text as="div" size="1" color="gray">
                        {row.registration_no ? (
                          <HighlightedText
                            text={row.registration_no}
                            query={search}
                          />
                        ) : (
                          '—'
                        )}
                      </Text>
                    </div>
                    {renderFuel(row)}
                    {renderOwner(row)}
                  </div>
                )
              })}
            </Flex>
          )}
          {rows.length > 0 && (
            <Text size="2" color="gray">
              {rows.length} vehicle{rows.length !== 1 ? 's' : ''}
            </Text>
          )}
        </MobilePageList>
        {canWrite && (
          <MobileBottomActionBar>
            <Button variant="ghost" size="3" onClick={() => setAddOpen(true)}>
              <Plus width={18} height={18} />
              Add vehicle
            </Button>
          </MobileBottomActionBar>
        )}
      </>
    )
  }

  return (
    <VirtualIndexTable
      rows={rows}
      columns={COLUMNS}
      gridTemplateColumns={GRID_COLUMNS}
      getRowId={(r) => r.id}
      renderCell={(row, colId) => {
        switch (colId) {
          case 'name':
            return (
              <Text size="2" weight="medium">
                <HighlightedText text={row.name} query={search} />
              </Text>
            )
          case 'registration_no':
            return (
              <Text size="2" color="gray">
                {row.registration_no ? (
                  <HighlightedText text={row.registration_no} query={search} />
                ) : (
                  '—'
                )}
              </Text>
            )
          case 'fuel':
            return renderFuel(row)
          case 'owner':
            return renderOwner(row)
          default:
            return null
        }
      }}
      selectedId={selectedId}
      onSelect={onSelect}
      sortBy={sortBy}
      sortDir={sortDir}
      onSort={handleSort}
      sortableColumns={['name', 'registration_no', 'fuel', 'owner']}
      scrollRef={scrollRef}
      rowVirtualizer={rowVirtualizer}
      isLoading={isLoading}
      emptyMessage="No vehicles"
      footerCount={{
        shown: rows.length,
        label: (n) => `${n} vehicle${n !== 1 ? 's' : ''}`,
      }}
      toolbar={toolbar}
    />
  )
}
