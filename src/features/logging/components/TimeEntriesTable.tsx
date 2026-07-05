import * as React from 'react'
import {
  Avatar,
  Button,
  Dialog,
  Flex,
  IconButton,
  Text,
} from '@radix-ui/themes'
import { Edit, Trash } from 'iconoir-react'
import { supabase } from '@shared/api/supabase'
import { getInitialsFromNameOrEmail } from '@shared/lib/generalFunctions'
import {
  VirtualIndexTable,
  applySortDir,
  useClientSort,
  useVirtualIndexTable,
} from '@shared/ui/index-table'
import { formatLoggingDate } from '../lib/timeEntryRange'
import type { IndexColumn } from '@shared/ui/index-table'
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
  return formatLoggingDate(iso)
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
  sortDir: 'asc' | 'desc',
): number {
  let cmp = 0
  const nameA = getDisplayName(a.profile) ?? ''
  const nameB = getDisplayName(b.profile) ?? ''
  switch (sortBy) {
    case 'employee':
      cmp = nameA.localeCompare(nameB, undefined, { sensitivity: 'base' })
      break
    case 'date':
    case 'start':
      cmp = new Date(a.start_at).getTime() - new Date(b.start_at).getTime()
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
  }
  return applySortDir(cmp, sortDir)
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
  const { sortBy, sortDir, setSortBy, handleSort } = useClientSort<SortBy>(
    'date',
    'asc',
  )

  React.useEffect(() => {
    if (!showEmployeeColumn && sortBy === 'employee') {
      setSortBy('date')
    }
  }, [showEmployeeColumn, sortBy, setSortBy])

  const sortableColumns = React.useMemo(() => {
    const cols: Array<SortBy> = [
      'date',
      'start',
      'end',
      'title',
      'job_number',
      'duration',
    ]
    if (showEmployeeColumn) cols.unshift('employee')
    return cols
  }, [showEmployeeColumn])

  const columns = React.useMemo((): Array<IndexColumn<SortBy>> => {
    const base: Array<IndexColumn<SortBy>> = []
    if (showEmployeeColumn) {
      base.push({
        id: 'employee',
        header: 'Employee',
        sortable: true,
        sortKey: 'employee',
      })
    }
    base.push(
      { id: 'date', header: 'Date', sortable: true, sortKey: 'date' },
      { id: 'start', header: 'Start', sortable: true, sortKey: 'start' },
      { id: 'end', header: 'End', sortable: true, sortKey: 'end' },
      { id: 'title', header: 'Title', sortable: true, sortKey: 'title' },
      {
        id: 'job_number',
        header: 'Job #',
        sortable: true,
        sortKey: 'job_number',
      },
      {
        id: 'duration',
        header: 'Duration',
        sortable: true,
        sortKey: 'duration',
      },
      { id: 'note', header: 'Note' },
    )
    if (onEditEntry || onDeleteEntry) {
      base.push({ id: 'actions', header: 'Actions', align: 'end' })
    }
    return base
  }, [showEmployeeColumn, onEditEntry, onDeleteEntry])

  const gridColumns = showEmployeeColumn
    ? GRID_COLUMNS_WITH_EMPLOYEE
    : GRID_COLUMNS_WITHOUT_EMPLOYEE

  const rows = React.useMemo(
    () => [...entries].sort((a, b) => compareEntries(a, b, sortBy, sortDir)),
    [entries, sortBy, sortDir],
  )

  const { scrollRef, rowVirtualizer } = useVirtualIndexTable({
    rows,
    getRowId: (e) => e.id,
    estimateRowSize: 48,
  })

  return (
    <VirtualIndexTable
      rows={rows}
      columns={columns}
      gridTemplateColumns={gridColumns}
      getRowId={(e) => e.id}
      selectable={false}
      renderCell={(entry, colId) => {
        const canEdit = onEditEntry && (!canEditEntry || canEditEntry(entry))
        const canDelete =
          onDeleteEntry && (!canDeleteEntry || canDeleteEntry(entry))

        switch (colId) {
          case 'employee':
            return (
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
            )
          case 'date':
            return (
              <Text size="2" color="gray">
                {formatDate(entry.start_at)}
              </Text>
            )
          case 'start':
            return (
              <Text size="2" color="gray">
                {formatTime(entry.start_at)}
              </Text>
            )
          case 'end':
            return (
              <Text size="2" color="gray">
                {formatTime(entry.end_at)}
              </Text>
            )
          case 'title':
            return (
              <Text size="2" weight="medium" trim="end">
                {entry.title}
              </Text>
            )
          case 'job_number':
            return (
              <Text size="2" color="gray">
                {entry.job_number ?? '—'}
              </Text>
            )
          case 'duration':
            return (
              <Text size="2" color="gray">
                {formatDuration(entry.start_at, entry.end_at)}
              </Text>
            )
          case 'note':
            return isBlankNote(entry.note) ? (
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
                  <Text size="2" style={{ whiteSpace: 'pre-wrap' }}>
                    {entry.note}
                  </Text>
                </Dialog.Content>
              </Dialog.Root>
            )
          case 'actions':
            return (
              <Flex align="center" gap="1" justify="end">
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
            )
          default:
            return null
        }
      }}
      sortBy={sortBy}
      sortDir={sortDir}
      onSort={handleSort}
      sortableColumns={sortableColumns}
      scrollRef={scrollRef}
      rowVirtualizer={rowVirtualizer}
      isLoading={isLoading}
      emptyMessage={emptyLabel}
      footerCount={{
        shown: rows.length,
        label: (n) => `${n} entr${n !== 1 ? 'ies' : 'y'}`,
      }}
      horizontalScroll={false}
    />
  )
}
