// src/features/jobs/components/dialogs/BookVehicleDialog.tsx
import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Badge,
  Box,
  Button,
  Card,
  Dialog,
  Flex,
  SegmentedControl,
  Select,
  Separator,
  Table,
  Text,
  TextField,
} from '@radix-ui/themes'
import { Car } from 'iconoir-react'
import { supabase } from '@shared/api/supabase'
import { useToast } from '@shared/ui/toast/ToastProvider'
import { addThreeHours } from '@shared/lib/generalFunctions'
import DateTimePicker from '@shared/ui/components/DateTimePicker'
import { vehiclesIndexQuery } from '@features/vehicles/api/queries'
import { jobDetailQuery } from '@features/jobs/api/queries'
import type { ExternalReqStatus, UUID } from '../../types'

type ViewMode = 'grid' | 'list'
type OwnerType = 'internal' | 'external'

export default function BookVehicleDialog({
  open,
  onOpenChange,
  jobId,
  companyId,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  jobId: UUID
  companyId: UUID
}) {
  const qc = useQueryClient()
  const { success, error: showError } = useToast()

  // Vehicle selection
  const [vehicleId, setVehicleId] = React.useState<UUID | ''>('')
  const [ownerType, setOwnerType] = React.useState<OwnerType>('internal')
  const [viewMode, setViewMode] = React.useState<ViewMode>('grid')
  const [search, setSearch] = React.useState('')

  // Time period
  const [createNewTimePeriod, setCreateNewTimePeriod] = React.useState(false)
  const [selectedTimePeriodId, setSelectedTimePeriodId] = React.useState<
    UUID | ''
  >('')
  const [timePeriodStartAt, setTimePeriodStartAt] = React.useState<string>('')
  const [timePeriodEndAt, setTimePeriodEndAt] = React.useState<string>('')
  const [autoSetEndTime, setAutoSetEndTime] = React.useState(true)

  // External fields
  const [status, setStatus] = React.useState<ExternalReqStatus>('planned')
  const [note, setNote] = React.useState('')

  // Fetch job details
  const { data: job } = useQuery({
    ...jobDetailQuery({ jobId }),
    enabled: open,
  })

  // Fetch vehicles - we need to fetch both internal and external, then filter
  const { data: allVehicles = [] } = useQuery({
    ...vehiclesIndexQuery({
      companyId,
      includeExternal: true,
      search,
    }),
    enabled: open,
  })

  // Filter to active vehicles only and by owner type
  const vehicles = React.useMemo(() => {
    return allVehicles
      .filter((v) => !v.deleted)
      .filter((v) => v.internally_owned === (ownerType === 'internal'))
  }, [allVehicles, ownerType])

  const selectedVehicle = vehicles.find((v) => v.id === vehicleId)

  // Fetch existing transport time periods for the selected vehicle's owner
  const { data: existingTimePeriods = [] } = useQuery({
    queryKey: [
      'jobs',
      jobId,
      'transport-periods-by-owner',
      selectedVehicle?.external_owner_id || 'internal',
    ],
    enabled: open && !!selectedVehicle && !!jobId,
    queryFn: async () => {
      if (!selectedVehicle || !jobId) return []

      // Get all transport time periods for this job
      const { data: timePeriods, error: tpErr } = await supabase
        .from('time_periods')
        .select('id, title, start_at, end_at')
        .eq('job_id', jobId)
        .eq('category', 'transport')
        .eq('deleted', false)
        .order('start_at', { ascending: true })

      if (tpErr) throw tpErr
      if (timePeriods.length === 0) return []

      const timePeriodIds = timePeriods.map((tp) => tp.id)

      // Get vehicles on these time periods
      const { data: reservedVehicles, error: rvErr } = await supabase
        .from('reserved_vehicles')
        .select('time_period_id, vehicle:vehicle_id(id, external_owner_id)')
        .in('time_period_id', timePeriodIds)

      if (rvErr) throw rvErr

      const selectedOwnerId = selectedVehicle.external_owner_id || null

      // Filter to time periods that have vehicles from the same owner
      const matchingPeriods = timePeriods.filter((tp) => {
        const vehiclesOnPeriod = reservedVehicles.filter(
          (rv: any) => rv.time_period_id === tp.id,
        )

        if (vehiclesOnPeriod.length === 0) return false

        // Check if all vehicles have the same owner as selected vehicle
        const owners = new Set<string | null>()
        vehiclesOnPeriod.forEach((rv: any) => {
          const vehicle = Array.isArray(rv.vehicle) ? rv.vehicle[0] : rv.vehicle
          owners.add(vehicle?.external_owner_id || null)
        })

        // Must have only one owner type and it must match selected vehicle's owner
        return owners.size === 1 && owners.has(selectedOwnerId)
      })

      return matchingPeriods
    },
  })

  // Auto-select existing time period when vehicle is selected
  React.useEffect(() => {
    if (!selectedVehicle) {
      setSelectedTimePeriodId('')
      setCreateNewTimePeriod(true)
      return
    }

    // If no existing time periods, always create new
    if (existingTimePeriods.length === 0) {
      setSelectedTimePeriodId('')
      setCreateNewTimePeriod(true)
      return
    }

    // If time periods exist and we haven't explicitly chosen to create new, use existing
    if (existingTimePeriods.length > 0 && !createNewTimePeriod) {
      // Only auto-select if we don't have one selected yet or if the selected one is invalid
      if (
        !selectedTimePeriodId ||
        !existingTimePeriods.find((tp) => tp.id === selectedTimePeriodId)
      ) {
        setSelectedTimePeriodId(existingTimePeriods[0].id)
        setTimePeriodStartAt(existingTimePeriods[0].start_at)
        setTimePeriodEndAt(existingTimePeriods[0].end_at)
      }
    }
  }, [selectedVehicle, existingTimePeriods])

  // Set default dates from job when creating new time period
  React.useEffect(() => {
    if (createNewTimePeriod && job) {
      if (job.start_at) {
        setTimePeriodStartAt(job.start_at)
        setAutoSetEndTime(true)
      }
      if (job.end_at) {
        setTimePeriodEndAt(job.end_at)
        setAutoSetEndTime(false)
      }
    }
  }, [createNewTimePeriod, job])

  // Auto-set end time when start time changes (only when creating new time period)
  React.useEffect(() => {
    if (!timePeriodStartAt || !autoSetEndTime || !createNewTimePeriod) return
    setTimePeriodEndAt(addThreeHours(timePeriodStartAt))
  }, [timePeriodStartAt, autoSetEndTime, createNewTimePeriod])

  // Update dates when selected time period changes
  React.useEffect(() => {
    if (
      !createNewTimePeriod &&
      selectedTimePeriodId &&
      existingTimePeriods.length > 0
    ) {
      const selectedPeriod = existingTimePeriods.find(
        (tp) => tp.id === selectedTimePeriodId,
      )
      if (selectedPeriod) {
        setTimePeriodStartAt(selectedPeriod.start_at)
        setTimePeriodEndAt(selectedPeriod.end_at)
        setAutoSetEndTime(false) // Don't auto-set when using existing period
      }
    }
  }, [selectedTimePeriodId, createNewTimePeriod, existingTimePeriods])

  // Generate time period title
  const timePeriodTitle = React.useMemo(() => {
    if (!selectedVehicle) return ''
    if (
      !selectedVehicle.internally_owned &&
      selectedVehicle.external_owner_name
    ) {
      return `${selectedVehicle.external_owner_name} Transport period`
    }
    return `${selectedVehicle.name} Transport period`
  }, [selectedVehicle])

  // Reset when dialog closes
  React.useEffect(() => {
    if (!open) {
      setVehicleId('')
      setOwnerType('internal')
      setViewMode('grid')
      setSearch('')
      setCreateNewTimePeriod(false)
      setSelectedTimePeriodId('')
      setTimePeriodStartAt('')
      setTimePeriodEndAt('')
      setStatus('planned')
      setNote('')
    }
  }, [open])

  const save = useMutation({
    mutationFn: async () => {
      if (!vehicleId) throw new Error('Choose a vehicle')
      if (!job) throw new Error('Job not loaded')

      const selectedV = vehicles.find((v) => v.id === vehicleId)
      if (!selectedV) throw new Error('Vehicle not found')

      let timePeriodId: UUID

      if (createNewTimePeriod) {
        // Create new time period
        if (!timePeriodTitle) throw new Error('Time period title required')
        if (!timePeriodStartAt || !timePeriodEndAt)
          throw new Error('Time period dates required')

        const { data: newTp, error: createErr } = await supabase
          .from('time_periods')
          .insert({
            job_id: jobId,
            company_id: companyId,
            title: timePeriodTitle,
            start_at: timePeriodStartAt,
            end_at: timePeriodEndAt,
            category: 'transport',
          })
          .select('id')
          .single()
        if (createErr) throw createErr
        timePeriodId = newTp.id
      } else {
        // Use existing time period
        if (!selectedTimePeriodId) {
          throw new Error('Please select a time period or create a new one')
        }
        timePeriodId = selectedTimePeriodId
      }

      const payload: any = {
        time_period_id: timePeriodId,
        vehicle_id: vehicleId,
      }

      if (selectedV.external_owner_id) {
        payload.external_status = status
        if (note.trim()) {
          payload.external_note = note.trim()
        }
      }

      const { error } = await supabase.from('reserved_vehicles').insert(payload)
      if (error) throw error
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['jobs.transport', jobId] })
      await qc.invalidateQueries({ queryKey: ['jobs', jobId, 'time_periods'] })
      success('Success', 'Vehicle booked successfully')
      onOpenChange(false)
    },
    onError: (err: any) => {
      const msg = err?.message ?? 'Please try again.'
      const isOverlap =
        msg.includes('no_overlapping_vehicle_bookings') ||
        msg.includes('exclusion constraint') ||
        /conflicting key value violates exclusion/.test(msg)
      showError(
        'Failed to book vehicle',
        isOverlap
          ? 'This vehicle is already booked for this period (including personal bookings).'
          : msg,
      )
    },
  })

  const isExternal = selectedVehicle && !selectedVehicle.internally_owned

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content maxWidth="900px" style={{ maxHeight: '90vh' }}>
        <Dialog.Title>Book vehicle</Dialog.Title>

        <Flex direction="column" gap="4" mt="4" style={{ overflowY: 'auto' }}>
          {/* Vehicle Selection */}
          <Box>
            <Flex align="center" justify="between" mb="3" wrap="wrap" gap="3">
              <Text size="3" weight="medium">
                Select Vehicle
              </Text>
              <Flex align="center" gap="3" wrap="wrap">
                <SegmentedControl.Root
                  value={ownerType}
                  onValueChange={(v) => {
                    setOwnerType(v as OwnerType)
                    setVehicleId('')
                  }}
                >
                  <SegmentedControl.Item value="internal">
                    Internal
                  </SegmentedControl.Item>
                  <SegmentedControl.Item value="external">
                    External
                  </SegmentedControl.Item>
                </SegmentedControl.Root>

                <SegmentedControl.Root
                  value={viewMode}
                  onValueChange={(v) => setViewMode(v as ViewMode)}
                >
                  <SegmentedControl.Item value="grid">
                    Grid
                  </SegmentedControl.Item>
                  <SegmentedControl.Item value="list">
                    List
                  </SegmentedControl.Item>
                </SegmentedControl.Root>
              </Flex>
            </Flex>

            <TextField.Root
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search vehicles…"
              size="2"
              mb="3"
            />

            <Box style={{ maxHeight: '300px', overflowY: 'auto' }}>
              {viewMode === 'grid' ? (
                <VehicleGrid
                  vehicles={vehicles}
                  selectedId={vehicleId}
                  onSelect={setVehicleId}
                />
              ) : (
                <VehicleList
                  vehicles={vehicles}
                  selectedId={vehicleId}
                  onSelect={setVehicleId}
                />
              )}
            </Box>
          </Box>

          <Separator />

          {/* Time Period Selection */}
          {vehicleId && (
            <Box>
              <Text size="3" weight="medium" mb="3">
                Time Period
              </Text>

              {existingTimePeriods.length > 0 && !createNewTimePeriod ? (
                <>
                  <Text size="2" color="gray" mb="2">
                    Existing time period for this owner found. Use it or create
                    a new one.
                  </Text>
                  <Select.Root
                    value={selectedTimePeriodId}
                    onValueChange={setSelectedTimePeriodId}
                  >
                    <Select.Trigger placeholder="Select time period…" />
                    <Select.Content style={{ zIndex: 10000 }}>
                      {existingTimePeriods.map((tp) => (
                        <Select.Item key={tp.id} value={tp.id}>
                          {tp.title || 'Untitled'} (
                          {new Date(tp.start_at).toLocaleString()} -{' '}
                          {new Date(tp.end_at).toLocaleString()})
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select.Root>
                  <Button
                    variant="ghost"
                    size="2"
                    mt="2"
                    onClick={() => {
                      setCreateNewTimePeriod(true)
                      setSelectedTimePeriodId('')
                    }}
                  >
                    Create new time period
                  </Button>
                </>
              ) : (
                <>
                  <Box
                    p="2"
                    style={{
                      border: '1px solid var(--gray-a5)',
                      borderRadius: 8,
                      background: 'var(--gray-a2)',
                      marginBottom: '16px',
                    }}
                  >
                    <Text size="2" weight="medium">
                      {timePeriodTitle || '—'}
                    </Text>
                  </Box>

                  <Flex gap="3">
                    <Box style={{ flex: 1 }}>
                      <DateTimePicker
                        label="Start"
                        value={timePeriodStartAt}
                        onChange={(value) => {
                          setTimePeriodStartAt(value)
                          setAutoSetEndTime(true)
                        }}
                      />
                    </Box>
                    <Box style={{ flex: 1 }}>
                      <DateTimePicker
                        label="End"
                        value={timePeriodEndAt}
                        onChange={(value) => {
                          setTimePeriodEndAt(value)
                          setAutoSetEndTime(false)
                        }}
                      />
                    </Box>
                  </Flex>
                </>
              )}
            </Box>
          )}

          {/* External Fields */}
          {vehicleId && isExternal && (
            <>
              <Separator />
              <Box>
                <Text size="3" weight="medium" mb="3">
                  External Details
                </Text>
                <Box mb="3">
                  <Text size="2" weight="medium" mb="2" as="div">
                    Status
                  </Text>
                  <SegmentedControl.Root
                    size="2"
                    value={status}
                    onValueChange={(v) => setStatus(v as ExternalReqStatus)}
                  >
                    <SegmentedControl.Item value="planned">
                      Planned
                    </SegmentedControl.Item>
                    <SegmentedControl.Item value="requested">
                      Requested
                    </SegmentedControl.Item>
                    <SegmentedControl.Item value="confirmed">
                      Confirmed
                    </SegmentedControl.Item>
                  </SegmentedControl.Root>
                </Box>
                <Box>
                  <Text size="2" weight="medium" mb="2" as="div">
                    Note
                  </Text>
                  <TextField.Root
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Optional note…"
                  />
                </Box>
              </Box>
            </>
          )}

          {/* Actions */}
          <Flex justify="end" gap="2" mt="4">
            <Dialog.Close>
              <Button variant="soft">Cancel</Button>
            </Dialog.Close>
            <Button
              variant="solid"
              onClick={() => save.mutate()}
              disabled={
                save.isPending ||
                !vehicleId ||
                (!createNewTimePeriod && !selectedTimePeriodId) ||
                (createNewTimePeriod &&
                  (!timePeriodStartAt || !timePeriodEndAt))
              }
            >
              {save.isPending ? 'Saving…' : 'Book vehicle'}
            </Button>
          </Flex>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  )
}

// Vehicle Grid Component
function VehicleGrid({
  vehicles,
  selectedId,
  onSelect,
}: {
  vehicles: Array<{
    id: string
    name: string
    registration_no: string | null
    image_path: string | null
    fuel: 'electric' | 'diesel' | 'petrol' | null
    internally_owned: boolean
    external_owner_name: string | null
  }>
  selectedId: string
  onSelect: (id: string) => void
}) {
  if (!vehicles.length) {
    return (
      <Text color="gray" style={{ display: 'block', marginTop: 16 }}>
        No vehicles
      </Text>
    )
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
        gap: 12,
      }}
    >
      {vehicles.map((v) => (
        <VehicleCard
          key={v.id}
          v={v}
          active={v.id === selectedId}
          onClick={() => onSelect(v.id)}
        />
      ))}
    </div>
  )
}

