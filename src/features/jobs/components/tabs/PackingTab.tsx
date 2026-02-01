import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  AlertDialog,
  Badge,
  Box,
  Button,
  Card,
  Checkbox,
  Flex,
  Heading,
  IconButton,
  Separator,
  Table,
  Text,
} from '@radix-ui/themes'
import { NavArrowDown, NavArrowRight } from 'iconoir-react'
import { supabase } from '@shared/api/supabase'
import { useAuthz } from '@shared/auth/useAuthz'

type UUID = string

type TransportBooking = {
  id: UUID
  time_period_id: UUID
  status: 'planned' | 'confirmed' | 'canceled'
  vehicle_id: UUID
  vehicle: {
    id: UUID
    name: string
    registration_no: string | null
    deleted?: boolean | null
  } | null
  time_period: {
    id: UUID
    title: string | null
    start_at: string
    end_at: string
  } | null
}

type EquipmentBooking = {
  id: UUID
  time_period_id: UUID
  status: 'planned' | 'confirmed' | 'canceled'
  item_id: UUID
  quantity: number
  source_group_id: UUID | null
  source_kind: 'direct' | 'group'
  start_at: string | null
  end_at: string | null
  item:
    | { id: UUID; name: string; category?: { name: string } | null }
    | Array<{ id: UUID; name: string; category?: { name: string } | null }>
  source_group?:
    | { id: UUID; name: string; category?: { name: string } | null }
    | Array<{ id: UUID; name: string; category?: { name: string } | null }>
    | null
  time_period: {
    id: UUID
    title: string | null
    start_at: string
    end_at: string
    category?: string | null
  } | null
}

type PackingItemLine = {
  id: UUID
  name: string
  quantity: number
  categoryName: string
}

type PackingGroup = {
  id: UUID
  name: string
  categoryName: string
  items: Array<PackingItemLine>
}

type PackingSlip = {
  items: Array<PackingItemLine>
  groups: Array<PackingGroup>
}

type ConfirmedPackingV2 = {
  confirmedAt: string
  vehicleBookingId: UUID
  vehicleDisplay: string
  slip: PackingSlip
}

