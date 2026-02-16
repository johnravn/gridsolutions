// src/features/super/components/CompaniesTable.tsx
import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Flex, Spinner, Text, TextField } from '@radix-ui/themes'
import { Search } from 'iconoir-react'
import { companiesIndexQuery } from '@features/company/api/queries'
import type { CompanyIndexRow } from '@features/company/api/queries'

type SortBy = 'name' | 'email' | 'contact'
type SortDir = 'asc' | 'desc'

const GRID_COLUMNS = 'minmax(140px, 2fr) minmax(120px, 1fr) minmax(120px, 1fr)'

const SORT_COLUMNS: Array<{ id: SortBy; header: string }> = [
  { id: 'name', header: 'Name' },
  { id: 'email', header: 'Email' },
  { id: 'contact', header: 'Contact Person' },
]

function compare(
  a: CompanyIndexRow,
  b: CompanyIndexRow,
  sortBy: SortBy,
  sortDir: SortDir,
): number {
  let cmp = 0
  switch (sortBy) {
    case 'name':
      cmp = (a.name ?? '').localeCompare(b.name ?? '', undefined, {
        sensitivity: 'base',
      })
      break
    case 'email':
      cmp = (a.general_email ?? '').localeCompare(b.general_email ?? '', undefined, {
        sensitivity: 'base',
      })
      break
    case 'contact':
      cmp = (a.contact_person?.display_name ?? a.contact_person?.email ?? '').localeCompare(
        b.contact_person?.display_name ?? b.contact_person?.email ?? '',
        undefined,
        { sensitivity: 'base' },
      )
      break
    default:
      return 0
  }
  return sortDir === 'asc' ? cmp : -cmp
}

type Props = {
  selectedId: string | null
  onSelect: (id: string) => void
  onEdit: (company: CompanyIndexRow) => void
  onDelete: (company: CompanyIndexRow) => void
}

export default function CompaniesTable({
  selectedId,
  onSelect,
}: Props) {
  const [search, setSearch] = React.useState('')
  const [sortBy, setSortBy] = React.useState<SortBy>('name')
  const [sortDir, setSortDir] = React.useState<SortDir>('asc')

  const containerRef = React.useRef<HTMLDivElement>(null)
  const controlsRef = React.useRef<HTMLDivElement>(null)
  const scrollRef = React.useRef<HTMLDivElement>(null)

  const { data: rawRows = [], isLoading } = useQuery({
    ...companiesIndexQuery(),
  })

  const rows = React.useMemo(() => {
    let list = rawRows
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.general_email?.toLowerCase().includes(q) ||
          c.address?.toLowerCase().includes(q) ||
          c.vat_number?.toLowerCase().includes(q),
      )
    }
    return [...list].sort((a, b) => compare(a, b, sortBy, sortDir))
  }, [rawRows, search, sortBy, sortDir])

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 44,
    overscan: 10,
    getItemKey: (index) => rows[index]?.id ?? index,
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
          placeholder="Search companies…"
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
              {search ? 'No companies found' : 'No companies'}
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
                    {row.general_email || '—'}
                  </Text>
                  <Text size="2" color="gray">
                    {row.contact_person?.display_name ||
                      row.contact_person?.email ||
                      '—'}
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
            {rows.length} compan{rows.length !== 1 ? 'ies' : 'y'}
          </Text>
        </Flex>
      )}
    </div>
  )
}
