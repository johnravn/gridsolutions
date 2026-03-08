// src/features/vehicles/components/VehicleBookingsList.tsx
import * as React from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  Badge,
  Box,
  Flex,
  IconButton,
  SegmentedControl,
  Spinner,
  Text,
} from '@radix-ui/themes'
import { Calendar, Clock, Edit, Trash } from 'iconoir-react'
import type { EventInput } from '@fullcalendar/core'

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

const GRID_COLUMNS = 'minmax(0, 2fr) minmax(180px, 1.5fr) minmax(90px, auto) minmax(80px, auto)'

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
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const displayEvents = listMode === 'past' ? pastEvents : events
  const displayLoading = listMode === 'past' ? isLoadingPast : isLoading

  const rowVirtualizer = useVirtualizer({
    count: displayEvents.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 52,
    overscan: 10,
    getItemKey: (index) =>
      (displayEvents[index]?.id as string) ?? `list-${index}`,
    enabled: displayEvents.length > 0,
  })

  const renderBookingRow = (ev: BookingEvent) => {
    const id = ev.id as string
    const xp = ev.extendedProps
    const jobId = xp?.ref?.jobId
    const displayTitle =
      xp?.jobTitle || (ev.title as string) || 'Booking'
    const isPersonal = !jobId
    return (
      <div
        key={id}
        style={{
          display: 'grid',
          gridTemplateColumns: GRID_COLUMNS,
          gap: 'var(--space-2)',
          alignItems: 'center',
          padding: '0 var(--space-3)',
          height: 52,
          borderRadius: 'var(--radius-2)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--gray-a2)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent'
        }}
      >
        <Text size="2" weight="medium" truncate>
          {displayTitle}
        </Text>
        <Text size="2" color="gray">
          {formatRange(
            ev.start as string,
            ev.end as string | null | undefined,
          )}
        </Text>
        <Box>
          {isPersonal ? (
            <Badge variant="soft" color="blue">
              Personal
            </Badge>
          ) : (
            <Badge variant="soft" color="indigo">
              Job
            </Badge>
          )}
        </Box>
        <Flex gap="1" shrink="0">
          {isPersonal ? (
            <>
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
            </>
          ) : (
            <Text size="1" color="gray">
              —
            </Text>
          )}
        </Flex>
      </div>
    )
  }

  return (
    <Box>
      {/* Upcoming / Earlier segmented control */}
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

      {/* Table header */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: GRID_COLUMNS,
          gap: 'var(--space-2)',
          padding: 'var(--space-2) var(--space-3)',
          backgroundColor: 'var(--gray-a2)',
          borderRadius: 'var(--radius-2)',
          marginBottom: 8,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            fontSize: 'var(--font-size-1)',
            fontWeight: 600,
          }}
        >
          Title
        </div>
        <div
          style={{
            fontSize: 'var(--font-size-1)',
            fontWeight: 600,
          }}
        >
          Date
        </div>
        <div
          style={{
            fontSize: 'var(--font-size-1)',
            fontWeight: 600,
          }}
        >
          Type
        </div>
        <div
          style={{
            fontSize: 'var(--font-size-1)',
            fontWeight: 600,
          }}
        >
          Actions
        </div>
      </div>

      {/* Single virtualized list - shows Upcoming or Earlier based on mode */}
      <div
        ref={scrollRef}
        style={{
          minHeight: 200,
          maxHeight: 400,
          overflow: 'auto',
        }}
      >
        {displayLoading ? (
          <Flex align="center" justify="center" py="6">
            <Spinner size="2" />
          </Flex>
        ) : displayEvents.length === 0 ? (
          <Flex align="center" justify="center" py="6">
            <Text size="2" color="gray">
              {listMode === 'future'
                ? 'No upcoming bookings. Book this vehicle or open the calendar.'
                : 'No earlier bookings.'}
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
            {rowVirtualizer.getVirtualItems().map((virtualRow) => (
              <div
                key={displayEvents[virtualRow.index]?.id}
                data-index={virtualRow.index}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                {renderBookingRow(displayEvents[virtualRow.index])}
              </div>
            ))}
          </div>
        )}
      </div>

      {displayEvents.length > 0 && !displayLoading && (
        <Flex align="center" mt="2">
          <Text size="2" color="gray">
            {displayEvents.length}{' '}
            {listMode === 'future' ? 'upcoming' : 'earlier'} booking
            {displayEvents.length !== 1 ? 's' : ''}
          </Text>
        </Flex>
      )}
    </Box>
  )
}
