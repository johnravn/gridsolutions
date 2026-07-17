import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus, Search } from 'iconoir-react'
import { Badge, Button, Flex, Spinner, Text, TextField } from '@radix-ui/themes'
import { useMediaQuery } from '@app/hooks/useMediaQuery'
import { useCompany } from '@shared/companies/CompanyProvider'
import { useCompanyWriteAccess } from '@features/demo/hooks/useCompanyWriteAccess'
import {
  VirtualIndexTable,
  applySortDir,
  useClientSort,
  useVirtualIndexTable,
} from '@shared/ui/index-table'
import { vehiclesIndexQuery } from '../api/queries'
import { vehicleOwnerBadge, vehicleOwnerLabel } from '../lib/ownership'
import AddEditVehicleDialog from './dialogs/AddEditVehicleDialog'
import type { IndexColumn } from '@shared/ui/index-table'
import type { VehicleIndexRow } from '../api/queries'

const GRID_COLUMNS =
  'minmax(140px, 2fr) minmax(80px, 1fr) minmax(80px, 1fr) minmax(100px, 1fr)'

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
}

export default function VehiclesView({
  selectedId,
  onSelect,
  includeExternal,
  search,
  onSearch,
  createShortcutRef,
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
                {row.name}
              </Text>
            )
          case 'registration_no':
            return (
              <Text size="2" color="gray">
                {row.registration_no ?? '—'}
              </Text>
            )
          case 'fuel':
            return row.fuel ? (
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
          case 'owner': {
            const ownerBadge = vehicleOwnerBadge(row)
            return (
              <Badge variant="soft" color={ownerBadge.color}>
                {ownerBadge.label}
              </Badge>
            )
          }
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
      toolbar={
        <Flex
          gap="2"
          align="center"
          wrap="wrap"
          direction={isMobile ? 'column' : 'row'}
        >
          <TextField.Root
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search vehicles…"
            size="3"
            style={{ flex: isMobile ? undefined : '1 1 260px', width: '100%' }}
          >
            <TextField.Slot side="left">
              <Search />
            </TextField.Slot>
            <TextField.Slot side="right">
              {(isLoading || isFetching) && <Spinner />}
            </TextField.Slot>
          </TextField.Root>

          {canWrite && (
            <Button
              variant="solid"
              onClick={() => setAddOpen(true)}
              style={isMobile ? { width: '100%' } : undefined}
              size={isMobile ? '3' : '2'}
            >
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
      }
    />
  )
}
