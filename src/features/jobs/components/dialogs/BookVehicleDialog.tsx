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
import { z } from 'zod'
import { useStore } from '@tanstack/react-form'
import { useAppForm } from '@shared/form'
import { supabase } from '@shared/api/supabase'
import LazyImage from '@shared/ui/components/LazyImage'
import { useToast } from '@shared/ui/toast/ToastProvider'
import { useAuthz } from '@shared/auth/useAuthz'
import { DateTimeRangePicker } from '@shared/ui/components/pickers'
import { vehiclesIndexQuery } from '@features/vehicles/api/queries'
import {
  vehicleOwnerBadge,
  vehicleOwnerKey,
} from '@features/vehicles/lib/ownership'
import { jobDetailQuery } from '@features/jobs/api/queries'
import { ForceBookingDialog } from '@features/conflicts/components/ForceBookingDialog'
import {
  findVehicleOverlaps,
  getTimePeriodWindow,
} from '@features/conflicts/api/overlapChecks'
import {
  forcedBookingFields,
  isVehicleOverlapError,
} from '@features/conflicts/api/forceBooking'
import type { VehicleOwnerKind } from '@features/vehicles/lib/ownership'
import type { OverlapConflict } from '@features/conflicts/api/overlapChecks'
import type { ExternalReqStatus, UUID } from '../../types'
import type { Database } from '@shared/types/database.types'

type ReservedVehicleInsert =
  Database['public']['Tables']['reserved_vehicles']['Insert']

type ViewMode = 'grid' | 'list'
type OwnerType = VehicleOwnerKind

const defaultValues = {
  vehicleId: '' as UUID | '',
  ownerType: 'company' as OwnerType,
  viewMode: 'grid' as ViewMode,
  search: '',
  createNewTimePeriod: false,
  selectedTimePeriodId: '' as UUID | '',
  timePeriodStartAt: '',
  timePeriodEndAt: '',
  status: 'planned' as ExternalReqStatus,
  note: '',
}

