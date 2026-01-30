import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Badge,
  Box,
  Button,
  Card,
  Dialog,
  Flex,
  Heading,
  IconButton,
  SegmentedControl,
  Text,
  TextField,
} from '@radix-ui/themes'
import { supabase } from '@shared/api/supabase'
import { Car, NavArrowDown, NavArrowRight, Trash, Truck } from 'iconoir-react'
import { useCompany } from '@shared/companies/CompanyProvider'
import { useAuthz } from '@shared/auth/useAuthz'
import { useToast } from '@shared/ui/toast/ToastProvider'
import { FixedTimePeriodEditor } from '@features/calendar/components/reservations/TimePeriodPicker'
import BookVehicleDialog from '../dialogs/BookVehicleDialog'
import type {
  BookingStatus,
  ExternalReqStatus,
  ReservedVehicleRow,
} from '../../types'

type TransportQueryResult = {
  bookings: Array<ReservedVehicleRow>
  notices: Array<{
    id: string
    title: string | null
    notes: string
    start_at: string
    end_at: string
  }>
}

export default function TransportTab({ jobId }: { jobId: string }) {
  const [bookVehOpen, setBookVehOpen] = React.useState(false)
  const [deletingBooking, setDeletingBooking] = React.useState<string | null>(
    null,
  )
  const { companyId } = useCompany()
  const { companyRole } = useAuthz()
  const canBook = !!companyId && companyRole !== 'freelancer'
  const isReadOnly = companyRole === 'freelancer'

  const qc = useQueryClient()
  const { success, error: showError } = useToast()
  const [editingNotes, setEditingNotes] = React.useState<Map<string, string>>(
    new Map(),
  )
  const [expandedCards, setExpandedCards] = React.useState<Set<string>>(
    new Set(),
  )

  const { data } = useQuery<TransportQueryResult>({
    queryKey: ['jobs.transport', jobId],
    queryFn: async () => {
      const { data: timePeriods, error: rErr } = await supabase
        .from('time_periods')
        .select('id, title, notes, start_at, end_at, deleted')
        .eq('job_id', jobId)
        .eq('category', 'transport')
        .eq('deleted', false)

      if (rErr) throw rErr

      const resIds = (timePeriods || []).map((r: any) => r.id)

      if (!resIds.length) {
        return {
          bookings: [] as Array<ReservedVehicleRow>,
          notices: [],
        }
      }

      const { data: rows, error } = await supabase
        .from('reserved_vehicles')
        .select(
          `
          id, time_period_id, vehicle_id, status, external_status, external_note,
          vehicle:vehicle_id (
            id, name, image_path, external_owner_id, deleted,
            external_owner:external_owner_id ( id, name )
          ),
          time_period:time_period_id ( id, title, notes, start_at, end_at )
        `,
        )
        .in('time_period_id', resIds)

      if (error) throw error

      // Filter out rows where vehicle is deleted
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      const filteredRows = (rows || []).filter((row: any) => {
        const vehicle = row.vehicle
        // Handle both array and object formats from Supabase
        const vehicleObj = Array.isArray(vehicle) ? vehicle[0] : vehicle
        return !vehicleObj?.deleted
      })

      const bookings = filteredRows as unknown as Array<ReservedVehicleRow>

      const bookedTimePeriodIds = new Set(
        bookings.map((row: any) => row.time_period_id),
      )

      const notices = (timePeriods || [])
        .filter(
          (tp: any) => tp.notes && !bookedTimePeriodIds.has(tp.id as string),
        )
        .map((tp: any) => ({
          id: tp.id as string,
          title: (tp.title as string | null) ?? null,
          notes: tp.notes as string,
          start_at: tp.start_at as string,
          end_at: tp.end_at as string,
        }))

      return { bookings, notices }
    },
  })

  const bookings = data?.bookings ?? []
  const notices = data?.notices ?? []

  const handleUpdateBooking = async (
    bookingId: string,
    updates: {
      status?: BookingStatus
      external_status?: ExternalReqStatus
      external_note?: string
    },
  ) => {
    try {
      const { error: updateErr } = await supabase
        .from('reserved_vehicles')
        .update(updates)
        .eq('id', bookingId)
      if (updateErr) throw updateErr

      await qc.invalidateQueries({ queryKey: ['jobs.transport', jobId] })
      success('Updated', 'Vehicle booking updated')

      // Clear the edited note
      if (updates.external_note !== undefined) {
        const newNotes = new Map(editingNotes)
        newNotes.delete(bookingId)
        setEditingNotes(newNotes)
      }
    } catch (e: any) {
      showError('Failed to update', e?.message || 'Please try again.')
    }
  }

  const deleteBooking = async (bookingId: string) => {
    try {
      // First, get the time_period_id to check if we should delete it
      const { data: booking, error: fetchErr } = await supabase
        .from('reserved_vehicles')
        .select('time_period_id')
        .eq('id', bookingId)
        .single()
      if (fetchErr) throw fetchErr

      // Check if any other vehicles use this time period
      const { data: otherBookings, error: checkErr } = await supabase
        .from('reserved_vehicles')
        .select('id')
        .eq('time_period_id', booking.time_period_id)
        .neq('id', bookingId)
      if (checkErr) throw checkErr

      // Delete the booking
      const { error: deleteErr } = await supabase
        .from('reserved_vehicles')
        .delete()
        .eq('id', bookingId)
      if (deleteErr) throw deleteErr

      // If no other bookings use this time period, delete it
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (!otherBookings || otherBookings.length === 0) {
        const { error: tpDeleteErr } = await supabase
          .from('time_periods')
          .delete()
          .eq('id', booking.time_period_id)
        if (tpDeleteErr) throw tpDeleteErr
      }

      await qc.invalidateQueries({ queryKey: ['jobs.transport', jobId] })
      await qc.invalidateQueries({ queryKey: ['jobs', jobId, 'time_periods'] })
      success('Deleted', 'Vehicle booking deleted')
      setDeletingBooking(null)
    } catch (e: any) {
      showError('Failed to delete', e?.message || 'Please try again.')
    }
  }

  return (
    <Box>
      <Box
        mb="2"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Heading size="3">Transportation</Heading>
        {!isReadOnly && (
          <>
            <Button
              size="2"
              disabled={!canBook}
              onClick={() => setBookVehOpen(true)}
            >
              <Truck /> Book vehicle
            </Button>
            {canBook && (
              <BookVehicleDialog
                open={bookVehOpen}
                onOpenChange={setBookVehOpen}
                jobId={jobId}
                companyId={companyId}
              />
            )}
          </>
        )}
      </Box>

      {/* Notices for missing vehicle proposals */}
      {notices.length > 0 && (
        <Flex direction="column" gap="2" mb="3">
          {notices.map((notice) => (
            <Card
              key={notice.id}
              variant="surface"
              style={{ border: '1px solid var(--amber-a5)' }}
            >
              <Flex direction="column" gap="2">
                <Flex align="center" gap="2">
                  <Text weight="medium" color="amber">
                    Vehicle proposal missing
                  </Text>
                  {notice.title && (
                    <Badge variant="soft" color="amber">
                      {notice.title}
                    </Badge>
                  )}
                </Flex>
                <Text size="2">{notice.notes}</Text>
              </Flex>
            </Card>
          ))}
        </Flex>
      )}

      {/* Vehicle Cards List */}
      {bookings.length > 0 ? (
        <Flex direction="column" gap="3">
          {bookings.map((row) => {
            const vehicle = row.vehicle as any
            const vehicleObj = Array.isArray(vehicle) ? vehicle[0] : vehicle
            const owner = Array.isArray(vehicleObj?.external_owner)
              ? vehicleObj?.external_owner[0]
              : vehicleObj?.external_owner
            const ownerName = owner?.name
            const isInternal = !vehicleObj?.external_owner_id
            const currentNote = row.external_note ?? ''
            const editedNote = editingNotes.get(row.id) ?? currentNote
            const noteChanged = editedNote !== currentNote

            return (
              <VehicleBookingCard
                key={row.id}
                row={row}
                vehicle={vehicleObj}
                ownerName={ownerName}
                isInternal={isInternal}
                editedNote={editedNote}
                noteChanged={noteChanged}
                isReadOnly={isReadOnly}
                jobId={jobId}
                isExpanded={expandedCards.has(row.id)}
                onToggleExpand={() => {
                  setExpandedCards((prev) => {
                    const next = new Set(prev)
                    if (next.has(row.id)) {
                      next.delete(row.id)
                    } else {
                      next.add(row.id)
                    }
                    return next
                  })
                }}
                onNoteChange={(note) => {
                  const newNotes = new Map(editingNotes)
                  newNotes.set(row.id, note)
                  setEditingNotes(newNotes)
                }}
                onSaveNote={() => {
                  handleUpdateBooking(row.id, {
                    external_note: editedNote,
                  })
                }}
                onStatusChange={(status) => {
                  handleUpdateBooking(row.id, {
                    status: status,
                  })
                }}
                onDelete={() => setDeletingBooking(row.id)}
              />
            )
          })}
        </Flex>
      ) : (
        /* Empty State */
        <Box
          p="4"
          style={{
            border: '2px dashed var(--gray-a6)',
            borderRadius: 8,
            textAlign: 'center',
            cursor: canBook ? 'pointer' : 'default',
            transition: 'all 100ms',
          }}
          onClick={() => canBook && setBookVehOpen(true)}
          onMouseEnter={(e) => {
            if (canBook) {
              e.currentTarget.style.borderColor = 'var(--gray-a8)'
              e.currentTarget.style.background = 'var(--gray-a2)'
            }
          }}
          onMouseLeave={(e) => {
            if (canBook) {
              e.currentTarget.style.borderColor = 'var(--gray-a6)'
              e.currentTarget.style.background = 'transparent'
            }
          }}
        >
          <Flex direction="column" align="center" gap="2">
            <Truck width={24} height={24} />
            <Text size="2" color="gray">
              {canBook ? 'Book vehicle' : 'No vehicles'}
            </Text>
          </Flex>
        </Box>
      )}

      {/* Delete Confirmation Dialog */}
      {deletingBooking && (
        <Dialog.Root
          open={!!deletingBooking}
          onOpenChange={(open) => !open && setDeletingBooking(null)}
        >
          <Dialog.Content maxWidth="450px">
            <Dialog.Title>Delete Vehicle Booking?</Dialog.Title>
            <Dialog.Description size="2" mb="4">
              Are you sure you want to delete this vehicle booking? The
              associated time period will also be deleted if no other vehicles
              use it.
            </Dialog.Description>
            <Flex gap="3" justify="end">
              <Button variant="soft" onClick={() => setDeletingBooking(null)}>
                Cancel
              </Button>
              <Button
                color="red"
                onClick={() => deleteBooking(deletingBooking)}
              >
                Delete
              </Button>
            </Flex>
          </Dialog.Content>
        </Dialog.Root>
      )}
    </Box>
  )
}

