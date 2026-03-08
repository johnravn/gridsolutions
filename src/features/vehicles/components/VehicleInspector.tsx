import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertDialog,
  Badge,
  Box,
  Button,
  Code,
  Flex,
  SegmentedControl,
  Separator,
  Spinner,
  Text,
} from '@radix-ui/themes'
import { Edit, Plus, Trash } from 'iconoir-react'
import { useCompany } from '@shared/companies/CompanyProvider'
import { useToast } from '@shared/ui/toast/ToastProvider'
import { supabase } from '@shared/api/supabase'
import { toEventInputs } from '@features/calendar/components/domain'
import InspectorCalendar from '@features/calendar/components/InspectorCalendar'
import {
  vehicleCalendarQuery,
  vehiclePastCalendarQuery,
} from '@features/calendar/api/queries'
import {
  deletePersonalVehicleBooking,
  markVehicleDeleted,
  vehicleDetailQuery,
} from '../api/queries'
import AddEditVehicleDialog from './dialogs/AddEditVehicleDialog'
import BookPersonalVehicleDialog from './dialogs/BookPersonalVehicleDialog'
import VehicleBookingsList from './VehicleBookingsList'
import type { EventInput } from '@fullcalendar/core'

const INSPECTOR_TIME_ZONE = 'Europe/Oslo'

function convertDateToTimeZoneIso(
  value: EventInput['start'],
  timeZone: string,
) {
  if (!value) return undefined

  const date =
    value instanceof Date
      ? value
      : typeof value === 'string' || typeof value === 'number'
        ? new Date(value)
        : null

  if (!date || Number.isNaN(date.getTime())) return undefined

  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? ''

  const year = get('year')
  const month = get('month')
  const day = get('day')
  const hour = get('hour')
  const minute = get('minute')
  const second = get('second')

  if (!year || !month || !day || !hour || !minute || !second) return undefined

  return `${year}-${month}-${day}T${hour}:${minute}:${second}`
}

function normalizeEventsForTimeZone(
  events: Array<EventInput>,
  timeZone: string,
) {
  return events.map((event) => {
    if (event.allDay) return event

    const normalized: EventInput = { ...event }
    const normalizedStart = convertDateToTimeZoneIso(event.start, timeZone)
    if (normalizedStart) normalized.start = normalizedStart

    if (event.end) {
      const normalizedEnd = convertDateToTimeZoneIso(event.end, timeZone)
      if (normalizedEnd) normalized.end = normalizedEnd
    }

    return normalized
  })
}

