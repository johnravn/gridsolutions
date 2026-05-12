import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
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
  Text,
} from '@radix-ui/themes'
import { NavArrowDown, NavArrowRight } from 'iconoir-react'
import { supabase } from '@shared/api/supabase'
import { useAuthz } from '@shared/auth/useAuthz'
import { useCompany } from '@shared/companies/CompanyProvider'

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
    | {
        id: UUID
        name: string
        model?: string | null
        brand?: { name: string } | null
        category?: { name: string } | null
      }
    | Array<{
        id: UUID
        name: string
        model?: string | null
        brand?: { name: string } | null
        category?: { name: string } | null
      }>
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
  brandName?: string | null
  model?: string | null
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

type PackingSessionRow = {
  id: UUID
  job_id: UUID
  company_id: UUID
  vehicle_booking_id: UUID
  created_by_user_id: UUID
  confirmed_at: string
  all_loaded: boolean
  packed_keys: Array<string>
  slip_signature: string
  slip_snapshot: PackingSlip
}

function normalizeMaybeArray<T>(
  value: T | Array<T> | null | undefined,
): T | null {
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

function clearPackingLocalStorageForJob(jobId: string) {
  if (!canUseLocalStorage()) return
  try {
    const prefix = `packing:v3:${jobId}:`
    const keys: Array<string> = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith(prefix)) keys.push(k)
    }
    for (const k of keys) localStorage.removeItem(k)
  } catch {
    // ignore
  }
}