function VehicleBookingCard({
  row,
  vehicle,
  ownerName,
  isInternal,
  editedNote,
  noteChanged,
  isReadOnly,
  jobId,
  isExpanded,
  onToggleExpand,
  onNoteChange,
  onSaveNote,
  onStatusChange,
  onDelete,
}: {
  row: ReservedVehicleRow
  vehicle: any
  ownerName?: string
  isInternal: boolean
  editedNote: string
  noteChanged: boolean
  isReadOnly: boolean
  jobId: string
  isExpanded: boolean
  onToggleExpand: () => void
  onNoteChange: (note: string) => void
  onSaveNote: () => void
  onStatusChange: (status: BookingStatus) => void
  onDelete: () => void
}) {
  const vehicleName = vehicle?.name ?? '—'
  const currentStatus = row.status ?? 'planned'

  const imageUrl = React.useMemo(() => {
    if (!vehicle?.image_path) return null
    const { data } = supabase.storage
      .from('vehicle_images')
      .getPublicUrl(vehicle.image_path)
    return data.publicUrl
  }, [vehicle?.image_path])

  return (
    <Card
      size="2"
      variant="surface"
      style={{
        background: 'var(--gray-a1)',
        border: '1px solid var(--gray-a5)',
      }}
    >
      <Flex
        direction="row"
        gap="3"
        align="start"
        onClick={onToggleExpand}
        style={{ cursor: 'pointer' }}
      >
        {/* Vehicle Image */}
        <Box
          style={{
            width: '120px',
            height: '120px',
            borderRadius: 8,
            overflow: 'hidden',
            background: 'var(--gray-a2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={vehicleName}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
              }}
            />
          ) : (
            <Car
              style={{
                width: '40px',
                height: '40px',
                color: 'var(--gray-a9)',
              }}
            />
          )}
        </Box>

        {/* Vehicle Info */}
        <Flex direction="column" gap="2" style={{ flex: 1 }}>
          <Flex align="center" justify="between">
            <Flex align="center" gap="2" style={{ flex: 1 }}>
              {isExpanded ? (
                <NavArrowDown width={16} height={16} />
              ) : (
                <NavArrowRight width={16} height={16} />
              )}
              <Text size="3" weight="medium">
                {vehicleName}
              </Text>
            </Flex>
            {!isReadOnly && (
              <Flex gap="1" onClick={(e) => e.stopPropagation()}>
                <IconButton
                  size="1"
                  variant="ghost"
                  color="red"
                  onClick={onDelete}
                >
                  <Trash />
                </IconButton>
              </Flex>
            )}
          </Flex>

          <Flex gap="2" wrap="wrap">
            {ownerName && (
              <Badge variant="soft" color="violet">
                {ownerName}
              </Badge>
            )}

            {isInternal && (
              <Badge variant="soft" color="indigo">
                Internal
              </Badge>
            )}

            <Box onClick={(e) => e.stopPropagation()}>
              {isReadOnly ? (
                <Badge
                  radius="full"
                  highContrast
                  color={
                    currentStatus === 'confirmed'
                      ? 'green'
                      : currentStatus === 'canceled'
                        ? 'red'
                        : 'gray'
                  }
                >
                  {currentStatus}
                </Badge>
              ) : (
                <BookingStatusControl
                  value={currentStatus}
                  onChange={onStatusChange}
                />
              )}
            </Box>
          </Flex>
        </Flex>
      </Flex>

      {/* Expanded Content */}
      {isExpanded && (
        <Box
          pt="3"
          mt="3"
          style={{
            borderTop: '1px solid var(--gray-a5)',
          }}
        >
          <Flex direction="column" gap="3">
            {/* Time Period */}
            <Box>
              <Text size="1" weight="medium" mb="1">
                Time Period
              </Text>
              {row.time_period_id ? (
                <FixedTimePeriodEditor
                  jobId={jobId}
                  timePeriodId={row.time_period_id}
                  readOnly={isReadOnly}
                />
              ) : (
                <Box
                  p="2"
                  style={{
                    border: '1px dashed var(--amber-a6)',
                    borderRadius: 8,
                    background: 'var(--amber-a2)',
                  }}
                >
                  <Text size="2" color="amber">
                    No time period set
                  </Text>
                </Box>
              )}
            </Box>

            {/* Note */}
            {!isInternal && (
              <Box>
                <Text size="1" weight="medium" mb="1">
                  Note
                </Text>
                {isReadOnly ? (
                  <Text size="2">{editedNote || '—'}</Text>
                ) : (
                  <TextField.Root
                    placeholder="Add note…"
                    value={editedNote}
                    onChange={(e) => onNoteChange(e.target.value)}
                  >
                    {noteChanged && (
                      <TextField.Slot side="right">
                        <Button size="2" variant="ghost" onClick={onSaveNote}>
                          Save
                        </Button>
                      </TextField.Slot>
                    )}
                  </TextField.Root>
                )}
              </Box>
            )}
          </Flex>
        </Box>
      )}
    </Card>
  )
}

function BookingStatusControl({
  value,
  onChange,
}: {
  value: BookingStatus
  onChange: (v: BookingStatus) => void
}) {
  const all: Array<BookingStatus> = ['planned', 'confirmed', 'canceled']
  return (
    <SegmentedControl.Root
      value={value}
      onValueChange={(v) => onChange(v as BookingStatus)}
      size="1"
    >
      {all.map((s) => (
        <SegmentedControl.Item
          key={s}
          value={s}
          style={{
            color:
              s === 'confirmed'
                ? 'var(--green-9)'
                : s === 'canceled'
                  ? 'var(--red-9)'
                  : undefined,
          }}
        >
          {s}
        </SegmentedControl.Item>
      ))}
    </SegmentedControl.Root>
  )
}
