// src/features/vehicles/components/VehicleBookingsList.tsx
import * as React from 'react'
import {
  Badge,
  Box,
  Flex,
  IconButton,
  SegmentedControl,
  Text,
} from '@radix-ui/themes'
import { Calendar, Clock, Edit, Trash } from 'iconoir-react'
import { VirtualIndexTable, useVirtualIndexTable } from '@shared/ui/index-table'
import type { EventInput } from '@fullcalendar/core'
import type { IndexColumn } from '@shared/ui/index-table'

const TIME_ZONE = 'Europe/Oslo'

function formatRange(start: string | Date, end?: string | null): string {
  const s = new Date(start)
  const e = end ? new Date(end) : null
  const opts: Intl.DateTimeFormatOptions = {
    timeZone: TIME_ZONE,
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }
  const startStr = s.toLocaleString('nb-NO', opts)
  if (!e || s.getTime() === e.getTime()) return startStr
  const endStr = e.toLocaleString('nb-NO', opts)
  return `${startStr} – ${endStr}`
}

type BookingEvent = EventInput & {
  extendedProps?: {
    ref?: { jobId?: string }
    jobTitle?: string
  }
}

const GRID_COLUMNS =
  'minmax(0, 2fr) minmax(180px, 1.5fr) minmax(90px, auto) minmax(80px, auto)'

const COLUMNS: Array<IndexColumn> = [
  { id: 'title', header: 'Title' },
  { id: 'date', header: 'Date' },
  { id: 'type', header: 'Type' },
  { id: 'actions', header: 'Actions' },
]

type Props = {
  events: Array<BookingEvent>
  pastEvents: Array<BookingEvent>
  listMode: 'future' | 'past'
  onListModeChange: (mode: 'future' | 'past') => void
  onEdit: (eventId: string, event: BookingEvent) => void
  onDelete: (eventId: string) => void
  isLoading?: boolean
  isLoadingPast?: boolean
}

export default function VehicleBookingsList({
  events,
  pastEvents,
  listMode,
  onListModeChange,
  onEdit,
  onDelete,
  isLoading = false,
  isLoadingPast = false,
}: Props) {
  const displayEvents = listMode === 'past' ? pastEvents : events
  const displayLoading = listMode === 'past' ? isLoadingPast : isLoading

  const { scrollRef, rowVirtualizer } = useVirtualIndexTable({
    rows: displayEvents,
    getRowId: (ev) => (ev.id as string) ?? '',
    estimateRowSize: 52,
  })

  return (
    <Box>
      <VirtualIndexTable
        rows={displayEvents}
        columns={COLUMNS}
        gridTemplateColumns={GRID_COLUMNS}
        getRowId={(ev) => ev.id as string}
        selectable={false}
        renderCell={(ev, colId) => {
          const id = ev.id as string
          const xp = ev.extendedProps
          const jobId = xp?.ref?.jobId
          const displayTitle = xp?.jobTitle || (ev.title as string) || 'Booking'
          const isPersonal = !jobId

          switch (colId) {
            case 'title':
              return (
                <Text size="2" weight="medium" truncate>
                  {displayTitle}
                </Text>
              )
            case 'date':
              return (
                <Text size="2" color="gray">
                  {formatRange(
                    ev.start as string,
                    ev.end as string | null | undefined,
                  )}
                </Text>
              )
            case 'type':
              return isPersonal ? (
                <Badge variant="soft" color="blue">
                  Personal
                </Badge>
              ) : (
                <Badge variant="soft" color="indigo">
                  Job
                </Badge>
              )
            case 'actions':
              return isPersonal ? (
                <Flex gap="1" shrink="0">
                  <IconButton
                    size="1"
                    variant="ghost"
                    color="gray"
                    title="Edit"
                    onClick={() => onEdit(id, ev)}
                  >
                    <Edit />
                  </IconButton>
                  <IconButton
                    size="1"
                    variant="ghost"
                    color="red"
                    title="Delete"
                    onClick={() => onDelete(id)}
                  >
                    <Trash />
                  </IconButton>
                </Flex>
              ) : (
                <Text size="1" color="gray">
                  —
                </Text>
              )
            default:
              return null
          }
        }}
        scrollRef={scrollRef}
        rowVirtualizer={rowVirtualizer}
        isLoading={displayLoading}
        emptyMessage={
          listMode === 'future'
            ? 'No upcoming bookings. Book this vehicle or open the calendar.'
            : 'No earlier bookings.'
        }
        footerCount={
          displayEvents.length > 0 && !displayLoading
            ? {
                shown: displayEvents.length,
                label: (n) =>
                  `${n} ${listMode === 'future' ? 'upcoming' : 'earlier'} booking${n !== 1 ? 's' : ''}`,
              }
            : false
        }
        horizontalScroll={false}
        scrollBodyStyle={{ minHeight: 200, maxHeight: 400 }}
        toolbar={
          <Flex gap="4" align="center" mb="3">
            <SegmentedControl.Root
              value={listMode}
              onValueChange={(mode) => {
                if (mode === 'future' || mode === 'past') onListModeChange(mode)
              }}
              size="2"
              style={{ gap: 'var(--space-2)', minWidth: 360 }}
            >
              <SegmentedControl.Item value="future">
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 'var(--space-2)',
                  }}
                >
                  <Calendar />
                  Upcoming
                </span>
              </SegmentedControl.Item>
              <SegmentedControl.Item value="past">
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 'var(--space-2)',
                  }}
                >
                  <Clock />
                  Earlier
                </span>
              </SegmentedControl.Item>
            </SegmentedControl.Root>
          </Flex>
        }
      />
    </Box>
  )
}
