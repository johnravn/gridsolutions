// src/features/super/components/UsersTable.tsx
import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  Flex,
  Spinner,
  Text,
  TextField,
} from '@radix-ui/themes'
import { Search } from 'iconoir-react'
import { prettyPhone } from '@shared/phone/phone'
import { usersIndexQuery } from '../api/queries'
import type { UserIndexRow } from '../api/queries'

type SortBy = 'email' | 'name' | 'phone'
type SortDir = 'asc' | 'desc'

const GRID_COLUMNS = 'minmax(160px, 2fr) minmax(120px, 1fr) minmax(100px, 1fr)'

const SORT_COLUMNS: Array<{ id: SortBy; header: string }> = [
  { id: 'email', header: 'Email' },
  { id: 'name', header: 'Name' },
  { id: 'phone', header: 'Phone' },
]

function compare(
  a: UserIndexRow,
  b: UserIndexRow,
  sortBy: SortBy,
  sortDir: SortDir,
): number {
  let cmp = 0
  const aName =
    a.display_name ?? [a.first_name, a.last_name].filter(Boolean).join(' ') ?? ''
  const bName =
    b.display_name ?? [b.first_name, b.last_name].filter(Boolean).join(' ') ?? ''
  switch (sortBy) {
    case 'email':
      cmp = (a.email ?? '').localeCompare(b.email ?? '', undefined, {
        sensitivity: 'base',
      })
      break
    case 'name':
      cmp = aName.localeCompare(bName, undefined, { sensitivity: 'base' })
      break
    case 'phone':
      cmp = (a.phone ?? '').localeCompare(b.phone ?? '', undefined, {
        sensitivity: 'base',
      })
      break
    default:
      return 0
  }
  return sortDir === 'asc' ? cmp : -cmp
}

type Props = {
  selectedId: string | null
  onSelect: (id: string) => void
  onEdit: (user: UserIndexRow) => void
  onDelete: (user: UserIndexRow) => void
}

export default function UsersTable({
  selectedId,
  onSelect,
}: Props) {
  const [search, setSearch] = React.useState('')
  const [sortBy, setSortBy] = React.useState<SortBy>('email')
  const [sortDir, setSortDir] = React.useState<SortDir>('asc')

  const containerRef = React.useRef<HTMLDivElement>(null)
  const controlsRef = React.useRef<HTMLDivElement>(null)
  const scrollRef = React.useRef<HTMLDivElement>(null)

  const { data: rawRows = [], isLoading } = useQuery({
    ...usersIndexQuery(),
  })

  const rows = React.useMemo(() => {
    let list = rawRows
    if (search.trim()) {
      const query = search.toLowerCase()
      list = list.filter(
        (u) =>
          u.email.toLowerCase().includes(query) ||
          u.display_name?.toLowerCase().includes(query) ||
          u.first_name?.toLowerCase().includes(query) ||
          u.last_name?.toLowerCase().includes(query) ||
          u.phone?.toLowerCase().includes(query),
      )
    }
    return [...list].sort((a, b) => compare(a, b, sortBy, sortDir))
  }, [rawRows, search, sortBy, sortDir])

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 44,
    overscan: 10,
    getItemKey: (index) => rows[index]?.user_id ?? index,
    enabled: rows.length > 0,
  })

  const handleSort = (col: SortBy) => {
    if (sortBy === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(col)
      setSortDir('asc')
    }
  }

  if (isLoading) {
    return (
      <Flex align="center" justify="center" py="8">
        <Spinner size="3" />
      </Flex>
    )
  }

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
      <Flex ref={controlsRef} gap="2" align="center" wrap="wrap" mb="2">
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

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: GRID_COLUMNS,
          gap: 'var(--space-2)',
          padding: 'var(--space-2) var(--space-3)',
          backgroundColor: 'var(--gray-a2)',
          borderRadius: 'var(--radius-2)',
          flexShrink: 0,
        }}
      >
        {SORT_COLUMNS.map((col) => {
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

      <div
        ref={scrollRef}
        style={{
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
          marginTop: 8,
        }}
      >
        {rows.length === 0 ? (
          <Flex align="center" justify="center" py="6">
            <Text size="2" color="gray">
              {search ? 'No users found' : 'No users'}
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
              const isActive = row.user_id === selectedId
              const displayName =
                row.display_name ??
                ([row.first_name, row.last_name].filter(Boolean).join(' ') || '—')

              return (
                <div
                  key={row.user_id}
                  data-index={virtualRow.index}
                  onClick={() => onSelect(row.user_id)}
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
                    {row.email}
                  </Text>
                  <Text size="2" color="gray">
                    {displayName}
                  </Text>
                  <Text size="2" color="gray">
                    {prettyPhone(row.phone)}
                  </Text>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {rows.length > 0 && (
        <Flex align="center" mt="2">
          <Text size="2" color="gray">
            {rows.length} user{rows.length !== 1 ? 's' : ''}
          </Text>
        </Flex>
      )}
    </div>
  )
}
