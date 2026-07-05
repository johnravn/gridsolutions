// src/features/super/components/UsersTable.tsx
import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Flex, Spinner, Text, TextField } from '@radix-ui/themes'
import { Search } from 'iconoir-react'
import { prettyPhone } from '@shared/phone/phone'
import {
  VirtualIndexTable,
  applySortDir,
  useClientSort,
  useClientTableFilter,
  useVirtualIndexTable,
} from '@shared/ui/index-table'
import { usersIndexQuery } from '../api/queries'
import type { IndexColumn } from '@shared/ui/index-table'
import type { UserIndexRow } from '../api/queries'

type SortBy = 'email' | 'name' | 'phone'

const GRID_COLUMNS = 'minmax(160px, 2fr) minmax(120px, 1fr) minmax(100px, 1fr)'

const COLUMNS: Array<IndexColumn<SortBy>> = [
  { id: 'email', header: 'Email', sortable: true, sortKey: 'email' },
  { id: 'name', header: 'Name', sortable: true, sortKey: 'name' },
  { id: 'phone', header: 'Phone', sortable: true, sortKey: 'phone' },
]

const SEARCH_FIELDS = [
  (u: UserIndexRow) => u.email,
  (u: UserIndexRow) => u.display_name,
  (u: UserIndexRow) => u.first_name,
  (u: UserIndexRow) => u.last_name,
  (u: UserIndexRow) => u.phone,
]

function displayName(row: UserIndexRow): string {
  return (
    row.display_name ??
    ([row.first_name, row.last_name].filter(Boolean).join(' ') || '—')
  )
}

function compare(
  a: UserIndexRow,
  b: UserIndexRow,
  sortBy: SortBy,
  sortDir: 'asc' | 'desc',
): number {
  let cmp = 0
  switch (sortBy) {
    case 'email':
      cmp = (a.email ?? '').localeCompare(b.email ?? '', undefined, {
        sensitivity: 'base',
      })
      break
    case 'name':
      cmp = displayName(a).localeCompare(displayName(b), undefined, {
        sensitivity: 'base',
      })
      break
    case 'phone':
      cmp = (a.phone ?? '').localeCompare(b.phone ?? '', undefined, {
        sensitivity: 'base',
      })
      break
  }
  return applySortDir(cmp, sortDir)
}

type Props = {
  selectedId: string | null
  onSelect: (id: string) => void
  onEdit: (user: UserIndexRow) => void
  onDelete: (user: UserIndexRow) => void
}

export default function UsersTable({ selectedId, onSelect }: Props) {
  const [search, setSearch] = React.useState('')
  const { sortBy, sortDir, handleSort } = useClientSort<SortBy>('email', 'asc')

  const { data: rawRows = [], isLoading } = useQuery({
    ...usersIndexQuery(),
  })

  const filtered = useClientTableFilter(rawRows, search, SEARCH_FIELDS)

  const rows = React.useMemo(
    () => [...filtered].sort((a, b) => compare(a, b, sortBy, sortDir)),
    [filtered, sortBy, sortDir],
  )

  const { scrollRef, rowVirtualizer } = useVirtualIndexTable({
    rows,
    getRowId: (r) => r.user_id,
    estimateRowSize: 44,
  })

  return (
    <VirtualIndexTable
      rows={rows}
      columns={COLUMNS}
      gridTemplateColumns={GRID_COLUMNS}
      getRowId={(r) => r.user_id}
      renderCell={(row, colId) => {
        switch (colId) {
          case 'email':
            return (
              <Text size="2" weight="medium">
                {row.email}
              </Text>
            )
          case 'name':
            return (
              <Text size="2" color="gray">
                {displayName(row)}
              </Text>
            )
          case 'phone':
            return (
              <Text size="2" color="gray">
                {prettyPhone(row.phone)}
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
      sortableColumns={['email', 'name', 'phone']}
      scrollRef={scrollRef}
      rowVirtualizer={rowVirtualizer}
      isLoading={isLoading}
      loadingPlacement="fullscreen"
      emptyMessage={search ? 'No users found' : 'No users'}
      footerCount={{
        shown: rows.length,
        label: (n) => `${n} user${n !== 1 ? 's' : ''}`,
      }}
      horizontalScroll={false}
      toolbar={
        <Flex gap="2" align="center" wrap="wrap" mb="2">
          <TextField.Root
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search users…"
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