export default function VehicleInspector({ id }: { id: string | null }) {
  const { companyId } = useCompany()
  const { error: toastError, success } = useToast()
  const qc = useQueryClient()
  const [editOpen, setEditOpen] = React.useState(false)
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [bookDialogOpen, setBookDialogOpen] = React.useState(false)
  const [bookDialogMode, setBookDialogMode] = React.useState<'create' | 'edit'>(
    'create',
  )
  const [bookDialogInitial, setBookDialogInitial] = React.useState<{
    timePeriodId: string
    title: string
    startAt: string
    endAt: string
  } | null>(null)
  const [deleteBookingId, setDeleteBookingId] = React.useState<string | null>(
    null,
  )
  const [viewMode, setViewMode] = React.useState<'calendar' | 'bookings'>(
    'calendar',
  )
  const [showPastBookings, setShowPastBookings] = React.useState(false)
  const [calendarOffset, setCalendarOffset] = React.useState(0)
  const [accumulatedEvents, setAccumulatedEvents] = React.useState<
    Array<EventInput>
  >([])

  const enabled = Boolean(companyId && id)
  const { data, isLoading, isError, error } = useQuery({
    ...vehicleDetailQuery({ companyId: companyId ?? '', id: id ?? '' }),
    enabled,
  })

  // Track the last processed offset to prevent duplicate processing
  const lastProcessedOffsetRef = React.useRef<number>(-1)

  // Fetch calendar events for this vehicle with pagination
  // Note: Not filtering by fromDate to show all reservations (past and future)
  const { data: calendarRecords = [], isLoading: isLoadingCalendar } = useQuery(
    {
      ...vehicleCalendarQuery({
        companyId: companyId ?? '',
        vehicleId: id ?? '',
        limit: 5,
        offset: calendarOffset,
        // No fromDate - show all reservations
      }),
      enabled: enabled && !!id,
    },
  )

  // Stable fromDate for query key - only changes when switching to booking view
  const fromDate = React.useMemo(
    () => new Date().toISOString(),
    [viewMode],
  )

  // Fetch future bookings for booking view (no limit - all future, including in-progress)
  const { data: futureRecords = [], isLoading: isLoadingFuture } = useQuery({
    ...vehicleCalendarQuery({
      companyId: companyId ?? '',
      vehicleId: id ?? '',
      fromDate,
      includeInProgress: true,
      // No limit - fetch all future
    }),
    enabled: enabled && !!id && viewMode === 'bookings',
  })

  const futureEvents = React.useMemo(() => {
    if (viewMode !== 'bookings' || futureRecords.length === 0) return []
    return normalizeEventsForTimeZone(
      toEventInputs(futureRecords),
      INSPECTOR_TIME_ZONE,
    )
  }, [viewMode, futureRecords])

  const toDate = React.useMemo(
    () => new Date().toISOString(),
    [viewMode],
  )

  const { data: pastRecords = [], isLoading: isLoadingPast } = useQuery({
    ...vehiclePastCalendarQuery({
      companyId: companyId ?? '',
      vehicleId: id ?? '',
      toDate,
    }),
    enabled: enabled && !!id && viewMode === 'bookings' && showPastBookings,
  })

  const pastEvents = React.useMemo(() => {
    if (
      viewMode !== 'bookings' ||
      !showPastBookings ||
      pastRecords.length === 0
    )
      return []
    return normalizeEventsForTimeZone(
      toEventInputs(pastRecords),
      INSPECTOR_TIME_ZONE,
    )
  }, [viewMode, showPastBookings, pastRecords])

  // Reset when vehicle changes
  React.useEffect(() => {
    setAccumulatedEvents([])
    setCalendarOffset(0)
    setViewMode('calendar')
    setShowPastBookings(false)
    lastProcessedOffsetRef.current = -1
  }, [id])

  // Accumulate events as we load more pages - only process once per offset
  React.useEffect(() => {
    // Skip if loading or if we've already processed this offset
    if (
      isLoadingCalendar ||
      lastProcessedOffsetRef.current === calendarOffset
    ) {
      return
    }

    // Mark this offset as processed
    lastProcessedOffsetRef.current = calendarOffset

    if (calendarRecords.length > 0) {
      const newEvents = normalizeEventsForTimeZone(
        toEventInputs(calendarRecords),
        INSPECTOR_TIME_ZONE,
      )

      if (calendarOffset === 0) {
        // First page - replace
        setAccumulatedEvents(newEvents)
      } else {
        // Subsequent pages - append (use functional update to avoid stale closure)
        setAccumulatedEvents((prev) => {
          // Prevent duplicates by checking IDs
          const existingIds = new Set(prev.map((e) => e.id))
          const uniqueNew = newEvents.filter(
            (e) => e.id && !existingIds.has(e.id),
          )
          return [...prev, ...uniqueNew]
        })
      }
    } else if (calendarOffset === 0) {
      // No events on first page - reset
      setAccumulatedEvents([])
    }
  }, [calendarRecords, calendarOffset, isLoadingCalendar])

  // Determine if there are more events to load
  const hasMoreEvents = calendarRecords.length === 5

  const handleLoadNext = React.useCallback(() => {
    setCalendarOffset((prev) => prev + 5)
  }, [])

  const deleteBooking = useMutation({
    mutationFn: deletePersonalVehicleBooking,
    onSuccess: async () => {
      await qc.invalidateQueries({
        queryKey: ['company', companyId, 'vehicle-calendar', id],
        exact: false,
      })
      success('Deleted', 'Personal booking removed')
      setDeleteBookingId(null)
    },
    onError: (err: unknown) =>
      toastError(
        'Failed to delete',
        (err as Error).message || 'Please try again.',
      ),
  })

  const handleBook = React.useCallback(() => {
    setBookDialogMode('create')
    setBookDialogInitial(null)
    setBookDialogOpen(true)
  }, [])

  const handleEditBooking = React.useCallback(
    (eventId: string, ev: EventInput) => {
      const start =
        typeof ev.start === 'string'
          ? ev.start
          : ev.start instanceof Date
            ? ev.start.toISOString()
            : undefined
      const end =
        typeof ev.end === 'string'
          ? ev.end
          : ev.end instanceof Date
            ? ev.end.toISOString()
            : undefined
      if (!start) return
      setBookDialogMode('edit')
      setBookDialogInitial({
        timePeriodId: eventId,
        title: String(ev.title ?? ''),
        startAt: start,
        endAt: end ?? start,
      })
      setBookDialogOpen(true)
    },
    [],
  )

  const handleDeleteBooking = React.useCallback((eventId: string) => {
    setDeleteBookingId(eventId)
  }, [])

  const del = useMutation({
    mutationFn: async () => {
      if (!companyId || !id || !data) throw new Error('Missing ids or data')

      await markVehicleDeleted({ companyId, id })

      // Log activity
      try {
        const { logActivity } = await import('@features/latest/api/queries')
        await logActivity({
          companyId,
          activityType: 'vehicle_removed',
          metadata: {
            vehicle_id: id,
            vehicle_name: data.name,
            license_plate: data.registration_no || null,
          },
          title: data.name,
        })
      } catch (logErr) {
        console.error('Failed to log activity:', logErr)
        // Don't fail the whole operation if logging fails
      }
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({
          queryKey: ['company', companyId, 'vehicles-index'],
          exact: false,
        }),
        qc.invalidateQueries({
          queryKey: ['company', companyId, 'vehicle-detail'],
          exact: false,
        }),
        qc.invalidateQueries({
          queryKey: ['company', companyId, 'latest-feed'],
          exact: false,
        }),
      ])
      success('Deleted', 'Vehicle was marked as deleted.')
      setDeleteOpen(false)
    },
    onError: (e: any) =>
      toastError('Failed to delete', e?.message ?? 'Please try again.'),
  })

  // ---- Early returns BEFORE any non-hook logic ----
  if (!id) return <Text color="gray">Select a vehicle.</Text>
  if (!enabled) return <Text color="gray">Preparing…</Text>
  if (isLoading)
    return (
      <Flex align="center" gap="1">
        <Text>Thinking</Text>
        <Spinner size="2" />
      </Flex>
    )
  if (isError)
    return (
      <Text color="red">
        Failed to load.{' '}
        <Code>{(error as any)?.message || 'Unknown error'}</Code>
      </Text>
    )
  if (!data) return <Text color="gray">Not found.</Text>

  // ---- Safe to use 'data' now; no hooks below this line ----
  const v = data
  const imageUrl = v.image_path
    ? supabase.storage.from('vehicle_images').getPublicUrl(v.image_path).data
        .publicUrl
    : null

  const fuelColor: React.ComponentProps<typeof Badge>['color'] =
    v.fuel === 'electric' ? 'green' : v.fuel === 'diesel' ? 'orange' : 'blue'

  return (
    <Box>
      {/* Header */}
      <Flex align="center" justify="between" gap="2">
        <div>
          <Text as="div" size="4" weight="bold">
            {v.name}
          </Text>
          <Text as="div" size="2" color="gray">
            {v.registration_no ?? '—'}
            {' · '}
            <Badge variant="soft" color={fuelColor}>
              {v.fuel ?? '—'}
            </Badge>
            {' · '}
            {v.internally_owned ? (
              <Badge variant="soft" color="indigo">
                Internal
              </Badge>
            ) : (
              <Badge variant="soft" color="violet">
                {v.external_owner_name ?? 'External'}
              </Badge>
            )}
          </Text>
        </div>
        <Flex gap="2">
          <Button size="2" variant="soft" onClick={() => setEditOpen(true)}>
            <Edit />
          </Button>
          <Button
            size="2"
            variant="surface"
            color="red"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash />
          </Button>
        </Flex>
      </Flex>

      <Separator my="3" />

      {/* Image */}
      <div
        style={{
          border: '1px solid var(--gray-a6)',
          borderRadius: 8,
          overflow: 'hidden',
          marginBottom: 12,
          padding: 10,
          maxWidth: 300,
        }}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={v.name}
            style={{
              width: '100%',
              // maxHeight: 280,
              // maxWidth: 280,
              objectFit: 'cover',
            }}
          />
        ) : (
          <div
            style={{
              height: 160,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--gray-10)',
            }}
          >
            No image
          </div>
        )}
      </div>

      {/* Meta */}
      <Flex direction="column" gap="2">
        <Field
          label="Owner"
          value={
            v.internally_owned
              ? 'Internal (your company)'
              : (v.external_owner_name ?? 'External')
          }
        />
        <Field
          label="Vehicle Category"
          value={
            v.vehicle_category
              ? (() => {
                  const map: Record<string, string> = {
                    passenger_car_small: 'Passenger Car - Small',
                    passenger_car_medium: 'Passenger Car - Medium',
                    passenger_car_big: 'Passenger Car - Big',
                    van_small: 'Van - Small',
                    van_medium: 'Van - Medium',
                    van_big: 'Van - Big',
                    C1: 'C1',
                    C1E: 'C1E',
                    C: 'C',
                    CE: 'CE',
                  }
                  return map[v.vehicle_category] || v.vehicle_category
                })()
              : '—'
          }
        />
        <Field
          label="Created"
          value={new Date(v.created_at).toLocaleString(undefined, {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          })}
        />
        <Field label="Notes" value={v.notes || '—'} />
      </Flex>

      <Flex align="center" justify="between" mb="3" wrap="wrap" gap="2">
        <SegmentedControl.Root
          value={viewMode}
          onValueChange={(mode) => {
            if (mode === 'calendar' || mode === 'bookings') {
              setViewMode(mode)
              if (mode === 'calendar') setShowPastBookings(false)
            }
          }}
          size="2"
        >
          <SegmentedControl.Item value="calendar">
            Schedule
          </SegmentedControl.Item>
          <SegmentedControl.Item value="bookings">
            Bookings
          </SegmentedControl.Item>
        </SegmentedControl.Root>
        {viewMode === 'bookings' && (
          <Button size="2" variant="soft" onClick={handleBook}>
            <Plus />
            Book vehicle
          </Button>
        )}
      </Flex>

      {viewMode === 'calendar' ? (
        <InspectorCalendar
          events={accumulatedEvents}
          hasMore={hasMoreEvents}
          onLoadNext={handleLoadNext}
          showPagination={true}
        />
      ) : (
        <VehicleBookingsList
          events={futureEvents}
          pastEvents={pastEvents}
          listMode={showPastBookings ? 'past' : 'future'}
          onListModeChange={(mode) => setShowPastBookings(mode === 'past')}
          onEdit={handleEditBooking}
          onDelete={handleDeleteBooking}
          isLoading={isLoadingFuture}
          isLoadingPast={isLoadingPast}
        />
      )}

      {/* Edit vehicle dialog */}
      <AddEditVehicleDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        mode="edit"
        initial={{
          id: v.id,
          name: v.name,
          registration_no: v.registration_no ?? '',
          fuel: v.fuel ?? null,
          vehicle_category: v.vehicle_category ?? null,
          internally_owned: v.internally_owned,
          external_owner_id: v.external_owner_id,
          image_path: v.image_path ?? null,
          notes: v.notes ?? '',
        }}
        onSaved={() => {
          // invalidate done in dialog
        }}
      />

      {/* Book personal vehicle dialog */}
      {companyId && (
        <BookPersonalVehicleDialog
          open={bookDialogOpen}
          onOpenChange={setBookDialogOpen}
          mode={bookDialogMode}
          companyId={companyId}
          vehicleId={id}
          initial={bookDialogInitial ?? undefined}
          onSaved={() => {
            // invalidate done in dialog
          }}
        />
      )}

      {/* Delete personal booking confirm */}
      <AlertDialog.Root
        open={deleteBookingId != null}
        onOpenChange={(open) => !open && setDeleteBookingId(null)}
      >
        <AlertDialog.Content maxWidth="400px">
          <AlertDialog.Title>Delete booking?</AlertDialog.Title>
          <AlertDialog.Description size="2">
            This will remove the personal booking. This cannot be undone.
          </AlertDialog.Description>
          <Flex gap="3" justify="end" mt="4">
            <AlertDialog.Cancel>
              <Button variant="soft">Cancel</Button>
            </AlertDialog.Cancel>
            <Button
              color="red"
              variant="solid"
              disabled={deleteBooking.isPending}
              onClick={() => {
                if (deleteBookingId) deleteBooking.mutate(deleteBookingId)
              }}
            >
              {deleteBooking.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </Flex>
        </AlertDialog.Content>
      </AlertDialog.Root>

      {/* Delete vehicle confirm */}
      <AlertDialog.Root open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialog.Content maxWidth="480px">
          <AlertDialog.Title>Delete vehicle?</AlertDialog.Title>
          <AlertDialog.Description size="2">
            This will mark <b>{v.name}</b> as deleted. You can restore in the DB
            if needed.
          </AlertDialog.Description>
          <Flex gap="3" justify="end" mt="4">
            <AlertDialog.Cancel>
              <Button variant="soft">Cancel</Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action>
              <Button
                color="red"
                variant="solid"
                onClick={() => del.mutate()}
                disabled={del.isPending}
              >
                {del.isPending ? 'Deleting…' : 'Yes, delete'}
              </Button>
            </AlertDialog.Action>
          </Flex>
        </AlertDialog.Content>
      </AlertDialog.Root>
    </Box>
  )
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <Text as="div" size="1" color="gray" style={{ marginBottom: 4 }}>
        {label}
      </Text>
      <Text as="div" size="2">
        {value}
      </Text>
    </div>
  )
}