function VehicleCard({
  v,
  active,
  onClick,
}: {
  v: {
    id: string
    name: string
    registration_no: string | null
    image_path: string | null
    fuel: 'electric' | 'diesel' | 'petrol' | null
    internally_owned: boolean
    external_owner_name: string | null
  }
  active: boolean
  onClick: () => void
}) {
  const imageUrl = React.useMemo(() => {
    if (!v.image_path) return null
    const { data } = supabase.storage
      .from('vehicle_images')
      .getPublicUrl(v.image_path)
    return data.publicUrl
  }, [v.image_path])

  const fuelColor: React.ComponentProps<typeof Badge>['color'] =
    v.fuel === 'electric' ? 'green' : v.fuel === 'diesel' ? 'orange' : 'blue'

  return (
    <Card
      size="2"
      variant="surface"
      onClick={onClick}
      style={{
        cursor: 'pointer',
        background: 'var(--gray-a2)',
        border: active
          ? '2px solid var(--accent-9)'
          : '1px solid var(--gray-5)',
      }}
    >
      <div
        style={{
          height: 120,
          borderRadius: 8,
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 8,
          background: 'var(--gray-a3)',
        }}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={v.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <Car style={{ width: '60px', height: '60px' }} />
        )}
      </div>

      <Flex direction="column" gap="1">
        <Text size="2" weight="medium">
          {v.name}
        </Text>
        <Text size="1" color="gray">
          {v.registration_no ?? '—'}
        </Text>
        <Flex align="center" gap="2" wrap="wrap" mt="1">
          {v.fuel && (
            <Badge variant="soft" color={fuelColor} size="1">
              {v.fuel}
            </Badge>
          )}
          {v.internally_owned ? (
            <Badge variant="soft" color="indigo" size="1">
              Internal
            </Badge>
          ) : (
            <Badge variant="soft" color="violet" size="1">
              {v.external_owner_name ?? 'External'}
            </Badge>
          )}
        </Flex>
      </Flex>
    </Card>
  )
}