function normalizeMaybeArray<T>(value: T | Array<T> | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

function overlapMs(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  const a0 = new Date(aStart).getTime()
  const a1 = new Date(aEnd).getTime()
  const b0 = new Date(bStart).getTime()
  const b1 = new Date(bEnd).getTime()
  const start = Math.max(a0, b0)
  const end = Math.min(a1, b1)
  return Math.max(0, end - start)
}

function storageKey(jobId: string, vehicleBookingId: string) {
  return `packing:v3:${jobId}:${vehicleBookingId}`
}

function canUseLocalStorage() {
  return typeof window !== 'undefined' && !!window.localStorage
}

export default function PackingTab({ jobId }: { jobId: string }) {
  const { companyRole } = useAuthz()
  const canLoad = companyRole !== 'freelancer'
  const { data, isLoading, error } = useQuery({
    queryKey: ['jobs.packing', jobId],
    queryFn: async (): Promise<{
      equipment: Array<EquipmentBooking>
      transport: Array<TransportBooking>
    }> => {
      const { data: allTPs, error: tpErr } = await supabase
        .from('time_periods')
        .select('id')
        .eq('job_id', jobId)
      if (tpErr) throw tpErr
      const allTpIds = (allTPs || []).map((tp: any) => tp.id as string)

      const { data: transportTPs, error: transportTpErr } = await supabase
        .from('time_periods')
        .select('id')
        .eq('job_id', jobId)
        .eq('category', 'transport')
        .eq('deleted', false)
      if (transportTpErr) throw transportTpErr
      const transportTpIds = (transportTPs || []).map((tp: any) => tp.id as string)

      const equipment: Array<EquipmentBooking> = []
      if (allTpIds.length) {
        const { data: rows, error: eqErr } = await supabase
          .from('reserved_items')
          .select(
            `
            id, time_period_id, status, item_id, quantity, start_at, end_at,
            source_group_id, source_kind,
            item:item_id ( id, name, category:category_id ( name ) ),
            source_group:source_group_id ( id, name, category:category_id ( name ) ),
            time_period:time_period_id ( id, title, start_at, end_at, category )
          `,
          )
          .in('time_period_id', allTpIds)
          .neq('status', 'canceled')
        if (eqErr) throw eqErr
        equipment.push(...((rows || []) as unknown as Array<EquipmentBooking>))
      }

      const transport: Array<TransportBooking> = []
      if (transportTpIds.length) {
        const { data: rows, error: trErr } = await supabase
          .from('reserved_vehicles')
          .select(
            `
            id, time_period_id, status, vehicle_id,
            vehicle:vehicle_id ( id, name, registration_no, deleted ),
            time_period:time_period_id ( id, title, start_at, end_at )
          `,
          )
          .in('time_period_id', transportTpIds)
          .neq('status', 'canceled')
        if (trErr) throw trErr
        const filtered = (rows || []).filter((row: any) => {
          const vehicle = normalizeMaybeArray<any>(row.vehicle)
          return !vehicle?.deleted
        })
        transport.push(...(filtered as unknown as Array<TransportBooking>))
      }

      return { equipment, transport }
    },
    staleTime: 10_000,
  })

  const equipment = data?.equipment ?? []
  const transport = data?.transport ?? []

  const transportCards = React.useMemo(() => {
    return transport
      .map((b) => {
        const vehicle = normalizeMaybeArray(b.vehicle)
        const tp = normalizeMaybeArray(b.time_period)
        if (!vehicle || !tp) return null
        const vehicleDisplay = vehicle.registration_no
          ? `${vehicle.name} (${vehicle.registration_no})`
          : vehicle.name
        return {
          vehicleBookingId: b.id,
          vehicleDisplay,
          vehicleName: vehicle.name,
          registrationNo: vehicle.registration_no,
          startAt: tp.start_at,
          endAt: tp.end_at,
          title: tp.title,
        }
      })
      .filter(Boolean) as Array<{
      vehicleBookingId: string
      vehicleDisplay: string
      vehicleName: string
      registrationNo: string | null
      startAt: string
      endAt: string
      title: string | null
    }>
  }, [transport])

  const slips = React.useMemo(() => {
    const vehicles = transportCards.map((v) => ({
      id: v.vehicleBookingId,
      startAt: v.startAt,
      endAt: v.endAt,
    }))

    const emptySlip = (): {
      items: Map<string, PackingItemLine>
      groups: Map<
        string,
        {
          id: string
          name: string
          categoryName: string
          items: Map<string, PackingItemLine>
        }
      >
    } => ({
      items: new Map(),
      groups: new Map(),
    })

    const byVehicle = new Map<string, ReturnType<typeof emptySlip>>()
    vehicles.forEach((v) => byVehicle.set(v.id, emptySlip()))
    const unassigned = emptySlip()
    const noVehicleSlip = emptySlip()

    const addToSlip = (
      slip: ReturnType<typeof emptySlip>,
      row: EquipmentBooking,
      itemName: string,
      groupName: string | null,
      itemCategoryName: string | null,
      groupCategoryName: string | null,
    ) => {
      const fallbackCategory = itemCategoryName ?? groupCategoryName ?? 'Uncategorized'
      if (row.source_group_id) {
        const gid = row.source_group_id
        const gName = groupName ?? 'Group'
        if (!slip.groups.has(gid)) {
          slip.groups.set(gid, {
            id: gid,
            name: gName,
            categoryName: groupCategoryName ?? itemCategoryName ?? 'Uncategorized',
            items: new Map(),
          })
        }
        const g = slip.groups.get(gid)!
        const existing = g.items.get(row.item_id)
        if (existing) existing.quantity += row.quantity
        else
          g.items.set(row.item_id, {
            id: row.item_id,
            name: itemName,
            quantity: row.quantity,
            categoryName: itemCategoryName ?? g.categoryName,
          })
      } else {
        const existing = slip.items.get(row.item_id)
        if (existing) existing.quantity += row.quantity
        else
          slip.items.set(row.item_id, {
            id: row.item_id,
            name: itemName,
            quantity: row.quantity,
            categoryName: fallbackCategory,
          })
      }
    }

    for (const row of equipment) {
      const item = normalizeMaybeArray<any>(row.item)
      const tp = normalizeMaybeArray<any>(row.time_period)
      const group = normalizeMaybeArray<any>(row.source_group)

      const itemName = item?.name ?? 'Unknown item'
      const groupName = group?.name ?? null
      const itemCategoryName =
        (item?.category && Array.isArray(item.category) ? item.category[0]?.name : item?.category?.name) ??
        null
      const groupCategoryName =
        (group?.category && Array.isArray(group.category) ? group.category[0]?.name : group?.category?.name) ??
        null

      // Aggregate into "no vehicle" slip too (used when no transport exists)
      addToSlip(noVehicleSlip, row, itemName, groupName, itemCategoryName, groupCategoryName)

      // Assign to best vehicle based on overlap
      const startAt = row.start_at ?? tp?.start_at
      const endAt = row.end_at ?? tp?.end_at
      if (!startAt || !endAt || vehicles.length === 0) continue

      let bestVehicle: { bookingId: string; overlap: number } | null = null
      for (const v of vehicles) {
        const o = overlapMs(startAt, endAt, v.startAt, v.endAt)
        if (o <= 0) continue
        if (!bestVehicle || o > bestVehicle.overlap) {
          bestVehicle = { bookingId: v.id, overlap: o }
        }
      }

      const dest = bestVehicle ? byVehicle.get(bestVehicle.bookingId)! : unassigned
      addToSlip(dest, row, itemName, groupName, itemCategoryName, groupCategoryName)
    }

    const finalize = (slip: ReturnType<typeof emptySlip>): PackingSlip => {
      const groups: Array<PackingGroup> = [...slip.groups.values()]
        .map((g) => ({
          id: g.id,
          name: g.name,
          categoryName: g.categoryName,
          items: [...g.items.values()],
        }))
        .sort((a, b) => a.name.localeCompare(b.name))

      const items = [...slip.items.values()]
      return { items, groups }
    }

    const byVehicleFinal: Record<string, PackingSlip> = {}
    for (const [vehicleBookingId, slip] of byVehicle.entries()) {
      byVehicleFinal[vehicleBookingId] = finalize(slip)
    }

    return {
      byVehicle: byVehicleFinal,
      unassigned: finalize(unassigned),
      noVehicle: finalize(noVehicleSlip),
    }
  }, [equipment, transportCards])

  if (isLoading) {
    return (
      <Box>
        <Text>Loading packing slip…</Text>
      </Box>
    )
  }

  if (error) {
    return (
      <Box>
        <Text color="red">Failed to load packing slip.</Text>
      </Box>
    )
  }

  return (
    <Box>
      <Heading size="3" mb="2">
        Packing
      </Heading>

      {transportCards.length === 0 && (
        <Card>
          <Flex direction="column" gap="2">
            <Text>
              No transport is booked yet. Book a vehicle in the Transport tab to
              get a vehicle-specific packing slip.
            </Text>
            <Separator size="4" />
            <Heading size="2">Tentative packing list</Heading>
            {slips.noVehicle.items.length === 0 && slips.noVehicle.groups.length === 0 ? (
              <Text color="gray">No equipment booked.</Text>
            ) : (
              <PackingSlipChecklist
                slip={slips.noVehicle}
                interactive={false}
                checkedByKey={{}}
                expandedGroups={new Set()}
                onToggleExpand={() => {}}
                onToggleLine={() => {}}
                onToggleGroup={() => {}}
              />
            )}
          </Flex>
        </Card>
      )}

      {transportCards.length > 0 && (
        <Flex direction="column" gap="3">
          {transportCards.map((v) => (
            <VehiclePackingCard
              key={v.vehicleBookingId}
              jobId={jobId}
              vehicleBookingId={v.vehicleBookingId}
              vehicleDisplay={v.vehicleDisplay}
              slip={slips.byVehicle[v.vehicleBookingId] ?? { items: [], groups: [] }}
              canLoad={canLoad}
            />
          ))}

          {(slips.unassigned.items.length > 0 || slips.unassigned.groups.length > 0) && (
            <Card>
              <Flex direction="column" gap="2">
                <Flex align="center" gap="2" wrap="wrap">
                  <Badge color="orange">Unassigned</Badge>
                  <Text>
                    Some equipment doesn’t overlap any transport period, so it
                    isn’t assigned to a vehicle yet.
                  </Text>
                </Flex>
                <PackingSlipChecklist
                  slip={slips.unassigned}
                  interactive={false}
                  checkedByKey={{}}
                  expandedGroups={new Set()}
                  onToggleExpand={() => {}}
                  onToggleLine={() => {}}
                  onToggleGroup={() => {}}
                />
              </Flex>
            </Card>
          )}
        </Flex>
      )}
    </Box>
  )
}

function lineKeyForItem(itemId: string) {
  return `item:${itemId}`
}

function lineKeyForGroupItem(groupId: string, itemId: string) {
  return `group:${groupId}:item:${itemId}`
}

function collectAllLineKeys(slip: PackingSlip) {
  const keys: Array<string> = []
  for (const item of slip.items) keys.push(lineKeyForItem(item.id))
  for (const group of slip.groups) {
    for (const item of group.items) keys.push(lineKeyForGroupItem(group.id, item.id))
  }
  return keys
}

function collectAllLineSignatures(slip: PackingSlip) {
  const sigs: Array<string> = []
  for (const item of slip.items) sigs.push(`${lineKeyForItem(item.id)}=${item.quantity}`)
  for (const group of slip.groups) {
    for (const item of group.items) {
      sigs.push(`${lineKeyForGroupItem(group.id, item.id)}=${item.quantity}`)
    }
  }
  sigs.sort()
  return sigs.join('|')
}

function VehiclePackingCard({
  jobId,
  vehicleBookingId,
  vehicleDisplay,
  slip,
  canLoad,
}: {
  jobId: string
  vehicleBookingId: string
  vehicleDisplay: string
  slip: PackingSlip
  canLoad: boolean
}) {
  const [mode, setMode] = React.useState<'tentative' | 'loading' | 'review' | 'confirmed'>(
    'tentative',
  )
  const [expandedGroups, setExpandedGroups] = React.useState<Set<string>>(new Set())
  const [checkedByKey, setCheckedByKey] = React.useState<Record<string, boolean>>({})
  const [confirmed, setConfirmed] = React.useState<
    (ConfirmedPackingV2 & { packedKeys?: Array<string>; allLoaded?: boolean }) | null
  >(null)
  const [incompleteFinishOpen, setIncompleteFinishOpen] = React.useState(false)

  const slipSignature = React.useMemo(() => collectAllLineSignatures(slip), [slip])
  const prevSlipSignatureRef = React.useRef<string | null>(null)

  React.useEffect(() => {
    // Reset transient UI when slip changes (bookings changed)
    const prev = prevSlipSignatureRef.current
    prevSlipSignatureRef.current = slipSignature
    if (!prev) return
    if (prev !== slipSignature && (mode === 'loading' || mode === 'review')) {
      setMode('tentative')
      setCheckedByKey({})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slipSignature])

  React.useEffect(() => {
    const raw = canUseLocalStorage() ? localStorage.getItem(storageKey(jobId, vehicleBookingId)) : null
    if (!raw) {
      setConfirmed(null)
      if (mode === 'confirmed') setMode('tentative')
      return
    }
    try {
      const parsed = JSON.parse(raw) as ConfirmedPackingV2 & {
        packedKeys?: Array<string>
        allLoaded?: boolean
      }
      if (parsed?.vehicleBookingId !== vehicleBookingId) {
        setConfirmed(null)
        return
      }
      setConfirmed(parsed)
      setMode('confirmed')
    } catch {
      if (canUseLocalStorage()) {
        localStorage.removeItem(storageKey(jobId, vehicleBookingId))
      }
      setConfirmed(null)
      if (mode === 'confirmed') setMode('tentative')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, vehicleBookingId])

  const allLineKeys = React.useMemo(() => collectAllLineKeys(slip), [slip])
  const hasAnything = allLineKeys.length > 0

  const allChecked =
    hasAnything && allLineKeys.every((k) => checkedByKey[k] === true)

  const remainingCount = hasAnything
    ? allLineKeys.filter((k) => checkedByKey[k] !== true).length
    : 0

  const packedKeys = React.useMemo(() => {
    return allLineKeys.filter((k) => checkedByKey[k] === true)
  }, [allLineKeys, checkedByKey])

  const startLoading = () => {
    const initial: Record<string, boolean> = {}
    for (const k of allLineKeys) initial[k] = false
    setCheckedByKey(initial)
    setMode('loading')
  }

  const finishLoading = () => {
    if (allChecked) {
      setMode('review')
      return
    }
    setIncompleteFinishOpen(true)
  }

  const confirmLoading = () => {
    const payload: ConfirmedPackingV2 = {
      confirmedAt: new Date().toISOString(),
      vehicleBookingId,
      vehicleDisplay,
      slip,
    }
    if (canUseLocalStorage()) {
      localStorage.setItem(
        storageKey(jobId, vehicleBookingId),
        JSON.stringify({
          ...payload,
          packedKeys,
          allLoaded: packedKeys.length === allLineKeys.length && hasAnything,
        }),
      )
    }
    setConfirmed({
      ...payload,
      packedKeys,
      allLoaded: packedKeys.length === allLineKeys.length && hasAnything,
    })
    setMode('confirmed')
  }

  const restart = () => {
    if (canUseLocalStorage()) {
      localStorage.removeItem(storageKey(jobId, vehicleBookingId))
    }
    setConfirmed(null)
    setCheckedByKey({})
    setMode('tentative')
  }

  const bookingsChangedSinceConfirm = React.useMemo(() => {
    if (!confirmed) return false
    return collectAllLineSignatures(confirmed.slip) !== collectAllLineSignatures(slip)
  }, [confirmed, slip])

  const showGreenBorder =
    (mode === 'loading' && allChecked) ||
    (mode === 'review' && allChecked) ||
    (mode === 'confirmed' && confirmed?.allLoaded === true)

  return (
    <Card
      style={
        showGreenBorder
          ? { border: '2px solid var(--green-9)' }
          : undefined
      }
    >
      <Flex direction="column" gap="3">
        <Flex align="center" justify="between" gap="3" wrap="wrap">
          <Flex direction="column" gap="1">
            <Heading size="2">{vehicleDisplay}</Heading>
            <Text size="2" color="gray">
              Packing slip
            </Text>
          </Flex>

          {mode === 'tentative' && (
            <Button onClick={startLoading} disabled={!hasAnything || !canLoad}>
              Start loading
            </Button>
          )}
        </Flex>

        {!canLoad && (
          <Text size="2" color="gray">
            Loading is disabled for freelancers. You can still view the packing slip.
          </Text>
        )}

        {mode === 'confirmed' && (
          <Flex direction="column" gap="2">
            <Flex align="center" gap="2" wrap="wrap">
              <Badge color={confirmed?.allLoaded ? 'green' : 'orange'}>
                {confirmed?.allLoaded ? 'Loaded' : 'Partially loaded'}
              </Badge>
              <Text>
                {confirmed?.allLoaded
                  ? (
                      <>
                        Everything is loaded in <strong>{vehicleDisplay}</strong>.
                      </>
                    )
                  : (
                      <>
                        Loading confirmed for <strong>{vehicleDisplay}</strong>.
                      </>
                    )}
              </Text>
              {bookingsChangedSinceConfirm && <Badge color="orange">Bookings changed</Badge>}
            </Flex>
            {confirmed?.slip ? (
              <PackingSlipChecklist
                slip={confirmed.slip}
                mode="view"
                checkedByKey={{}}
                expandedGroups={expandedGroups}
                onToggleExpand={(groupId) => {
                  setExpandedGroups((prev) => {
                    const next = new Set(prev)
                    if (next.has(groupId)) next.delete(groupId)
                    else next.add(groupId)
                    return next
                  })
                }}
                onToggleLine={() => {}}
                onToggleGroup={() => {}}
                filterKeys={
                  new Set((confirmed.packedKeys ?? []).filter(Boolean))
                }
              />
            ) : (
              <Text color="gray">No items were confirmed.</Text>
            )}
            <Flex justify="end">
              <Button variant="soft" onClick={restart}>
                Start new loading
              </Button>
            </Flex>
          </Flex>
        )}

        {mode !== 'confirmed' && (
          <Flex direction="column" gap="3">
            {!hasAnything ? (
              <Text color="gray">No booked equipment overlaps this transport period.</Text>
            ) : (
              <>
                {mode === 'loading' && (
                  <Text color="gray" size="2">
                    Load mode: check off each line as it’s loaded.
                  </Text>
                )}
                {mode === 'review' && (
                  <Box
                    p="3"
                    style={{
                      border: '1px solid var(--blue-9)',
                      background: 'var(--blue-a2)',
                      borderRadius: 12,
                    }}
                  >
                    <Flex direction="column" gap="2">
                      <Flex align="center" justify="between" gap="2" wrap="wrap">
                        <Flex align="center" gap="2" wrap="wrap">
                          <Badge color="blue">Review mode</Badge>
                          <Text weight="medium">Ready to confirm loading</Text>
                        </Flex>
                        <Badge color={packedKeys.length === allLineKeys.length ? 'green' : 'orange'}>
                          {packedKeys.length}/{allLineKeys.length} lines loaded
                        </Badge>
                      </Flex>
                      <Text size="2" color="gray">
                        Only the checked lines below will be marked as loaded in{' '}
                        <strong>{vehicleDisplay}</strong>.
                      </Text>
                    </Flex>
                  </Box>
                )}

                <PackingSlipChecklist
                  slip={slip}
                  mode={
                    !canLoad
                      ? 'view'
                      : mode === 'loading'
                        ? 'loading'
                        : mode === 'review'
                          ? 'review'
                          : 'view'
                  }
                  checkedByKey={checkedByKey}
                  expandedGroups={expandedGroups}
                  onToggleExpand={(groupId) => {
                    setExpandedGroups((prev) => {
                      const next = new Set(prev)
                      if (next.has(groupId)) next.delete(groupId)
                      else next.add(groupId)
                      return next
                    })
                  }}
                  onToggleLine={(key) => {
                    if (!canLoad) return
                    if (mode !== 'loading') return
                    setCheckedByKey((prev) => ({ ...prev, [key]: !prev[key] }))
                  }}
                  onToggleGroup={(groupId) => {
                    if (!canLoad) return
                    if (mode !== 'loading') return
                    const group = slip.groups.find((g) => g.id === groupId)
                    if (!group) return
                    const keys = group.items.map((it) => lineKeyForGroupItem(groupId, it.id))
                    const shouldCheck = !keys.every((k) => checkedByKey[k] === true)
                    setCheckedByKey((prev) => {
                      const next = { ...prev }
                      for (const k of keys) next[k] = shouldCheck
                      return next
                    })
                  }}
                />

                {canLoad && <Flex justify="end" gap="2" wrap="wrap">
                  {mode === 'loading' && (
                    <>
                      <Button variant="soft" onClick={() => setMode('tentative')}>
                        Cancel
                      </Button>
                      <Button onClick={finishLoading}>
                        Finish loading
                      </Button>
                      <AlertDialog.Root
                        open={incompleteFinishOpen}
                        onOpenChange={setIncompleteFinishOpen}
                      >
                        <AlertDialog.Content maxWidth="520px">
                          <AlertDialog.Title>Not everything is checked</AlertDialog.Title>
                          <AlertDialog.Description>
                            {remainingCount === 1
                              ? '1 line is still unchecked.'
                              : `${remainingCount} lines are still unchecked.`}{' '}
                            Do you want to finish loading anyway?
                          </AlertDialog.Description>
                          <Flex gap="3" mt="4" justify="end">
                            <AlertDialog.Cancel>
                              <Button variant="soft">Go back</Button>
                            </AlertDialog.Cancel>
                            <AlertDialog.Action>
                              <Button
                                onClick={() => {
                                  setIncompleteFinishOpen(false)
                                  setMode('review')
                                }}
                              >
                                Finish anyway
                              </Button>
                            </AlertDialog.Action>
                          </Flex>
                        </AlertDialog.Content>
                      </AlertDialog.Root>
                    </>
                  )}
                  {mode === 'review' && (
                    <>
                      <Button variant="soft" onClick={() => setMode('loading')}>
                        Back
                      </Button>
                      <Button onClick={confirmLoading}>Confirm loading</Button>
                    </>
                  )}
                </Flex>}
              </>
            )}
          </Flex>
        )}
      </Flex>
    </Card>
  )
}

function PackingSlipChecklist({
  slip,
  mode,
  checkedByKey,
  expandedGroups,
  onToggleExpand,
  onToggleLine,
  onToggleGroup,
  filterKeys,
}: {
  slip: PackingSlip
  mode: 'loading' | 'review' | 'view'
  checkedByKey: Record<string, boolean>
  expandedGroups: Set<string>
  onToggleExpand: (groupId: string) => void
  onToggleLine: (key: string) => void
  onToggleGroup: (groupId: string) => void
  filterKeys?: Set<string>
}) {
  const interactive = mode === 'loading'
  const showCheckboxes = mode === 'loading' || mode === 'review'
  const isReview = mode === 'review'

  type Entry =
    | {
        kind: 'item'
        categoryName: string
        key: string
        name: string
        quantity: number
      }
    | {
        kind: 'group'
        categoryName: string
        groupId: string
        name: string
        quantity: number
        childKeys: Array<string>
        children: Array<PackingItemLine>
      }

  const entries = React.useMemo(() => {
    const out: Array<Entry> = []

    for (const g of slip.groups) {
      const childKeys = g.items.map((it) => lineKeyForGroupItem(g.id, it.id))
      const visibleChildren = filterKeys
        ? g.items.filter((it) => filterKeys.has(lineKeyForGroupItem(g.id, it.id)))
        : g.items
      const visibleChildKeys = filterKeys
        ? childKeys.filter((k) => filterKeys.has(k))
        : childKeys
      if (filterKeys && visibleChildren.length === 0) continue

      const qty = visibleChildren.reduce((sum, it) => sum + it.quantity, 0)
      out.push({
        kind: 'group',
        categoryName: g.categoryName ?? 'Uncategorized',
        groupId: g.id,
        name: g.name,
        quantity: qty,
        childKeys: visibleChildKeys,
        children: [...visibleChildren].sort((a, b) => {
          const ac = a.categoryName ?? 'Uncategorized'
          const bc = b.categoryName ?? 'Uncategorized'
          if (ac !== bc) return ac.localeCompare(bc)
          return a.name.localeCompare(b.name)
        }),
      })
    }

    for (const it of slip.items) {
      const key = lineKeyForItem(it.id)
      if (filterKeys && !filterKeys.has(key)) continue
      out.push({
        kind: 'item',
        categoryName: it.categoryName ?? 'Uncategorized',
        key,
        name: it.name,
        quantity: it.quantity,
      })
    }

    out.sort((a, b) => {
      if (a.categoryName !== b.categoryName) return a.categoryName.localeCompare(b.categoryName)
      return a.name.localeCompare(b.name)
    })

    return out
  }, [slip])

  const hasAnything = entries.length > 0

  return (
    <Flex direction="column" gap="3">
      {!hasAnything ? (
        <Text color="gray">No equipment.</Text>
      ) : (
        <Table.Root variant="surface" size="3">
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeaderCell width="52px" />
              <Table.ColumnHeaderCell>Item</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell width="90px" justify="end">
                Qty
              </Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell width="52px" />
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {(() => {
              let lastCategory: string | null = null
              const rows: Array<React.ReactNode> = []

              for (const entry of entries) {
                if (entry.categoryName !== lastCategory) {
                  lastCategory = entry.categoryName
                  rows.push(
                    <Table.Row key={`cat:${lastCategory}`}>
                      <Table.Cell colSpan={3}>
                        <Badge color="gray">{lastCategory}</Badge>
                      </Table.Cell>
                    </Table.Row>,
                  )
                }

                if (entry.kind === 'item') {
                  const checked = checkedByKey[entry.key] === true
                  rows.push(
                    <Table.Row
                      key={entry.key}
                      style={{
                        cursor: interactive ? 'pointer' : 'default',
                        // better touch target
                        minHeight: 52,
                        opacity: isReview && !checked ? 0.55 : 1,
                      }}
                      onClick={() => {
                        if (!interactive) return
                        onToggleLine(entry.key)
                      }}
                    >
                      <Table.Cell>
                        {showCheckboxes && (
                          <Checkbox
                            checked={checked}
                            disabled={!interactive}
                            onClick={(e) => e.stopPropagation()}
                          />
                        )}
                      </Table.Cell>
                      <Table.Cell>{entry.name}</Table.Cell>
                      <Table.Cell justify="end">{entry.quantity}</Table.Cell>
                      <Table.Cell />
                    </Table.Row>,
                  )
                  continue
                }

                const isExpanded = expandedGroups.has(entry.groupId)
                const checkedCount = entry.childKeys.filter((k) => checkedByKey[k] === true).length
                const isAll =
                  entry.childKeys.length > 0 && checkedCount === entry.childKeys.length
                const isNone = checkedCount === 0
                const groupChecked: boolean | 'indeterminate' = isAll
                  ? true
                  : isNone
                    ? false
                    : 'indeterminate'

                rows.push(
                  <React.Fragment key={`group:${entry.groupId}`}>
                    <Table.Row
                      style={{
                        cursor: interactive ? 'pointer' : 'default',
                        minHeight: 52,
                        opacity:
                          isReview && checkedCount !== entry.childKeys.length ? 0.75 : 1,
                      }}
                      onClick={() => {
                        if (interactive) {
                          onToggleGroup(entry.groupId)
                        } else {
                          onToggleExpand(entry.groupId)
                        }
                      }}
                    >
                      <Table.Cell>
                        {showCheckboxes && (
                          <Checkbox
                            checked={groupChecked}
                            disabled={!interactive}
                            onClick={(e) => {
                              e.stopPropagation()
                              if (!interactive) return
                              onToggleGroup(entry.groupId)
                            }}
                          />
                        )}
                      </Table.Cell>
                      <Table.Cell>
                        <Flex align="center" justify="between" gap="2" wrap="wrap">
                          <Text weight="medium">{entry.name}</Text>
                          <Badge color="gray">
                            {checkedCount}/{entry.childKeys.length}
                          </Badge>
                        </Flex>
                      </Table.Cell>
                      <Table.Cell justify="end">{entry.quantity}</Table.Cell>
                      <Table.Cell justify="end">
                        <IconButton
                          variant="soft"
                          size="2"
                          onClick={(e) => {
                            e.stopPropagation()
                            onToggleExpand(entry.groupId)
                          }}
                          aria-label={isExpanded ? 'Collapse group' : 'Expand group'}
                        >
                          {isExpanded ? <NavArrowDown /> : <NavArrowRight />}
                        </IconButton>
                      </Table.Cell>
                    </Table.Row>

                    {isExpanded &&
                      entry.children.map((it) => {
                        const key = lineKeyForGroupItem(entry.groupId, it.id)
                        const checked = checkedByKey[key] === true
                        return (
                          <Table.Row
                            key={key}
                            style={{
                              cursor: interactive ? 'pointer' : 'default',
                              minHeight: 52,
                              opacity: isReview && !checked ? 0.55 : 1,
                            }}
                            onClick={() => {
                              if (!interactive) return
                              onToggleLine(key)
                            }}
                          >
                            <Table.Cell />
                            <Table.Cell>
                              <Flex align="center" gap="2">
                                {showCheckboxes && (
                                  <Checkbox
                                    checked={checked}
                                    disabled={!interactive}
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                )}
                                <Text>{it.name}</Text>
                              </Flex>
                            </Table.Cell>
                            <Table.Cell justify="end">{it.quantity}</Table.Cell>
                            <Table.Cell />
                          </Table.Row>
                        )
                      })}
                  </React.Fragment>,
                )
              }

              return rows
            })()}
          </Table.Body>
        </Table.Root>
      )}
    </Flex>
  )
}

