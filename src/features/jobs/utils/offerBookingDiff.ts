import type { OfferDetail } from '../types'

export type SyncLineItems = Pick<
  OfferDetail,
  'groups' | 'crew_items' | 'transport_items' | 'transport_groups'
>

export type BookingsSnapshot = {
  equipment: Array<{
    item_id: string
    quantity: number
    source_kind: 'direct' | 'group'
    source_group_id: string | null
  }>
  crewPeriods: Array<{
    title: string | null
    start_at: string
    end_at: string
    needed_count: number | null
    role_category: string | null
  }>
  transport: Array<{
    vehicle_id: string
  }>
}

export type OfferDiff = {
  equipmentChanges: Array<{
    key: string
    item_id: string
    source_kind: 'direct' | 'group'
    source_group_id: string | null
    expected: number
    current: number
  }>
  crewChanges: Array<{
    key: string
    title: string
    start_at: string
    end_at: string
    expected: number
    current: number
  }>
  expectedTransport: Array<string> | null
  currentTransport: Array<string>
}

export type FormattedOfferDiff = {
  equipmentAdditions: Array<string>
  equipmentRemovals: Array<string>
  crewAdditions: Array<string>
  crewRemovals: Array<string>
  transportAdditions: Array<string>
  transportRemovals: Array<string>
  transportSummary: string | null
  hasChanges: boolean
}

export function makeEquipmentKey(row: {
  item_id: string
  source_kind: 'direct' | 'group'
  source_group_id: string | null
}) {
  return `${row.source_kind}:${row.source_group_id ?? ''}:${row.item_id}`
}

export function parseEquipmentKey(key: string): {
  source_kind: 'direct' | 'group'
  source_group_id: string | null
  item_id: string
} {
  const [source_kind, source_group_id_raw, item_id] = key.split(':')
  return {
    source_kind: source_kind === 'group' ? 'group' : 'direct',
    source_group_id: source_group_id_raw ? source_group_id_raw : null,
    item_id: item_id || '',
  }
}

export function mapsEqual(a: Map<string, number>, b: Map<string, number>) {
  if (a.size !== b.size) return false
  for (const [k, v] of a.entries()) {
    if ((b.get(k) ?? 0) !== v) return false
  }
  return true
}

export function buildExpectedCrewMap(offerDetail: SyncLineItems) {
  const m = new Map<string, number>()
  for (const item of offerDetail.crew_items || []) {
    const title = item.role_title.trim()
    const start = item.start_date
    const end = item.end_date
    const k = `${title}__${start}__${end}`
    m.set(k, (m.get(k) ?? 0) + item.crew_count)
  }
  for (const [k, v] of m.entries()) {
    if (!v) m.delete(k)
  }
  return m
}

export function buildCurrentCrewMap(snapshot: BookingsSnapshot) {
  const m = new Map<string, number>()
  for (const tp of snapshot.crewPeriods) {
    const title = tp.title ? tp.title.trim() : ''
    if (!title) continue
    const k = `${title}__${tp.start_at}__${tp.end_at}`
    m.set(k, tp.needed_count || 0)
  }
  for (const [k, v] of m.entries()) {
    if (!v) m.delete(k)
  }
  return m
}

export function buildExpectedTransportMultiset(offerDetail: SyncLineItems) {
  const expected: Array<string> = []
  for (const item of offerDetail.transport_items || []) {
    if (!item.vehicle_id) return null
    expected.push(item.vehicle_id)
  }
  expected.sort()
  return expected
}

export function buildCurrentTransportMultiset(snapshot: BookingsSnapshot) {
  const current = snapshot.transport.map((t) => t.vehicle_id).filter(Boolean)
  current.sort()
  return current
}

export function buildCurrentEquipmentMap(snapshot: BookingsSnapshot) {
  const m = new Map<string, number>()
  for (const row of snapshot.equipment) {
    const k = makeEquipmentKey(row)
    m.set(k, (m.get(k) ?? 0) + row.quantity)
  }
  for (const [k, v] of m.entries()) {
    if (!v) m.delete(k)
  }
  return m
}

export function buildExpectedEquipmentMap(
  detail: SyncLineItems,
  groupItemsMap: Map<string, Array<{ item_id: string; quantity: number }>>,
) {
  const m = new Map<string, number>()
  for (const group of detail.groups || []) {
    for (const item of group.items) {
      if (item.item_id) {
        const k = makeEquipmentKey({
          item_id: item.item_id,
          source_kind: 'direct',
          source_group_id: null,
        })
        m.set(k, (m.get(k) ?? 0) + item.quantity)
        continue
      }

      if (item.group_id) {
        const members = groupItemsMap.get(item.group_id) ?? []
        for (const member of members) {
          const k = makeEquipmentKey({
            item_id: member.item_id,
            source_kind: 'group',
            source_group_id: item.group_id,
          })
          const qty = (member.quantity || 1) * Math.max(0, item.quantity)
          m.set(k, (m.get(k) ?? 0) + qty)
        }
      }
    }
  }
  for (const [k, v] of m.entries()) {
    if (!v) m.delete(k)
  }
  return m
}