// Vehicle List Component
function VehicleList({
  vehicles,
  selectedId,
  onSelect,
}: {
  vehicles: Array<{
    id: string
    name: string
    registration_no: string | null
    fuel: 'electric' | 'diesel' | 'petrol' | null
    internally_owned: boolean
    external_owner_name: string | null
  }>
  selectedId: string
  onSelect: (id: string) => void
}) {
  return (
    <Table.Root variant="surface">
      <Table.Header>
        <Table.Row>
          <Table.ColumnHeaderCell>Name</Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell>Reg</Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell>Fuel</Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell>Owner</Table.ColumnHeaderCell>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {vehicles.length === 0 ? (
          <Table.Row>
            <Table.Cell colSpan={4}>No vehicles</Table.Cell>
          </Table.Row>
        ) : (
          vehicles.map((v) => {
            const active = v.id === selectedId
            return (
              <Table.Row
                key={v.id}
                onClick={() => onSelect(v.id)}
                style={{
                  cursor: 'pointer',
                  background: active ? 'var(--accent-a3)' : undefined,
                }}
                data-state={active ? 'active' : undefined}
              >
                <Table.Cell>
                  <Text size="2" weight="medium">
                    {v.name}
                  </Text>
                </Table.Cell>
                <Table.Cell>{v.registration_no ?? '—'}</Table.Cell>
                <Table.Cell>
                  {v.fuel ? (
                    <Badge
                      variant="soft"
                      color={
                        v.fuel === 'electric'
                          ? 'green'
                          : v.fuel === 'diesel'
                            ? 'orange'
                            : 'blue'
                      }
                    >
                      {v.fuel}
                    </Badge>
                  ) : (
                    '—'
                  )}
                </Table.Cell>
                <Table.Cell>
                  {v.internally_owned ? (
                    <Badge variant="soft" color="indigo">
                      Internal
                    </Badge>
                  ) : (
                    <Badge variant="soft" color="violet">
                      {v.external_owner_name ?? 'External'}
                    </Badge>
                  )}
                </Table.Cell>
              </Table.Row>
            )
          })
        )}
      </Table.Body>
    </Table.Root>
  )
}
