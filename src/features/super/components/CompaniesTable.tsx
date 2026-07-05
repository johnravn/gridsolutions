// src/features/super/components/CompaniesTable.tsx
import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Flex, Text, TextField } from '@radix-ui/themes'
import { Search } from 'iconoir-react'
import {
  VirtualIndexTable,
  applySortDir,
  useClientSort,
  useClientTableFilter,
  useVirtualIndexTable,
} from '@shared/ui/index-table'
import { companiesIndexQuery } from '@features/company/api/queries'
import type { IndexColumn } from '@shared/ui/index-table'
import type { CompanyIndexRow } from '@features/company/api/queries'

type SortBy = 'name' | 'email' | 'contact'

const GRID_COLUMNS = 'minmax(140px, 2fr) minmax(120px, 1fr) minmax(120px, 1fr)'

const COLUMNS: Array<IndexColumn<SortBy>> = [
  { id: 'name', header: 'Name', sortable: true, sortKey: 'name' },
  { id: 'email', header: 'Email', sortable: true, sortKey: 'email' },
  {
    id: 'contact',
    header: 'Contact Person',
    sortable: true,
    sortKey: 'contact',
  },
]

const SEARCH_FIELDS = [
  (c: CompanyIndexRow) => c.name,
  (c: CompanyIndexRow) => c.general_email,
  (c: CompanyIndexRow) => c.address,
  (c: CompanyIndexRow) => c.vat_number,
  (c: CompanyIndexRow) => c.contact_person?.display_name,
  (c: CompanyIndexRow) => c.contact_person?.email,
]

function compare(
  a: CompanyIndexRow,
  b: CompanyIndexRow,
  sortBy: SortBy,
  sortDir: 'asc' | 'desc',
): number {
  let cmp = 0
  switch (sortBy) {
    case 'name':
      cmp = (a.name ?? '').localeCompare(b.name ?? '', undefined, {
        sensitivity: 'base',
      })
      break
    case 'email':
      cmp = (a.general_email ?? '').localeCompare(
        b.general_email ?? '',
        undefined,
        { sensitivity: 'base' },
      )
      break
    case 'contact':
      cmp = (
        a.contact_person?.display_name ??
        a.contact_person?.email ??
        ''
      ).localeCompare(
        b.contact_person?.display_name ?? b.contact_person?.email ?? '',
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
  onEdit: (company: CompanyIndexRow) => void
  onDelete: (company: CompanyIndexRow) => void
}

export default function CompaniesTable({ selectedId, onSelect }: Props) {
  const [search, setSearch] = React.useState('')
  const { sortBy, sortDir, handleSort } = useClientSort<SortBy>('name', 'asc')

  const { data: rawRows = [], isLoading } = useQuery({
    ...companiesIndexQuery(),
  })

  const filtered = useClientTableFilter(rawRows, search, SEARCH_FIELDS)

  const rows = React.useMemo(
    () => [...filtered].sort((a, b) => compare(a, b, sortBy, sortDir)),
    [filtered, sortBy, sortDir],
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
          case 'email':
            return (
              <Text size="2" color="gray">
                {row.general_email || '—'}
              </Text>
            )
          case 'contact':
            return (
              <Text size="2" color="gray">
                {row.contact_person?.display_name ||
                  row.contact_person?.email ||
                  '—'}
              </Text>
            )
          default:
            return null
        }
      }}
      selectedId={selectedId}
      onSelect={onSelect}
      sortBy={sortBy}
      sortDir={sortDir}
      onSort={handleSort}
      sortableColumns={['name', 'email', 'contact']}
      scrollRef={scrollRef}
      rowVirtualizer={rowVirtualizer}
      isLoading={isLoading}
      loadingPlacement="fullscreen"
      emptyMessage={search ? 'No companies found' : 'No companies'}
      footerCount={{
        shown: rows.length,
        label: (n) => `${n} compan${n !== 1 ? 'ies' : 'y'}`,
      }}
      horizontalScroll={false}
      toolbar={
        <Flex gap="2" align="center" wrap="wrap" mb="2">
          <TextField.Root
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search companies…"
            size="3"
            style={{ flex: '1 1 260px' }}
          >
            <TextField.Slot side="left">
              <Search />
            </TextField.Slot>
          </TextField.Root>
        </Flex>
      }
    />
  )
}