export function computeOfferDiff(
  snapshot: BookingsSnapshot,
  detail: SyncLineItems,
  groupItemsMap: Map<string, Array<{ item_id: string; quantity: number }>>,
): OfferDiff {
  const expectedEquip = buildExpectedEquipmentMap(detail, groupItemsMap)
  const currentEquip = buildCurrentEquipmentMap(snapshot)

  const expectedCrew = buildExpectedCrewMap(detail)
  const currentCrew = buildCurrentCrewMap(snapshot)

  const expectedTransport = buildExpectedTransportMultiset(detail)
  const currentTransport = buildCurrentTransportMultiset(snapshot)

  const equipmentChanges: OfferDiff['equipmentChanges'] = []
  const allEquipKeys = new Set<string>([
    ...Array.from(expectedEquip.keys()),
    ...Array.from(currentEquip.keys()),
  ])
  for (const key of allEquipKeys) {
    const expected = expectedEquip.get(key) ?? 0
    const current = currentEquip.get(key) ?? 0
    if (expected === current) continue
    const parsed = parseEquipmentKey(key)
    equipmentChanges.push({
      key,
      item_id: parsed.item_id,
      source_kind: parsed.source_kind,
      source_group_id: parsed.source_group_id,
      expected,
      current,
    })
  }

  const crewChanges: OfferDiff['crewChanges'] = []
  const allCrewKeys = new Set<string>([
    ...Array.from(expectedCrew.keys()),
    ...Array.from(currentCrew.keys()),
  ])
  for (const key of allCrewKeys) {
    const expected = expectedCrew.get(key) ?? 0
    const current = currentCrew.get(key) ?? 0
    if (expected === current) continue
    const [title, start_at, end_at] = key.split('__')
    crewChanges.push({
      key,
      title: title || '',
      start_at: start_at || '',
      end_at: end_at || '',
      expected,
      current,
    })
  }

  return {
    equipmentChanges,
    crewChanges,
    expectedTransport,
    currentTransport,
  }
}

function formatEquipmentLine(
  c: OfferDiff['equipmentChanges'][number],
  formatItem: (itemId: string) => string,
  delta: number,
): string {
  const sign = delta > 0 ? '+' : '-'
  return `${formatItem(c.item_id)}${c.source_kind === 'group' ? ' (group)' : ''} (${sign}${Math.abs(delta)})`
}

export function formatOfferDiffForPreview(
  diff: OfferDiff,
  formatItem: (itemId: string) => string,
  formatVehicle?: (vehicleId: string) => string,
): FormattedOfferDiff {
  const equipmentRemovals = diff.equipmentChanges
    .filter((c) => c.current > c.expected)
    .sort((a, b) => b.current - b.expected - (a.current - a.expected))
    .map((c) => formatEquipmentLine(c, formatItem, -(c.current - c.expected)))

  const equipmentAdditions = diff.equipmentChanges
    .filter((c) => c.expected > c.current)
    .sort((a, b) => b.expected - b.current - (a.expected - a.current))
    .map((c) => formatEquipmentLine(c, formatItem, c.expected - c.current))

  const crewRemovals = diff.crewChanges
    .filter((c) => c.current > c.expected)
    .sort((a, b) => b.current - b.expected - (a.current - a.expected))
    .map((c) => `${c.title || 'Crew'} (${c.current} → ${c.expected})`)

  const crewAdditions = diff.crewChanges
    .filter((c) => c.expected > c.current)
    .sort((a, b) => b.expected - b.current - (a.expected - a.current))
    .map((c) => `${c.title || 'Crew'} (${c.current} → ${c.expected})`)

  const formatV = formatVehicle ?? ((id: string) => id)

  let transportAdditions: Array<string> = []
  let transportRemovals: Array<string> = []
  let transportSummary: string | null = null

  if (diff.expectedTransport === null) {
    if (diff.currentTransport.length > 0) {
      transportSummary =
        'Basis does not specify vehicles — existing transport bookings may be replaced'
    } else {
      transportSummary =
        'Basis does not specify vehicles — transport cannot be strictly compared'
    }
  } else {
    const expectedSet = new Set(diff.expectedTransport)
    const currentSet = new Set(diff.currentTransport)

    transportAdditions = diff.expectedTransport
      .filter((id) => !currentSet.has(id))
      .map((id) => formatV(id))

    transportRemovals = diff.currentTransport
      .filter((id) => !expectedSet.has(id))
      .map((id) => formatV(id))

    if (
      transportAdditions.length === 0 &&
      transportRemovals.length === 0 &&
      diff.expectedTransport.length === diff.currentTransport.length
    ) {
      transportSummary = 'Transport matches'
    }
  }

  const hasChanges =
    equipmentAdditions.length > 0 ||
    equipmentRemovals.length > 0 ||
    crewAdditions.length > 0 ||
    crewRemovals.length > 0 ||
    transportAdditions.length > 0 ||
    transportRemovals.length > 0 ||
    (diff.expectedTransport === null && diff.currentTransport.length > 0)

  return {
    equipmentAdditions,
    equipmentRemovals,
    crewAdditions,
    crewRemovals,
    transportAdditions,
    transportRemovals,
    transportSummary,
    hasChanges,
  }
}
