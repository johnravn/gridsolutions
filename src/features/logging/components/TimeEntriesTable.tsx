import * as React from 'react'
import {
  Avatar,
  Box,
  Button,
  Dialog,
  Flex,
  IconButton,
  Spinner,
  Text,
} from '@radix-ui/themes'
import { Edit, Trash } from 'iconoir-react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { supabase } from '@shared/api/supabase'
import { getInitialsFromNameOrEmail } from '@shared/lib/generalFunctions'
import type { TimeEntryWithProfile } from '../api/timeEntries'

const GRID_COLUMNS_WITH_EMPLOYEE =
  'minmax(140px, 1.5fr) minmax(80px, 1fr) minmax(64px, 1fr) minmax(64px, 1fr) minmax(100px, 2fr) minmax(56px, 1fr) minmax(64px, 1fr) minmax(56px, 1fr) minmax(80px, 1fr)'
const GRID_COLUMNS_WITHOUT_EMPLOYEE =
  'minmax(80px, 1fr) minmax(64px, 1fr) minmax(64px, 1fr) minmax(100px, 2fr) minmax(56px, 1fr) minmax(64px, 1fr) minmax(56px, 1fr) minmax(80px, 1fr)'

type SortBy =
  | 'employee'
  | 'date'
  | 'start'
  | 'end'
  | 'title'
  | 'job_number'
  | 'duration'
type SortDir = 'asc' | 'desc'

const SORTABLE_COLUMNS: Array<{ id: SortBy; header: string }> = [
  { id: 'employee', header: 'Employee' },
  { id: 'date', header: 'Date' },
  { id: 'start', header: 'Start' },
  { id: 'end', header: 'End' },
  { id: 'title', header: 'Title' },
  { id: 'job_number', header: 'Job #' },
  { id: 'duration', header: 'Duration' },
]

function getDisplayName(
  profile: TimeEntryWithProfile['profile'] | null | undefined,
) {
  if (!profile) return null
  return (
    profile.display_name ||
    [profile.first_name, profile.last_name].filter(Boolean).join(' ') ||
    profile.email
  )
}

function getAvatarUrl(avatarPath: string | null | undefined): string | null {
  if (!avatarPath) return null
  const { data } = supabase.storage.from('avatars').getPublicUrl(avatarPath)
  return data.publicUrl
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDuration(startAt: string, endAt: string) {
  const start = new Date(startAt)
  const end = new Date(endAt)
  const durationMs = Math.max(0, end.getTime() - start.getTime())
  const hours = Math.floor(durationMs / (1000 * 60 * 60))
  const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60))
  if (hours === 0 && minutes === 0) return '0m'
  if (hours === 0) return `${minutes}m`
  if (minutes === 0) return `${hours}h`
  return `${hours}h ${minutes}m`
}

function getDurationMs(entry: TimeEntryWithProfile) {
  const start = new Date(entry.start_at).getTime()
  const end = new Date(entry.end_at).getTime()
  return Math.max(0, end - start)
}

function isBlankNote(note: string | null | undefined) {
  return !note || note.trim().length === 0
}

function compareEntries(
  a: TimeEntryWithProfile,
  b: TimeEntryWithProfile,
  sortBy: SortBy,
  sortDir: SortDir,
): number {
  let cmp = 0
  const nameA = getDisplayName(a.profile) ?? ''
  const nameB = getDisplayName(b.profile) ?? ''
  switch (sortBy) {
    case 'employee':
      cmp = nameA.localeCompare(nameB, undefined, { sensitivity: 'base' })
      break
    case 'date':
      cmp =
        new Date(a.start_at).getTime() - new Date(b.start_at).getTime()
      break
    case 'start':
      cmp =
        new Date(a.start_at).getTime() - new Date(b.start_at).getTime()
      break
    case 'end':
      cmp = new Date(a.end_at).getTime() - new Date(b.end_at).getTime()
      break
    case 'title':
      cmp = (a.title ?? '').localeCompare(b.title ?? '', undefined, {
        sensitivity: 'base',
      })
      break
    case 'job_number':
      cmp = (a.job_number ?? '').localeCompare(b.job_number ?? '', undefined, {
        sensitivity: 'base',
      })
      break
    case 'duration':
      cmp = getDurationMs(a) - getDurationMs(b)
      break
    default:
      return 0
  }
  return sortDir === 'asc' ? cmp : -cmp
}