export default function PackingTab({ jobId }: { jobId: string }) {
  const { companyRole } = useAuthz()
  const canLoad = companyRole !== 'freelancer'
  const { companyId } = useCompany()
  const { data, isLoading, error } = useQuery({
    queryKey: ['jobs.packing', jobId],
    queryFn: async (): Promise<{
      equipment: Array<EquipmentBooking>
      transport: Array<TransportBooking>
      sessions: Array<PackingSessionRow>
    }> => {
      const { data: allTPs, error: tpErr } = await supabase
        .from('time_periods')
        .select('id')
        .eq('job_id', jobId)
      if (tpErr) throw tpErr
      const allTpIds = allTPs.map((tp: any) => tp.id as string)

      const { data: transportTPs, error: transportTpErr } = await supabase
        .from('time_periods')
        .select('id')
        .eq('job_id', jobId)
        .eq('category', 'transport')
        .eq('deleted', false)
      if (transportTpErr) throw transportTpErr
      const transportTpIds = transportTPs.map((tp: any) => tp.id as string)

      const equipment: Array<EquipmentBooking> = []
      if (allTpIds.length) {
        const { data: rows, error: eqErr } = await supabase
          .from('reserved_items')
          .select(
            `
            id, time_period_id, status, item_id, quantity, start_at, end_at,
            source_group_id, source_kind,
            item:item_id ( id, name, model, brand:brand_id ( name ), category:category_id ( name ) ),
            source_group:source_group_id ( id, name, category:category_id ( name ) ),
            time_period:time_period_id ( id, title, start_at, end_at, category )
          `,
          )
          .in('time_period_id', allTpIds)
          .neq('status', 'canceled')
        if (eqErr) throw eqErr
        equipment.push(...(rows as unknown as Array<EquipmentBooking>))
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
        const filtered = rows.filter((row: any) => {
          const vehicle = normalizeMaybeArray<any>(row.vehicle)
          return !vehicle?.deleted
        })
        transport.push(...(filtered as unknown as Array<TransportBooking>))
      }

      const { data: sessions, error: sErr } = await supabase
        .from('job_packing_sessions')
        .select(
          'id, job_id, company_id, vehicle_booking_id, created_by_user_id, confirmed_at, all_loaded, packed_keys, slip_signature, slip_snapshot',
        )
        .eq('job_id', jobId)
        .order('confirmed_at', { ascending: false })
      if (sErr) throw sErr

      return {
        equipment,
        transport,
        sessions: sessions as unknown as Array<PackingSessionRow>,
      }
    },
    staleTime: 10_000,
  })

  const equipment = data?.equipment ?? []
  const transport = data?.transport ?? []
  const sessions = data?.sessions ?? []

  const sessionsByVehicle = React.useMemo(() => {
    const m = new Map<string, Array<PackingSessionRow>>()
    for (const s of sessions) {
      const key = s.vehicle_booking_id
      const arr = m.get(key) ?? []
      arr.push(s)
      m.set(key, arr)
    }
    for (const arr of m.values()) {
      arr.sort(
        (a, b) =>
          new Date(b.confirmed_at).getTime() -
          new Date(a.confirmed_at).getTime(),
      )
    }
    return m
  }, [sessions])

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
      brandName: string | null,
      model: string | null,
      groupName: string | null,
      itemCategoryName: string | null,
      groupCategoryName: string | null,
    ) => {
      const fallbackCategory =
        itemCategoryName ?? groupCategoryName ?? 'Uncategorized'
      if (row.source_group_id) {
        const gid = row.source_group_id
        const gName = groupName ?? 'Group'
        if (!slip.groups.has(gid)) {
          slip.groups.set(gid, {
            id: gid,
            name: gName,
            categoryName:
              groupCategoryName ?? itemCategoryName ?? 'Uncategorized',
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
            brandName,
            model,
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
            brandName,
            model,
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
      const brandName =
        (item?.brand && Array.isArray(item.brand)
          ? item.brand[0]?.name
          : item?.brand?.name) ?? null
      const model = item?.model ?? null
      const groupName = group?.name ?? null
      const itemCategoryName =
        (item?.category && Array.isArray(item.category)
          ? item.category[0]?.name
          : item?.category?.name) ?? null
      const groupCategoryName =
        (group?.category && Array.isArray(group.category)
          ? group.category[0]?.name
          : group?.category?.name) ?? null

      // Aggregate into "no vehicle" slip too (used when no transport exists)
      addToSlip(
        noVehicleSlip,
        row,
        itemName,
        brandName,
        model,
        groupName,
        itemCategoryName,
        groupCategoryName,
      )

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

      const dest = bestVehicle
        ? byVehicle.get(bestVehicle.bookingId)!
        : unassigned
      addToSlip(
        dest,
        row,
        itemName,
        brandName,
        model,
        groupName,
        itemCategoryName,
        groupCategoryName,
      )
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
            {slips.noVehicle.items.length === 0 &&
            slips.noVehicle.groups.length === 0 ? (
              <Text color="gray">No equipment booked.</Text>
            ) : (
              <PackingSlipChecklist
                slip={slips.noVehicle}
                mode="view"
                checkedByKey={{}}
                newInSelectedPackingKeys={undefined}
                expandedGroups={new Set()}
                expandedItems={new Set()}
                onToggleExpandGroup={() => {}}
                onToggleExpandItem={() => {}}
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
              slip={
                slips.byVehicle[v.vehicleBookingId] ?? { items: [], groups: [] }
              }
              canLoad={canLoad}
              companyId={companyId}
              sessions={sessionsByVehicle.get(v.vehicleBookingId) ?? []}
            />
          ))}

          {(slips.unassigned.items.length > 0 ||
            slips.unassigned.groups.length > 0) && (
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
                  mode="view"
                  checkedByKey={{}}
                  newInSelectedPackingKeys={undefined}
                  expandedGroups={new Set()}
                  expandedItems={new Set()}
                  onToggleExpandGroup={() => {}}
                  onToggleExpandItem={() => {}}
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
    for (const item of group.items)
      keys.push(lineKeyForGroupItem(group.id, item.id))
  }
  return keys
}

function collectAllLineSignatures(slip: PackingSlip) {
  const sigs: Array<string> = []
  for (const item of slip.items)
    sigs.push(`${lineKeyForItem(item.id)}=${item.quantity}`)
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
  companyId,
  sessions,
}: {
  jobId: string
  vehicleBookingId: string
  vehicleDisplay: string
  slip: PackingSlip
  canLoad: boolean
  companyId: string | null
  sessions: Array<PackingSessionRow>
}) {
  const qc = useQueryClient()
  const [mode, setMode] = React.useState<
    'tentative' | 'loading' | 'review' | 'confirmed'
  >('tentative')
  const [expandedGroups, setExpandedGroups] = React.useState<Set<string>>(
    new Set(),
  )
  const [expandedItems, setExpandedItems] = React.useState<Set<string>>(
    new Set(),
  )
  const [checkedByKey, setCheckedByKey] = React.useState<
    Record<string, boolean>
  >({})
  const [confirmed, setConfirmed] = React.useState<
    | (ConfirmedPackingV2 & { packedKeys?: Array<string>; allLoaded?: boolean })
    | null
  >(null)
  const [incompleteFinishOpen, setIncompleteFinishOpen] = React.useState(false)
  const [showOnlyRemaining, setShowOnlyRemaining] = React.useState(false)
  const [selectedSessionId, setSelectedSessionId] = React.useState<
    string | null
  >(null)
  const [resetOpen, setResetOpen] = React.useState(false)

  const slipSignature = React.useMemo(
    () => collectAllLineSignatures(slip),
    [slip],
  )
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
  }, [slipSignature, mode])

  React.useEffect(() => {
    // Prefer server sessions (cross-device). Fall back to localStorage for older data.
    if (sessions.length > 0) {
      // Don't override the user's in-progress loading/review UI.
      if (mode === 'loading' || mode === 'review') return
      const latest = sessions[0]
      setSelectedSessionId(latest.id)
      setConfirmed({
        confirmedAt: latest.confirmed_at,
        vehicleBookingId,
        vehicleDisplay,
        slip: latest.slip_snapshot,
        packedKeys: latest.packed_keys,
        allLoaded: latest.all_loaded,
      })
      setMode('confirmed')
      return
    }

    const raw = canUseLocalStorage()
      ? localStorage.getItem(storageKey(jobId, vehicleBookingId))
      : null
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
      if (parsed.vehicleBookingId !== vehicleBookingId) {
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
  }, [jobId, vehicleBookingId, sessions, slip, vehicleDisplay, mode])

  const selectedServerSession = React.useMemo(() => {
    if (!sessions.length) return null
    if (selectedSessionId) {
      const found = sessions.find((s) => s.id === selectedSessionId)
      if (found) return found
    }
    return sessions[0] || null
  }, [sessions, selectedSessionId])

  const formatConfirmedAt = React.useCallback((iso: string) => {
    const d = new Date(iso)
    return d.toLocaleString(undefined, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }, [])

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

  const resumeFromPackedKeys = (keys: Array<string>) => {
    const keySet = new Set(keys.filter(Boolean))
    const initial: Record<string, boolean> = {}
    for (const k of allLineKeys) initial[k] = keySet.has(k)
    setCheckedByKey(initial)
    setMode('loading')
  }

  const continueLoadingFromNewestSession = () => {
    if (sessions.length > 0) {
      const newest = sessions[0]
      setSelectedSessionId(newest.id)
      resumeFromPackedKeys(newest.packed_keys)
      return
    }
    resumeFromPackedKeys(confirmed?.packedKeys ?? [])
  }

  const resetJobPacking = async () => {
    clearPackingLocalStorageForJob(jobId)
    // Best-effort delete server log (requires permissions)
    try {
      const { error } = await supabase
        .from('job_packing_sessions')
        .delete()
        .eq('job_id', jobId)
      if (error) throw error
    } finally {
      qc.invalidateQueries({ queryKey: ['jobs.packing', jobId] })
    }
    setSelectedSessionId(null)
    setConfirmed(null)
    setCheckedByKey({})
    setExpandedGroups(new Set())
    setExpandedItems(new Set())
    setShowOnlyRemaining(false)
    setMode('tentative')
  }

  const finishLoading = () => {
    if (allChecked) {
      setMode('review')
      return
    }
    setIncompleteFinishOpen(true)
  }

  const confirmLoading = async () => {
    const { data: auth } = await supabase.auth.getUser()
    const userId = auth.user?.id

    const payload: ConfirmedPackingV2 = {
      confirmedAt: new Date().toISOString(),
      vehicleBookingId,
      vehicleDisplay,
      slip,
    }
    const packedKeysToSave = packedKeys
    const allLoaded =
      packedKeysToSave.length === allLineKeys.length && hasAnything

    try {
      if (companyId && userId) {
        const { error: insErr } = await supabase
          .from('job_packing_sessions')
          .insert({
            job_id: jobId,
            company_id: companyId,
            vehicle_booking_id: vehicleBookingId,
            created_by_user_id: userId,
            confirmed_at: payload.confirmedAt,
            all_loaded: allLoaded,
            packed_keys: packedKeysToSave,
            slip_signature: slipSignature,
            slip_snapshot: slip as any,
          })
        if (insErr) throw insErr
        qc.invalidateQueries({ queryKey: ['jobs.packing', jobId] })
      }
    } catch (e) {
      // Keep the UI usable even if the server insert fails (offline, RLS, etc.).
      // LocalStorage fallback remains, and a later confirm will retry persisting.
      console.error('Failed to persist packing session', e)
    }

    if (canUseLocalStorage()) {
      localStorage.setItem(
        storageKey(jobId, vehicleBookingId),
        JSON.stringify({
          ...payload,
          packedKeys: packedKeysToSave,
          allLoaded,
        }),
      )
    }
    setConfirmed({
      ...payload,
      packedKeys: packedKeysToSave,
      allLoaded,
    })
    setMode('confirmed')
  }

  const bookingsChangedSinceConfirm = React.useMemo(() => {
    if (!confirmed) return false
    return (
      collectAllLineSignatures(confirmed.slip) !==
      collectAllLineSignatures(slip)
    )
  }, [confirmed, slip])

  const showGreenBorder =
    (mode === 'loading' && allChecked) ||
    (mode === 'review' && allChecked) ||
    (mode === 'confirmed' && confirmed?.allLoaded === true)

  return (
    <Card
      style={
        showGreenBorder ? { border: '2px solid var(--green-9)' } : undefined
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
            <Flex gap="2" wrap="wrap" justify="end">
              {sessions[0] && sessions[0].all_loaded === false && canLoad && (
                <Button
                  variant="soft"
                  onClick={() => resumeFromPackedKeys(sessions[0].packed_keys)}
                  disabled={!hasAnything}
                >
                  Resume loading
                </Button>
              )}
              <Button
                onClick={startLoading}
                disabled={!hasAnything || !canLoad}
              >
                Start loading
              </Button>
            </Flex>
          )}
        </Flex>

        {!canLoad && (
          <Text size="2" color="gray">
            Loading is disabled for freelancers. You can still view the packing
            slip.
          </Text>
        )}

        {mode === 'confirmed' && (
          <Flex direction="column" gap="2">
            <Flex align="center" gap="2" wrap="wrap">
              <Badge
                color={
                  (selectedServerSession?.all_loaded ?? confirmed?.allLoaded)
                    ? 'green'
                    : 'orange'
                }
              >
                {(selectedServerSession?.all_loaded ?? confirmed?.allLoaded)
                  ? 'Loaded'
                  : 'Partially loaded'}
              </Badge>
              <Text>
                {(selectedServerSession?.all_loaded ?? confirmed?.allLoaded) ? (
                  <>
                    Everything is loaded in <strong>{vehicleDisplay}</strong>.
                  </>
                ) : (
                  <>
                    Loading confirmed for <strong>{vehicleDisplay}</strong>.
                  </>
                )}
              </Text>
              {bookingsChangedSinceConfirm && (
                <Badge color="orange">Bookings changed</Badge>
              )}
            </Flex>
            {selectedServerSession?.confirmed_at && (
              <Text size="2" color="gray">
                Showing packing confirmed at{' '}
                <strong>
                  {formatConfirmedAt(selectedServerSession.confirmed_at)}
                </strong>
              </Text>
            )}
            {(selectedServerSession?.slip_snapshot ?? confirmed?.slip) ? (
              (() => {
                const selectedKeys =
                  selectedServerSession?.packed_keys ??
                  confirmed?.packedKeys ??
                  []
                const selectedKeySet = new Set(selectedKeys)

                // "New in this confirmation" = keys in selected session that were never packed before it.
                let newKeySet: Set<string> | undefined = undefined
                if (selectedServerSession?.confirmed_at) {
                  const selectedAt = new Date(
                    selectedServerSession.confirmed_at,
                  ).getTime()
                  const prevPacked = new Set<string>()
                  for (const s of sessions) {
                    const t = new Date(s.confirmed_at).getTime()
                    if (t >= selectedAt) continue
                    for (const k of s.packed_keys) prevPacked.add(k)
                  }
                  newKeySet = new Set<string>()
                  for (const k of selectedKeySet) {
                    if (!prevPacked.has(k)) newKeySet.add(k)
                  }
                }

                const checkedMap: Record<string, boolean> = {}
                for (const k of selectedKeySet) checkedMap[k] = true

                return (
                  <PackingSlipChecklist
                    slip={
                      selectedServerSession?.slip_snapshot ??
                      // fallback (legacy localStorage)
                      (confirmed?.slip as PackingSlip)
                    }
                    mode="view"
                    checkedByKey={checkedMap}
                    newInSelectedPackingKeys={newKeySet}
                    expandedGroups={expandedGroups}
                    expandedItems={expandedItems}
                    onToggleExpandGroup={(groupId) => {
                      setExpandedGroups((prev) => {
                        const next = new Set(prev)
                        if (next.has(groupId)) next.delete(groupId)
                        else next.add(groupId)
                        return next
                      })
                    }}
                    onToggleExpandItem={(key) => {
                      setExpandedItems((prev) => {
                        const next = new Set(prev)
                        if (next.has(key)) next.delete(key)
                        else next.add(key)
                        return next
                      })
                    }}
                    onToggleLine={() => {}}
                    onToggleGroup={() => {}}
                  />
                )
              })()
            ) : (
              <Text color="gray">No items were confirmed.</Text>
            )}
            <Flex justify="between" gap="2" wrap="wrap">
              {sessions.length > 1 && (
                <Text size="2" color="gray">
                  {sessions.length} previous loading sessions logged.
                </Text>
              )}
              {sessions.length > 1 && (
                <Flex gap="1" wrap="wrap" justify="end">
                  {sessions.slice(0, 3).map((s) => (
                    <Button
                      key={s.id}
                      size="1"
                      variant={
                        s.id === selectedServerSession?.id ? 'solid' : 'soft'
                      }
                      onClick={() => setSelectedSessionId(s.id)}
                    >
                      {formatConfirmedAt(s.confirmed_at)}
                    </Button>
                  ))}
                </Flex>
              )}
              <Flex justify="end" gap="2" wrap="wrap">
                {!(selectedServerSession?.all_loaded ?? confirmed?.allLoaded) &&
                  canLoad && (
                    <Button
                      variant="soft"
                      onClick={continueLoadingFromNewestSession}
                    >
                      Continue loading
                    </Button>
                  )}
                <AlertDialog.Root open={resetOpen} onOpenChange={setResetOpen}>
                  <AlertDialog.Trigger>
                    <Button variant="soft" color="red">
                      Reset packing
                    </Button>
                  </AlertDialog.Trigger>
                  <AlertDialog.Content maxWidth="520px">
                    <AlertDialog.Title>
                      Reset packing for this job?
                    </AlertDialog.Title>
                    <AlertDialog.Description>
                      This will delete all packing confirmations for this job
                      (including partial packings) and clear local packing
                      cache.
                    </AlertDialog.Description>
                    <Flex gap="3" mt="4" justify="end">
                      <AlertDialog.Cancel>
                        <Button variant="soft">Cancel</Button>
                      </AlertDialog.Cancel>
                      <AlertDialog.Action>
                        <Button
                          color="red"
                          onClick={async () => {
                            setResetOpen(false)
                            await resetJobPacking()
                          }}
                        >
                          Reset
                        </Button>
                      </AlertDialog.Action>
                    </Flex>
                  </AlertDialog.Content>
                </AlertDialog.Root>
              </Flex>
            </Flex>
          </Flex>
        )}

        {mode !== 'confirmed' && (
          <Flex direction="column" gap="3">
            {!hasAnything ? (
              <Text color="gray">
                No booked equipment overlaps this transport period.
              </Text>
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
                      <Flex
                        align="center"
                        justify="between"
                        gap="2"
                        wrap="wrap"
                      >
                        <Flex align="center" gap="2" wrap="wrap">
                          <Badge color="blue">Review mode</Badge>
                          <Text weight="medium">Ready to confirm loading</Text>
                        </Flex>
                        <Badge
                          color={
                            packedKeys.length === allLineKeys.length
                              ? 'green'
                              : 'orange'
                          }
                        >
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
                  newInSelectedPackingKeys={undefined}
                  expandedGroups={expandedGroups}
                  expandedItems={expandedItems}
                  onToggleExpandGroup={(groupId) => {
                    setExpandedGroups((prev) => {
                      const next = new Set(prev)
                      if (next.has(groupId)) next.delete(groupId)
                      else next.add(groupId)
                      return next
                    })
                  }}
                  onToggleExpandItem={(key) => {
                    setExpandedItems((prev) => {
                      const next = new Set(prev)
                      if (next.has(key)) next.delete(key)
                      else next.add(key)
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
                    const keys = group.items.map((it) =>
                      lineKeyForGroupItem(groupId, it.id),
                    )
                    const shouldCheck = !keys.every(
                      (k) => checkedByKey[k] === true,
                    )
                    setCheckedByKey((prev) => {
                      const next = { ...prev }
                      for (const k of keys) next[k] = shouldCheck
                      return next
                    })
                  }}
                  filterKeys={
                    showOnlyRemaining
                      ? new Set(
                          allLineKeys.filter((k) => checkedByKey[k] !== true),
                        )
                      : undefined
                  }
                />

                {canLoad && (
                  <Flex justify="between" gap="2" wrap="wrap" align="center">
                    <Button
                      variant="ghost"
                      size="2"
                      onClick={() => setShowOnlyRemaining((v) => !v)}
                      disabled={mode !== 'loading'}
                    >
                      {showOnlyRemaining ? 'Show all' : 'Show remaining'}
                    </Button>
                    <Flex justify="end" gap="2" wrap="wrap">
                      {mode === 'loading' && (
                        <>
                          <Button
                            variant="soft"
                            onClick={() => setMode('tentative')}
                          >
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
                              <AlertDialog.Title>
                                Not everything is checked
                              </AlertDialog.Title>
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
                          <Button
                            variant="soft"
                            onClick={() => setMode('loading')}
                          >
                            Back
                          </Button>
                          <Button onClick={confirmLoading}>
                            Confirm loading
                          </Button>
                        </>
                      )}
                    </Flex>
                  </Flex>
                )}
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
  newInSelectedPackingKeys,
  expandedGroups,
  expandedItems,
  onToggleExpandGroup,
  onToggleExpandItem,
  onToggleLine,
  onToggleGroup,
  filterKeys,
}: {
  slip: PackingSlip
  mode: 'loading' | 'review' | 'view'
  checkedByKey: Record<string, boolean>
  newInSelectedPackingKeys?: Set<string>
  expandedGroups: Set<string>
  expandedItems: Set<string>
  onToggleExpandGroup: (groupId: string) => void
  onToggleExpandItem: (key: string) => void
  onToggleLine: (key: string) => void
  onToggleGroup: (groupId: string) => void
  filterKeys?: Set<string>
}) {
  const interactive = mode === 'loading'
  const showCheckboxes = mode === 'loading' || mode === 'review'
  const isReview = mode === 'review'
  const showStatusPills = mode === 'view'
  const showLoadedInThisPackingDot =
    mode === 'view' && (newInSelectedPackingKeys?.size ?? 0) > 0

  type Entry =
    | {
        kind: 'item'
        categoryName: string
        key: string
        name: string
        brandName?: string | null
        model?: string | null
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
        ? g.items.filter((it) =>
            filterKeys.has(lineKeyForGroupItem(g.id, it.id)),
          )
        : g.items
      const visibleChildKeys = filterKeys
        ? childKeys.filter((k) => filterKeys.has(k))
        : childKeys
      if (filterKeys && visibleChildren.length === 0) continue

      const qty = visibleChildren.reduce((sum, it) => sum + it.quantity, 0)
      out.push({
        kind: 'group',
        categoryName: g.categoryName,
        groupId: g.id,
        name: g.name,
        quantity: qty,
        childKeys: visibleChildKeys,
        children: [...visibleChildren].sort((a, b) => {
          const ac = a.categoryName
          const bc = b.categoryName
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
        categoryName: it.categoryName,
        key,
        name: it.name,
        brandName: it.brandName ?? null,
        model: it.model ?? null,
        quantity: it.quantity,
      })
    }

    out.sort((a, b) => {
      if (a.categoryName !== b.categoryName)
        return a.categoryName.localeCompare(b.categoryName)
      return a.name.localeCompare(b.name)
    })

    return out
  }, [slip, filterKeys])

  const hasAnything = entries.length > 0

  return (
    <Flex direction="column" gap="3">
      {!hasAnything ? (
        <Text color="gray">No equipment.</Text>
      ) : (
        <Flex direction="column" gap="2">
          {entries.map((entry) => {
            if (entry.kind === 'item') {
              const checked = checkedByKey[entry.key] === true
              const isExpanded = expandedItems.has(entry.key)
              const showDot =
                showLoadedInThisPackingDot &&
                newInSelectedPackingKeys?.has(entry.key) === true
              return (
                <Card
                  key={entry.key}
                  style={{
                    padding: 12,
                    cursor: interactive ? 'pointer' : 'default',
                    opacity: isReview && !checked ? 0.55 : 1,
                    borderLeft:
                      showStatusPills && checked
                        ? '4px solid var(--green-9)'
                        : showStatusPills && !checked
                          ? '4px solid var(--orange-9)'
                          : undefined,
                  }}
                  onClick={() => {
                    if (!interactive) return
                    onToggleLine(entry.key)
                  }}
                >
                  <Flex direction="column" gap="2">
                    <Flex align="center" justify="between" gap="2">
                      <Flex align="center" gap="2" style={{ minWidth: 0 }}>
                        {showCheckboxes && (
                          <Checkbox
                            checked={checked}
                            disabled={!interactive}
                            onClick={(e) => {
                              e.stopPropagation()
                              if (!interactive) return
                              onToggleLine(entry.key)
                            }}
                          />
                        )}
                        <Box style={{ minWidth: 0 }}>
                          <Text weight="medium" style={{ display: 'block' }}>
                            {entry.name}
                          </Text>
                          <Text size="1" color="gray">
                            {entry.categoryName}
                          </Text>
                        </Box>
                      </Flex>
                      <Flex align="center" gap="2">
                        {showStatusPills && (
                          <Flex align="center" gap="1">
                            {showDot && (
                              <Box
                                style={{
                                  width: 8,
                                  height: 8,
                                  borderRadius: 999,
                                  background: 'var(--blue-9)',
                                }}
                                aria-label="Newly loaded in selected packing"
                              />
                            )}
                            <Badge color={checked ? 'green' : 'orange'}>
                              {checked ? 'Loaded' : 'Not loaded'}
                            </Badge>
                          </Flex>
                        )}
                        <Badge color="gray">x{entry.quantity}</Badge>
                        <IconButton
                          variant="soft"
                          size="2"
                          onClick={(e) => {
                            e.stopPropagation()
                            onToggleExpandItem(entry.key)
                          }}
                          aria-label={
                            isExpanded ? 'Collapse item' : 'Expand item'
                          }
                        >
                          {isExpanded ? <NavArrowDown /> : <NavArrowRight />}
                        </IconButton>
                      </Flex>
                    </Flex>
                    {isExpanded && (
                      <Flex direction="column" gap="1">
                        <Flex align="center" gap="2" wrap="wrap">
                          <Badge color={checked ? 'green' : 'orange'}>
                            {checked ? 'Loaded' : 'Not loaded'}
                          </Badge>
                          <Text size="2" color="gray">
                            Qty: <strong>{entry.quantity}</strong>
                          </Text>
                        </Flex>
                        {(entry.brandName || entry.model) && (
                          <Text size="2" color="gray">
                            {entry.brandName ? (
                              <>
                                Brand: <strong>{entry.brandName}</strong>
                              </>
                            ) : (
                              'Brand: —'
                            )}
                            {entry.model ? (
                              <>
                                {' '}
                                · Model: <strong>{entry.model}</strong>
                              </>
                            ) : (
                              ''
                            )}
                          </Text>
                        )}
                        <Text size="2" color="gray">
                          Category: {entry.categoryName}
                        </Text>
                      </Flex>
                    )}
                  </Flex>
                </Card>
              )
            }

            const isExpanded = expandedGroups.has(entry.groupId)
            const checkedCount = entry.childKeys.filter(
              (k) => checkedByKey[k] === true,
            ).length
            const isAll =
              entry.childKeys.length > 0 &&
              checkedCount === entry.childKeys.length
            const isNone = checkedCount === 0
            const groupChecked: boolean | 'indeterminate' = isAll
              ? true
              : isNone
                ? false
                : 'indeterminate'
            const showGroupDot =
              showLoadedInThisPackingDot &&
              entry.childKeys.some(
                (k) => newInSelectedPackingKeys?.has(k) === true,
              )

            return (
              <Card
                key={`group:${entry.groupId}`}
                style={{
                  padding: 12,
                  position: 'relative',
                  cursor: 'pointer',
                  borderLeft:
                    showStatusPills && checkedCount === entry.childKeys.length
                      ? '4px solid var(--green-9)'
                      : showStatusPills && checkedCount === 0
                        ? '4px solid var(--orange-9)'
                        : showStatusPills
                          ? '4px solid var(--blue-9)'
                          : undefined,
                }}
                onClick={() => {
                  if (interactive) onToggleGroup(entry.groupId)
                  else onToggleExpandGroup(entry.groupId)
                }}
              >
                <Flex direction="column" gap="2">
                  <Flex align="center" justify="between" gap="2">
                    <Flex align="center" gap="2" style={{ minWidth: 0 }}>
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
                      <Box style={{ minWidth: 0 }}>
                        <Text weight="medium" style={{ display: 'block' }}>
                          {entry.name}
                        </Text>
                        <Text size="1" color="gray">
                          {entry.categoryName} · {checkedCount}/
                          {entry.childKeys.length} loaded
                        </Text>
                      </Box>
                    </Flex>
                    <Flex align="center" gap="2">
                      {showStatusPills && (
                        <Flex align="center" gap="1">
                          {showGroupDot && (
                            <Box
                              style={{
                                width: 8,
                                height: 8,
                                borderRadius: 999,
                                background: 'var(--blue-9)',
                              }}
                              aria-label="Newly loaded in selected packing"
                            />
                          )}
                          <Badge
                            color={
                              checkedCount === entry.childKeys.length
                                ? 'green'
                                : checkedCount === 0
                                  ? 'orange'
                                  : 'blue'
                            }
                          >
                            {checkedCount === entry.childKeys.length
                              ? 'Loaded'
                              : checkedCount === 0
                                ? 'Not loaded'
                                : 'Partial'}
                          </Badge>
                        </Flex>
                      )}
                      <Badge color="gray">x{entry.quantity}</Badge>
                      <IconButton
                        variant="soft"
                        size="2"
                        onClick={(e) => {
                          e.stopPropagation()
                          onToggleExpandGroup(entry.groupId)
                        }}
                        aria-label={
                          isExpanded ? 'Collapse group' : 'Expand group'
                        }
                      >
                        {isExpanded ? <NavArrowDown /> : <NavArrowRight />}
                      </IconButton>
                    </Flex>
                  </Flex>

                  {isExpanded && (
                    <Flex direction="column" gap="1">
                      <Flex align="center" gap="2" wrap="wrap">
                        <Badge
                          color={
                            checkedCount === entry.childKeys.length
                              ? 'green'
                              : 'orange'
                          }
                        >
                          {checkedCount === entry.childKeys.length
                            ? 'All loaded'
                            : 'Partially loaded'}
                        </Badge>
                        <Text size="2" color="gray">
                          Lines: <strong>{entry.childKeys.length}</strong>
                        </Text>
                      </Flex>
                      {entry.children.map((it) => {
                        const key = lineKeyForGroupItem(entry.groupId, it.id)
                        const checked = checkedByKey[key] === true
                        const isChildExpanded = expandedItems.has(key)
                        const showDot =
                          showLoadedInThisPackingDot &&
                          newInSelectedPackingKeys?.has(key) === true
                        return (
                          <Card
                            key={key}
                            style={{
                              padding: 10,
                              background: 'var(--gray-a2)',
                              cursor: interactive ? 'pointer' : 'default',
                              opacity: isReview && !checked ? 0.55 : 1,
                              borderLeft:
                                showStatusPills && checked
                                  ? '4px solid var(--green-9)'
                                  : showStatusPills && !checked
                                    ? '4px solid var(--orange-9)'
                                    : undefined,
                            }}
                            onClick={() => {
                              if (!interactive) return
                              onToggleLine(key)
                            }}
                          >
                            <Flex
                              direction="column"
                              gap="2"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Flex align="center" justify="between" gap="2">
                                <Flex
                                  align="center"
                                  gap="2"
                                  style={{ minWidth: 0 }}
                                >
                                  {showCheckboxes && (
                                    <Checkbox
                                      checked={checked}
                                      disabled={!interactive}
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        if (!interactive) return
                                        onToggleLine(key)
                                      }}
                                    />
                                  )}
                                  <Text style={{ minWidth: 0 }}>{it.name}</Text>
                                </Flex>
                                <Flex align="center" gap="2">
                                  {showStatusPills && (
                                    <Flex align="center" gap="1">
                                      <Badge
                                        color={checked ? 'green' : 'orange'}
                                      >
                                        {checked ? 'Loaded' : 'Not loaded'}
                                      </Badge>
                                      {showDot && (
                                        <Box
                                          style={{
                                            width: 8,
                                            height: 8,
                                            borderRadius: 999,
                                            background: 'var(--blue-9)',
                                          }}
                                          aria-label="Newly loaded in selected packing"
                                        />
                                      )}
                                    </Flex>
                                  )}
                                  <Badge color="gray">x{it.quantity}</Badge>
                                </Flex>
                                <IconButton
                                  variant="soft"
                                  size="2"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    onToggleExpandItem(key)
                                  }}
                                  aria-label={
                                    isChildExpanded
                                      ? 'Collapse item'
                                      : 'Expand item'
                                  }
                                >
                                  {isChildExpanded ? (
                                    <NavArrowDown />
                                  ) : (
                                    <NavArrowRight />
                                  )}
                                </IconButton>
                              </Flex>
                              {isChildExpanded && (
                                <Flex direction="column" gap="1">
                                  <Flex align="center" gap="2" wrap="wrap">
                                    <Badge color={checked ? 'green' : 'orange'}>
                                      {checked ? 'Loaded' : 'Not loaded'}
                                    </Badge>
                                    <Text size="2" color="gray">
                                      Qty: <strong>{it.quantity}</strong>
                                    </Text>
                                  </Flex>
                                  {(it.brandName || it.model) && (
                                    <Text size="2" color="gray">
                                      {it.brandName ? (
                                        <>
                                          Brand: <strong>{it.brandName}</strong>
                                        </>
                                      ) : (
                                        'Brand: —'
                                      )}
                                      {it.model ? (
                                        <>
                                          {' '}
                                          · Model: <strong>{it.model}</strong>
                                        </>
                                      ) : (
                                        ''
                                      )}
                                    </Text>
                                  )}
                                  <Text size="2" color="gray">
                                    Group: <strong>{entry.name}</strong>
                                  </Text>
                                  <Text size="2" color="gray">
                                    Category: {it.categoryName}
                                  </Text>
                                </Flex>
                              )}
                            </Flex>
                          </Card>
                        )
                      })}
                    </Flex>
                  )}
                </Flex>
              </Card>
            )
          })}
          <Text size="1" color="gray">
            <Box
              asChild
              style={{
                display: 'inline-block',
                width: 10,
                height: 10,
                borderRadius: 999,
                background: 'var(--blue-9)',
                verticalAlign: 'middle',
                marginRight: 6,
              }}
            >
              <span />
            </Box>
            Blue dot = first time this item was loaded (compared to earlier
            confirmations).
          </Text>
        </Flex>
      )}
    </Flex>
  )
}