const schema = z
  .object({
    vehicleId: z.string().min(1, 'Choose a vehicle'),
    ownerType: z.enum(['company', 'partner', 'person']),
    viewMode: z.enum(['grid', 'list']),
    search: z.string(),
    createNewTimePeriod: z.boolean(),
    selectedTimePeriodId: z.string(),
    timePeriodStartAt: z.string(),
    timePeriodEndAt: z.string(),
    status: z.enum(['planned', 'requested', 'confirmed']),
    note: z.string(),
  })
  .superRefine((data, ctx) => {
    if (data.createNewTimePeriod) {
      if (!data.timePeriodStartAt || !data.timePeriodEndAt) {
        ctx.addIssue({
          code: 'custom',
          message: 'Time period dates required',
          path: ['timePeriodStartAt'],
        })
      }
    } else if (!data.selectedTimePeriodId) {
      ctx.addIssue({
        code: 'custom',
        message: 'Please select a time period or create a new one',
        path: ['selectedTimePeriodId'],
      })
    }
  })

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
  const { userId: authUserId } = useAuthz()

  const [forceDialogOpen, setForceDialogOpen] = React.useState(false)
  const [forceConflicts, setForceConflicts] = React.useState<
    Array<OverlapConflict>
  >([])
  const [forceResourceLabel, setForceResourceLabel] = React.useState('')

  const form = useAppForm({
    defaultValues,
    validators: {
      onSubmit: schema,
    },
    onSubmit: async () => {
      await save.mutateAsync({})
    },
  })

  React.useEffect(() => {
    if (open) form.reset(defaultValues, { keepDefaultValues: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when dialog opens
  }, [open])

  // Subscribe so setFieldValue updates (e.g. createNewTimePeriod) re-render and
  // re-run the job-date seed effect. Reading form.state.values does not.
  const vehicleId = useStore(
    form.store,
    (s: { values: typeof defaultValues }) => s.values.vehicleId,
  )
  const ownerType = useStore(
    form.store,
    (s: { values: typeof defaultValues }) => s.values.ownerType,
  )
  const search = useStore(
    form.store,
    (s: { values: typeof defaultValues }) => s.values.search,
  )
  const createNewTimePeriod = useStore(
    form.store,
    (s: { values: typeof defaultValues }) => s.values.createNewTimePeriod,
  )
  const selectedTimePeriodId = useStore(
    form.store,
    (s: { values: typeof defaultValues }) => s.values.selectedTimePeriodId,
  )

  const { data: job } = useQuery({
    ...jobDetailQuery({ jobId }),
    enabled: open,
  })

  const { data: allVehicles = [] } = useQuery({
    ...vehiclesIndexQuery({
      companyId,
      includeExternal: true,
      search,
    }),
    enabled: open,
  })

  const vehicles = React.useMemo(() => {
    return allVehicles
      .filter((v) => !v.deleted)
      .filter((v) => {
        if (ownerType === 'company') return v.internally_owned
        if (ownerType === 'partner') {
          return !v.internally_owned && !v.owner_user_id
        }
        return !v.internally_owned && !!v.owner_user_id
      })
  }, [allVehicles, ownerType])

  const selectedVehicle = vehicles.find((v) => v.id === vehicleId)

  const { data: existingTimePeriods = [] } = useQuery({
    queryKey: [
      'jobs',
      jobId,
      'transport-periods-by-owner',
      selectedVehicle ? vehicleOwnerKey(selectedVehicle) : 'company',
    ],
    enabled: open && !!selectedVehicle && !!jobId,
    queryFn: async () => {
      if (!selectedVehicle || !jobId) return []

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

      const { data: reservedVehicles, error: rvErr } = await supabase
        .from('reserved_vehicles')
        .select(
          'time_period_id, vehicle:vehicle_id(id, internally_owned, external_owner_id, owner_user_id)',
        )
        .in('time_period_id', timePeriodIds)

      if (rvErr) throw rvErr

      const selectedOwnerKey = vehicleOwnerKey(selectedVehicle)

      return timePeriods.filter((tp) => {
        const vehiclesOnPeriod = reservedVehicles.filter(
          (rv: { time_period_id: string }) => rv.time_period_id === tp.id,
        )

        if (vehiclesOnPeriod.length === 0) return false

        const owners = new Set<string>()
        vehiclesOnPeriod.forEach((rv: { vehicle: unknown }) => {
          const vehicle = Array.isArray(rv.vehicle) ? rv.vehicle[0] : rv.vehicle
          if (vehicle) owners.add(vehicleOwnerKey(vehicle))
        })

        return owners.size === 1 && owners.has(selectedOwnerKey)
      })
    },
  })

  React.useEffect(() => {
    if (!selectedVehicle) {
      form.setFieldValue('selectedTimePeriodId', '')
      form.setFieldValue('createNewTimePeriod', true)
      return
    }

    if (existingTimePeriods.length === 0) {
      form.setFieldValue('selectedTimePeriodId', '')
      form.setFieldValue('createNewTimePeriod', true)
      return
    }

    const values = form.state.values
    if (existingTimePeriods.length > 0 && !values.createNewTimePeriod) {
      if (
        !values.selectedTimePeriodId ||
        !existingTimePeriods.find((tp) => tp.id === values.selectedTimePeriodId)
      ) {
        form.setFieldValue('selectedTimePeriodId', existingTimePeriods[0].id)
        form.setFieldValue('timePeriodStartAt', existingTimePeriods[0].start_at)
        form.setFieldValue('timePeriodEndAt', existingTimePeriods[0].end_at)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync time period selection
  }, [selectedVehicle, existingTimePeriods])

  React.useEffect(() => {
    if (!open || !createNewTimePeriod || !job) return
    if (job.start_at) form.setFieldValue('timePeriodStartAt', job.start_at)
    if (job.end_at) form.setFieldValue('timePeriodEndAt', job.end_at)
    // Seed when creating a new period or when job times become available.
    // Do not depend on the whole `job` object — refetches would clobber edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- default dates from job
  }, [open, createNewTimePeriod, job?.start_at, job?.end_at])

  React.useEffect(() => {
    if (createNewTimePeriod || !selectedTimePeriodId) return
    const selectedPeriod = existingTimePeriods.find(
      (tp) => tp.id === selectedTimePeriodId,
    )
    if (selectedPeriod) {
      form.setFieldValue('timePeriodStartAt', selectedPeriod.start_at)
      form.setFieldValue('timePeriodEndAt', selectedPeriod.end_at)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync dates from period
  }, [selectedTimePeriodId, createNewTimePeriod, existingTimePeriods])

  const timePeriodTitle = React.useMemo(() => {
    if (!selectedVehicle) return ''
    if (!selectedVehicle.internally_owned) {
      const ownerLabel =
        selectedVehicle.owner_user_name ??
        selectedVehicle.external_owner_name ??
        'External'
      return `${ownerLabel} Transport period`
    }
    return `${selectedVehicle.name} Transport period`
  }, [selectedVehicle])

  const save = useMutation({
    mutationFn: async ({ force = false }: { force?: boolean } = {}) => {
      const value = form.state.values
      if (!value.vehicleId) throw new Error('Choose a vehicle')
      if (!job) throw new Error('Job not loaded')

      const selectedV = vehicles.find((v) => v.id === value.vehicleId)
      if (!selectedV) throw new Error('Vehicle not found')

      let timePeriodId: UUID
      let windowStart = value.timePeriodStartAt
      let windowEnd = value.timePeriodEndAt

      if (value.createNewTimePeriod) {
        if (!timePeriodTitle) throw new Error('Time period title required')
        if (!value.timePeriodStartAt || !value.timePeriodEndAt) {
          throw new Error('Time period dates required')
        }

        const { data: newTp, error: createErr } = await supabase
          .from('time_periods')
          .insert({
            job_id: jobId,
            company_id: companyId,
            title: timePeriodTitle,
            start_at: value.timePeriodStartAt,
            end_at: value.timePeriodEndAt,
            category: 'transport',
          })
          .select('id')
          .single()
        if (createErr) throw createErr
        timePeriodId = newTp.id
      } else {
        if (!value.selectedTimePeriodId) {
          throw new Error('Please select a time period or create a new one')
        }
        timePeriodId = value.selectedTimePeriodId
        const window = await getTimePeriodWindow(timePeriodId)
        if (!window) throw new Error('Time period not found')
        windowStart = window.startAt
        windowEnd = window.endAt
      }

      if (!force && windowStart && windowEnd) {
        const overlaps = await findVehicleOverlaps({
          vehicleId: value.vehicleId,
          startAt: windowStart,
          endAt: windowEnd,
        })
        if (overlaps.length > 0) {
          setForceResourceLabel(selectedV.name)
          setForceConflicts(overlaps)
          setForceDialogOpen(true)
          throw new Error('OVERLAP_NEEDS_FORCE')
        }
      }

      const payload: ReservedVehicleInsert = {
        time_period_id: timePeriodId,
        vehicle_id: value.vehicleId,
      }

      if (force && authUserId) {
        Object.assign(payload, forcedBookingFields(authUserId))
      }

      if (!selectedV.internally_owned) {
        payload.external_status = value.status
        if (value.note.trim()) {
          payload.external_note = value.note.trim()
        }
      }

      const { error } = await supabase.from('reserved_vehicles').insert(payload)
      if (error) throw error
    },
    onSuccess: async () => {
      setForceDialogOpen(false)
      await qc.invalidateQueries({ queryKey: ['jobs.transport', jobId] })
      await qc.invalidateQueries({ queryKey: ['jobs', jobId, 'time_periods'] })
      await qc.invalidateQueries({ queryKey: ['conflicts'] })
      success('Success', 'Vehicle booked successfully')
      form.reset(defaultValues, { keepDefaultValues: true })
      onOpenChange(false)
    },
    onError: (err: Error) => {
      if (err.message === 'OVERLAP_NEEDS_FORCE') return
      const msg = err.message || 'Please try again.'
      const isOverlap = isVehicleOverlapError(msg)
      if (isOverlap && !forceDialogOpen) {
        setForceResourceLabel(selectedVehicle?.name ?? 'Vehicle')
        setForceConflicts([])
        setForceDialogOpen(true)
        return
      }
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
    <>
      <Dialog.Root open={open && !forceDialogOpen} onOpenChange={onOpenChange}>
        <Dialog.Content maxWidth="900px" style={{ maxHeight: '90vh' }}>
          <Dialog.Title>Book vehicle</Dialog.Title>
          <Dialog.Description size="2" color="gray" mb="2">
            Select a vehicle and reserve it for this job&apos;s transport
            period.
          </Dialog.Description>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              e.stopPropagation()
              void form.handleSubmit()
            }}
          >
            <form.AppForm>
              <Flex
                direction="column"
                gap="4"
                mt="4"
                style={{ overflowY: 'auto' }}
              >
                <Box>
                  <Flex
                    align="center"
                    justify="between"
                    mb="3"
                    wrap="wrap"
                    gap="3"
                  >
                    <Text size="3" weight="medium">
                      Select Vehicle
                    </Text>
                    <Flex align="center" gap="3" wrap="wrap">
                      <form.AppField name="ownerType">
                        {(field) => (
                          <SegmentedControl.Root
                            value={field.state.value}
                            onValueChange={(v) => {
                              field.handleChange(v as OwnerType)
                              form.setFieldValue('vehicleId', '')
                            }}
                          >
                            <SegmentedControl.Item value="company">
                              Company
                            </SegmentedControl.Item>
                            <SegmentedControl.Item value="partner">
                              Partner
                            </SegmentedControl.Item>
                            <SegmentedControl.Item value="person">
                              Personal
                            </SegmentedControl.Item>
                          </SegmentedControl.Root>
                        )}
                      </form.AppField>

                      <form.AppField name="viewMode">
                        {(field) => (
                          <SegmentedControl.Root
                            value={field.state.value}
                            onValueChange={(v) =>
                              field.handleChange(v as ViewMode)
                            }
                          >
                            <SegmentedControl.Item value="grid">
                              Grid
                            </SegmentedControl.Item>
                            <SegmentedControl.Item value="list">
                              List
                            </SegmentedControl.Item>
                          </SegmentedControl.Root>
                        )}
                      </form.AppField>
                    </Flex>
                  </Flex>

                  <form.AppField name="search">
                    {(field) => (
                      <TextField.Root
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        placeholder="Search vehicles…"
                        size="2"
                        mb="3"
                      />
                    )}
                  </form.AppField>

                  <Box style={{ maxHeight: '300px', overflowY: 'auto' }}>
                    <form.Subscribe
                      selector={(state) => [
                        state.values.viewMode,
                        state.values.vehicleId,
                      ]}
                    >
                      {([viewMode, selectedId]) =>
                        viewMode === 'grid' ? (
                          <VehicleGrid
                            vehicles={vehicles}
                            selectedId={selectedId}
                            onSelect={(id) =>
                              form.setFieldValue('vehicleId', id)
                            }
                          />
                        ) : (
                          <VehicleList
                            vehicles={vehicles}
                            selectedId={selectedId}
                            onSelect={(id) =>
                              form.setFieldValue('vehicleId', id)
                            }
                          />
                        )
                      }
                    </form.Subscribe>
                  </Box>
                </Box>

                <Separator />

                {vehicleId && (
                  <Box>
                    <Text size="3" weight="medium" mb="3">
                      Time Period
                    </Text>

                    {existingTimePeriods.length > 0 && !createNewTimePeriod ? (
                      <>
                        <Text size="2" color="gray" mb="2">
                          Existing time period for this owner found. Use it or
                          create a new one.
                        </Text>
                        <form.AppField name="selectedTimePeriodId">
                          {(field) => (
                            <Select.Root
                              value={field.state.value}
                              onValueChange={field.handleChange}
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
                          )}
                        </form.AppField>
                        <Button
                          type="button"
                          variant="ghost"
                          size="2"
                          mt="2"
                          onClick={() => {
                            form.setFieldValue('createNewTimePeriod', true)
                            form.setFieldValue('selectedTimePeriodId', '')
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

                        <form.Subscribe
                          selector={(state) => [
                            state.values.timePeriodStartAt,
                            state.values.timePeriodEndAt,
                          ]}
                        >
                          {([startAt, endAt]) => (
                            <DateTimeRangePicker
                              startAt={startAt}
                              endAt={endAt}
                              onChange={({ startAt: s, endAt: e }) => {
                                form.setFieldValue('timePeriodStartAt', s)
                                form.setFieldValue('timePeriodEndAt', e)
                              }}
                            />
                          )}
                        </form.Subscribe>
                      </>
                    )}
                  </Box>
                )}

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
                        <form.AppField name="status">
                          {(field) => (
                            <SegmentedControl.Root
                              size="2"
                              value={field.state.value}
                              onValueChange={(v) =>
                                field.handleChange(v as ExternalReqStatus)
                              }
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
                          )}
                        </form.AppField>
                      </Box>
                      <form.AppField name="note">
                        {(field) => (
                          <field.TextField
                            label="Note"
                            placeholder="Optional note…"
                          />
                        )}
                      </form.AppField>
                    </Box>
                  </>
                )}

                <Flex justify="end" gap="2" mt="4">
                  <Dialog.Close>
                    <Button type="button" variant="soft">
                      Cancel
                    </Button>
                  </Dialog.Close>
                  <form.SubmitButton
                    label="Book vehicle"
                    pendingLabel="Saving…"
                  />
                </Flex>
              </Flex>
            </form.AppForm>
          </form>
        </Dialog.Content>
      </Dialog.Root>

      <ForceBookingDialog
        open={forceDialogOpen}
        onOpenChange={setForceDialogOpen}
        resourceLabel={forceResourceLabel}
        conflicts={forceConflicts}
        loading={save.isPending}
        onConfirm={() => save.mutate({ force: true })}
      />
    </>
  )
}

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
  const ownerBadge = vehicleOwnerBadge(v)

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
          <LazyImage
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
          <Badge variant="soft" color={ownerBadge.color} size="1">
            {ownerBadge.label}
          </Badge>
        </Flex>
      </Flex>
    </Card>
  )
}

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
            const ownerBadge = vehicleOwnerBadge(v)
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
                  <Badge variant="soft" color={ownerBadge.color}>
                    {ownerBadge.label}
                  </Badge>
                </Table.Cell>
              </Table.Row>
            )
          })
        )}
      </Table.Body>
    </Table.Root>
  )
}