export default function TimeEntriesTable({
  entries,
  isLoading,
  emptyLabel = 'No entries yet for this period.',
  showEmployeeColumn = true,
  onEditEntry,
  canEditEntry,
  onDeleteEntry,
  canDeleteEntry,
}: {
  entries: Array<TimeEntryWithProfile>
  isLoading: boolean
  emptyLabel?: string
  showEmployeeColumn?: boolean
  onEditEntry?: (entry: TimeEntryWithProfile) => void
  canEditEntry?: (entry: TimeEntryWithProfile) => boolean
  onDeleteEntry?: (entry: TimeEntryWithProfile) => void
  canDeleteEntry?: (entry: TimeEntryWithProfile) => boolean
}) {
  const [sortBy, setSortBy] = React.useState<SortBy>('date')
  const [sortDir, setSortDir] = React.useState<SortDir>('asc')
  const scrollRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!showEmployeeColumn && sortBy === 'employee') {
      setSortBy('date')
    }
  }, [showEmployeeColumn, sortBy])

  const columns = React.useMemo(
    () =>
      showEmployeeColumn
        ? SORTABLE_COLUMNS
        : SORTABLE_COLUMNS.filter((c) => c.id !== 'employee'),
    [showEmployeeColumn],
  )
  const gridColumns = showEmployeeColumn
    ? GRID_COLUMNS_WITH_EMPLOYEE
    : GRID_COLUMNS_WITHOUT_EMPLOYEE

  const rows = React.useMemo(
    () => [...entries].sort((a, b) => compareEntries(a, b, sortBy, sortDir)),
    [entries, sortBy, sortDir],
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
    estimateSize: () => 48,
    overscan: 10,
    getItemKey: (index) => rows[index]?.id ?? index,
    enabled: rows.length > 0,
  })

  return (
    <div
      style={{
        height: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Table header - same style as VehiclesView */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: gridColumns,
          gap: 'var(--space-2)',
          padding: 'var(--space-2) var(--space-3)',
          backgroundColor: 'var(--gray-a2)',
          borderRadius: 'var(--radius-2)',
          flexShrink: 0,
        }}
      >
        {columns.map((col) => {
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
        <div style={{ fontSize: 'var(--font-size-1)', fontWeight: 600 }}>
          Note
        </div>
        {(onEditEntry || onDeleteEntry) && (
          <div
            style={{
              fontSize: 'var(--font-size-1)',
              fontWeight: 600,
              textAlign: 'end',
            }}
          >
            Actions
          </div>
        )}
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
              {emptyLabel}
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
              const entry = rows[virtualRow.index]
              const canEdit = onEditEntry && (!canEditEntry || canEditEntry(entry))
              const canDelete =
                onDeleteEntry && (!canDeleteEntry || canDeleteEntry(entry))

              return (
                <div
                  key={entry.id}
                  data-index={virtualRow.index}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                    display: 'grid',
                    gridTemplateColumns: gridColumns,
                    gap: 'var(--space-2)',
                    alignItems: 'center',
                    padding: '0 var(--space-3)',
                    borderRadius: 'var(--radius-2)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--gray-a2)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent'
                  }}
                >
                  {showEmployeeColumn && (
                    <Flex align="center" gap="2">
                      <Avatar
                        size="2"
                        radius="full"
                        fallback={getInitialsFromNameOrEmail(
                          entry.profile?.display_name ??
                            [entry.profile?.first_name, entry.profile?.last_name]
                              .filter(Boolean)
                              .join(' ') ??
                            null,
                          entry.profile?.email ?? '??',
                        )}
                        src={getAvatarUrl(entry.profile?.avatar_url) ?? undefined}
                        style={{ border: '1px solid var(--gray-5)' }}
                      />
                      <Text size="2">
                        {getDisplayName(entry.profile) ?? 'Unknown'}
                      </Text>
                    </Flex>
                  )}
                  <Text size="2" color="gray">
                    {formatDate(entry.start_at)}
                  </Text>
                  <Text size="2" color="gray">
                    {formatTime(entry.start_at)}
                  </Text>
                  <Text size="2" color="gray">
                    {formatTime(entry.end_at)}
                  </Text>
                  <Text size="2" weight="medium" trim="end">
                    {entry.title}
                  </Text>
                  <Text size="2" color="gray">
                    {entry.job_number ?? '—'}
                  </Text>
                  <Text size="2" color="gray">
                    {formatDuration(entry.start_at, entry.end_at)}
                  </Text>
                  <Box>
                    {isBlankNote(entry.note) ? (
                      <Text size="2" color="gray">
                        —
                      </Text>
                    ) : (
                      <Dialog.Root>
                        <Dialog.Trigger asChild>
                          <Button variant="soft" size="1">
                            Show
                          </Button>
                        </Dialog.Trigger>
                        <Dialog.Content size="2" style={{ maxWidth: 520 }}>
                          <Dialog.Title>Note</Dialog.Title>
                          <Dialog.Description size="2" color="gray" mb="3">
                            Details for this time entry.
                          </Dialog.Description>
                          <Text
                            size="2"
                            style={{ whiteSpace: 'pre-wrap' }}
                          >
                            {entry.note}
                          </Text>
                        </Dialog.Content>
                      </Dialog.Root>
                    )}
                  </Box>
                  {(onEditEntry || onDeleteEntry) && (
                    <Flex
                      align="center"
                      gap="1"
                      justify="end"
                      style={{ paddingRight: 0 }}
                    >
                      {onEditEntry && (
                        <IconButton
                          variant="ghost"
                          size="1"
                          onClick={() => onEditEntry(entry)}
                          disabled={!canEdit}
                          aria-label="Edit time entry"
                        >
                          <Edit width={14} height={14} />
                        </IconButton>
                      )}
                      {onDeleteEntry && (
                        <IconButton
                          variant="ghost"
                          size="1"
                          color="red"
                          onClick={() => onDeleteEntry(entry)}
                          disabled={!canDelete}
                          aria-label="Delete time entry"
                        >
                          <Trash width={14} height={14} />
                        </IconButton>
                      )}
                    </Flex>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {rows.length > 0 && (
        <Flex align="center" mt="2">
          <Text size="2" color="gray">
            {rows.length} entr{rows.length !== 1 ? 'ies' : 'y'}
          </Text>
        </Flex>
      )}
    </div>
  )
}
