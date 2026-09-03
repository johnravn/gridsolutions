import { impliedBookedGroupCount } from './groupBookingQuantity'
import type { OfferDetail, OfferTransportItem } from '../types'

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
    time_period_id?: string | null
  }>
  crewPeriods: Array<{
    title: string | null
    start_at: string
    end_at: string
    needed_count: number | null
    role_category: string | null
    confirmedCount?: number
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
    time_period_id: string | null
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
  /** Specified vehicle IDs on the basis (missing IDs are in unassignedTransport). */
  expectedTransport: Array<string>
  currentTransport: Array<string>
  /** Display labels for basis transport lines that have no vehicle_id yet. */
  unassignedTransport: Array<string>
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

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Prefer a looked-up name; never dump a raw UUID into the preview. */
export function labelForId(
  id: string,
  name: string | undefined,
  unknownLabel: string,
): string {
  const trimmed = name?.trim()
  if (trimmed) return trimmed
  if (UUID_RE.test(id)) return unknownLabel
  return id
}

/**
 * Normalize offer dates and booking timestamps to the same ISO instant
 * so `…000Z` and `…+00:00` (and equivalent offsets) compare equal.
 */
export function normalizeCrewInstant(value: string | null | undefined): string {
  if (!value) return ''
  const trimmed = value.trim()
  if (!trimmed) return ''
  const t = Date.parse(trimmed)
  if (Number.isNaN(t)) return trimmed
  return new Date(t).toISOString()
}

export function makeCrewKey(title: string, start: string, end: string) {
  return `${normalizeCrewInstant(start)}__${normalizeCrewInstant(end)}__${title.trim()}`
}

export function parseCrewKey(key: string): {
  title: string
  start_at: string
  end_at: string
} {
  const [start_at, end_at, ...titleParts] = key.split('__')
  return {
    start_at: start_at || '',
    end_at: end_at || '',
    title: titleParts.join('__'),
  }
}

export function makeEquipmentKey(row: {
  item_id: string
  source_kind: 'direct' | 'group'
  source_group_id: string | null
  time_period_id?: string | null
}) {
  return `${row.source_kind}:${row.source_group_id ?? ''}:${row.item_id}:${row.time_period_id ?? ''}`
}

export function parseEquipmentKey(key: string): {
  source_kind: 'direct' | 'group'
  source_group_id: string | null
  item_id: string
  time_period_id: string | null
} {
  const [source_kind, source_group_id_raw, item_id, time_period_id_raw] =
    key.split(':')
  return {
    source_kind: source_kind === 'group' ? 'group' : 'direct',
    source_group_id: source_group_id_raw ? source_group_id_raw : null,
    item_id: item_id || '',
    time_period_id: time_period_id_raw ? time_period_id_raw : null,
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
    const k = makeCrewKey(title, item.start_date, item.end_date)
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
    const k = makeCrewKey(title, tp.start_at, tp.end_at)
    m.set(k, tp.needed_count || 0)
  }
  for (const [k, v] of m.entries()) {
    if (!v) m.delete(k)
  }
  return m
}

export function unassignedTransportLabel(
  item: Pick<OfferTransportItem, 'vehicle_name' | 'vehicle_category'>,
): string {
  const name = item.vehicle_name?.trim()
  if (name) return `${name} (assigned on sync)`
  const category = item.vehicle_category?.replace(/_/g, ' ')
  if (category) return `${category} (assigned on sync)`
  return 'Vehicle (assigned on sync)'
}

export function buildExpectedTransportMultiset(offerDetail: SyncLineItems) {
  const expected: Array<string> = []
  for (const item of offerDetail.transport_items || []) {
    if (item.vehicle_id) expected.push(item.vehicle_id)
  }
  expected.sort()
  return expected
}

export function buildUnassignedTransportLabels(offerDetail: SyncLineItems) {
  const labels: Array<string> = []
  for (const item of offerDetail.transport_items || []) {
    if (item.vehicle_id) continue
    labels.push(unassignedTransportLabel(item))
  }
  return labels
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
      const timePeriodId = item.time_period_id ?? null
      if (item.item_id) {
        const k = makeEquipmentKey({
          item_id: item.item_id,
          source_kind: 'direct',
          source_group_id: null,
          time_period_id: timePeriodId,
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
            time_period_id: timePeriodId,
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
  const unassignedTransport = buildUnassignedTransportLabels(detail)

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
      time_period_id: parsed.time_period_id,
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
    const parsed = parseCrewKey(key)
    crewChanges.push({
      key,
      title: parsed.title,
      start_at: parsed.start_at,
      end_at: parsed.end_at,
      expected,
      current,
    })
  }

  return {
    equipmentChanges,
    crewChanges,
    expectedTransport,
    currentTransport,
    unassignedTransport,
  }
}

/** Names already present on the basis — used so the preview never has to wait on a separate names query. */
export function namesFromOfferDetail(detail: SyncLineItems): {
  itemNames: Map<string, string>
  vehicleNames: Map<string, string>
} {
  const itemNames = new Map<string, string>()
  const vehicleNames = new Map<string, string>()

  for (const group of detail.groups || []) {
    for (const item of group.items) {
      const name = item.item?.name?.trim()
      if (item.item_id && name) itemNames.set(item.item_id, name)
    }
  }

  const transportLines = [
    ...(detail.transport_items || []),
    ...(detail.transport_groups || []).flatMap((group) => group.items || []),
  ]
  for (const item of transportLines) {
    const name = item.vehicle_name?.trim() || item.vehicle?.name?.trim()
    if (item.vehicle_id && name) vehicleNames.set(item.vehicle_id, name)
  }

  return { itemNames, vehicleNames }
}

function formatEquipmentLine(
  c: OfferDiff['equipmentChanges'][number],
  formatItem: (itemId: string) => string,
  delta: number,
): string {
  const sign = delta > 0 ? '+' : '-'
  return `${formatItem(c.item_id)}${c.source_kind === 'group' ? ' (group)' : ''} (${sign}${Math.abs(delta)})`
}

/** Consume expected IDs from current as a multiset; leftovers are unmatched on each side. */
export function consumeIdMultiset(
  expectedIds: Array<string>,
  currentIds: Array<string>,
): { unmatchedExpected: Array<string>; leftoverCurrent: Array<string> } {
  const leftoverCurrent = [...currentIds]
  const unmatchedExpected: Array<string> = []
  for (const id of expectedIds) {
    const idx = leftoverCurrent.indexOf(id)
    if (idx === -1) unmatchedExpected.push(id)
    else leftoverCurrent.splice(idx, 1)
  }
  return { unmatchedExpected, leftoverCurrent }
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

  const { unmatchedExpected, leftoverCurrent } = consumeIdMultiset(
    diff.expectedTransport,
    diff.currentTransport,
  )

  const unassigned = [...diff.unassignedTransport]
  const pairCount = Math.min(leftoverCurrent.length, unassigned.length)
  const leftoverAfterPair = leftoverCurrent.slice(pairCount)
  const unassignedAfterPair = unassigned.slice(pairCount)

  const transportAdditions = [
    ...unmatchedExpected.map((id) => formatV(id)),
    ...unassignedAfterPair,
  ]
  const transportRemovals = leftoverAfterPair.map((id) => formatV(id))

  let transportSummary: string | null = null
  if (
    transportAdditions.length === 0 &&
    transportRemovals.length === 0 &&
    diff.expectedTransport.length + diff.unassignedTransport.length > 0
  ) {
    transportSummary = 'Transport matches'
  } else if (pairCount > 0 && unassignedAfterPair.length > 0) {
    transportSummary =
      'Some transport lines have no specific vehicle — they will be assigned on sync'
  } else if (unassignedAfterPair.length > 0) {
    transportSummary =
      'Vehicles without a specific assignment will be chosen on sync'
  }

  const hasChanges =
    equipmentAdditions.length > 0 ||
    equipmentRemovals.length > 0 ||
    crewAdditions.length > 0 ||
    crewRemovals.length > 0 ||
    transportAdditions.length > 0 ||
    transportRemovals.length > 0

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

export type ItemCatalogEntry = {
  name: string
  brand: string | null
  model: string | null
  category: string
}

export function catalogFromOfferDetail(
  detail: SyncLineItems,
): Map<string, ItemCatalogEntry> {
  const map = new Map<string, ItemCatalogEntry>()
  for (const group of detail.groups || []) {
    for (const line of group.items) {
      if (!line.item_id || !line.item) continue
      map.set(line.item_id, {
        name: line.item.name?.trim() || '',
        brand: line.item.brand?.name?.trim() || null,
        model: line.item.model?.trim() || null,
        category: 'Other',
      })
    }
  }
  return map
}

export type SyncPreviewItem = {
  key: string
  item_id: string
  name: string
  brand: string | null
  model: string | null
  category: string
  quantity: number
}

export type SyncPreviewLine =
  | { kind: 'direct'; item: SyncPreviewItem }
  | {
      kind: 'group'
      group_id: string
      groupName: string
      category: string
      quantity: number
      items: Array<SyncPreviewItem>
    }

export type SyncPreviewOfferGroup = {
  id: string
  name: string
  lines: Array<SyncPreviewLine>
}

export type SyncPreviewCompact = {
  equipmentByCategory: Array<{ categoryName: string; quantity: number }>
  vehicleNames: Array<string>
  crewLabels: Array<string>
}

export type SyncPreviewCrew = {
  key: string
  title: string
  category: string | null
  quantity: number
  start_at: string
  end_at: string
  confirmedCount: number
}

export type SyncPreviewViewModel = FormattedOfferDiff & {
  additionCompact: SyncPreviewCompact
  removalCompact: SyncPreviewCompact
  additionGroups: Array<SyncPreviewOfferGroup>
  removalGroups: Array<SyncPreviewOfferGroup>
  additionUngrouped: Array<SyncPreviewItem>
  removalUngrouped: Array<SyncPreviewItem>
  additionCrew: Array<SyncPreviewCrew>
  removalCrew: Array<SyncPreviewCrew>
}

function offerGroupTitle(
  group: NonNullable<SyncLineItems['groups']>[number] | undefined,
): string {
  if (!group) return 'Equipment'
  const named = 'group_name' in group ? group.group_name : undefined
  return named?.trim() || 'Equipment'
}

function resolvePreviewItem(
  itemId: string,
  quantity: number,
  key: string,
  catalog: Map<string, ItemCatalogEntry>,
  fallback?: {
    name?: string | null
    brand?: string | null
    model?: string | null
  },
): SyncPreviewItem {
  const entry = catalog.get(itemId)
  return {
    key,
    item_id: itemId,
    name: labelForId(
      itemId,
      entry?.name ?? fallback?.name ?? undefined,
      'Unknown item',
    ),
    brand: entry?.brand ?? fallback?.brand ?? null,
    model: entry?.model ?? fallback?.model ?? null,
    category: entry?.category?.trim() || 'Other',
    quantity,
  }
}

function deltaFor(
  change: OfferDiff['equipmentChanges'][number] | undefined,
  direction: 'add' | 'remove',
): number {
  if (!change) return 0
  return direction === 'add'
    ? change.expected - change.current
    : change.current - change.expected
}

function bumpCategory(
  categoryQty: Map<string, number>,
  category: string,
  quantity: number,
) {
  if (quantity <= 0) return
  const name = category.trim() || 'Other'
  categoryQty.set(name, (categoryQty.get(name) ?? 0) + quantity)
}

function compactFromPreview(
  groups: Array<SyncPreviewOfferGroup>,
  ungrouped: Array<SyncPreviewItem>,
  vehicleNames: Array<string>,
  crewLabels: Array<string>,
): SyncPreviewCompact {
  const categoryQty = new Map<string, number>()
  for (const group of groups) {
    for (const line of group.lines) {
      if (line.kind === 'direct') {
        bumpCategory(categoryQty, line.item.category, line.item.quantity)
      } else {
        bumpCategory(categoryQty, line.category, line.quantity)
      }
    }
  }
  for (const item of ungrouped) {
    bumpCategory(categoryQty, item.category, item.quantity)
  }
  const equipmentByCategory = [...categoryQty.entries()]
    .map(([categoryName, quantity]) => ({ categoryName, quantity }))
    .filter((row) => row.quantity > 0)
    .sort((a, b) => a.categoryName.localeCompare(b.categoryName))

  return { equipmentByCategory, vehicleNames, crewLabels }
}

function crewCompactLabels(
  diff: OfferDiff,
  direction: 'add' | 'remove',
): Array<string> {
  return diff.crewChanges
    .filter((change) =>
      direction === 'add'
        ? change.expected > change.current
        : change.current > change.expected,
    )
    .map((change) => {
      const delta = Math.abs(change.expected - change.current)
      const title = change.title.trim() || 'Crew'
      return delta > 1 ? `${title} ×${delta}` : title
    })
}

function crewPreviewRows(
  diff: OfferDiff,
  detail: SyncLineItems,
  snapshot: BookingsSnapshot | undefined,
  direction: 'add' | 'remove',
): Array<SyncPreviewCrew> {
  const offerByKey = new Map<string, { category: string | null }>()
  for (const item of detail.crew_items || []) {
    const key = makeCrewKey(item.role_title, item.start_date, item.end_date)
    offerByKey.set(key, {
      category: item.role_category?.trim() || null,
    })
  }

  const snapshotByKey = new Map<
    string,
    { category: string | null; confirmedCount: number }
  >()
  for (const period of snapshot?.crewPeriods ?? []) {
    const title = period.title?.trim() || ''
    if (!title) continue
    const key = makeCrewKey(title, period.start_at, period.end_at)
    snapshotByKey.set(key, {
      category: period.role_category?.trim() || null,
      confirmedCount: period.confirmedCount ?? 0,
    })
  }

  return diff.crewChanges
    .filter((change) =>
      direction === 'add'
        ? change.expected > change.current
        : change.current > change.expected,
    )
    .map((change) => {
      const offer = offerByKey.get(change.key)
      const current = snapshotByKey.get(change.key)
      const category =
        (direction === 'add' ? offer?.category : current?.category) ??
        offer?.category ??
        current?.category ??
        null
      return {
        key: change.key,
        title: change.title.trim() || 'Crew',
        category,
        quantity: Math.abs(change.expected - change.current),
        start_at: change.start_at,
        end_at: change.end_at,
        confirmedCount: current?.confirmedCount ?? 0,
      }
    })
}

function buildOfferGroupTrees(
  detail: SyncLineItems,
  diff: OfferDiff,
  catalog: Map<string, ItemCatalogEntry>,
  leafItemsByGroupId: Map<string, Array<{ item_id: string; quantity: number }>>,
  groupCategoryById: Map<string, string>,
  direction: 'add' | 'remove',
): { groups: Array<SyncPreviewOfferGroup>; usedKeys: Set<string> } {
  const changes = new Map(
    diff.equipmentChanges.map((change) => [change.key, change]),
  )
  const usedKeys = new Set<string>()
  const groups: Array<SyncPreviewOfferGroup> = []

  for (const group of detail.groups ?? []) {
    const lines: Array<SyncPreviewLine> = []

    for (const line of group.items ?? []) {
      if (line.item_id) {
        const key = makeEquipmentKey({
          item_id: line.item_id,
          source_kind: 'direct',
          source_group_id: null,
        })
        const quantity = deltaFor(changes.get(key), direction)
        if (quantity <= 0) continue
        usedKeys.add(key)
        lines.push({
          kind: 'direct',
          item: resolvePreviewItem(line.item_id, quantity, key, catalog, {
            name: line.item?.name,
            brand: line.item?.brand?.name ?? null,
            model: line.item?.model ?? null,
          }),
        })
        continue
      }

      if (!line.group_id) continue

      const members = leafItemsByGroupId.get(line.group_id) ?? []
      const items: Array<SyncPreviewItem> = []
      for (const member of members) {
        const key = makeEquipmentKey({
          item_id: member.item_id,
          source_kind: 'group',
          source_group_id: line.group_id,
        })
        const quantity = deltaFor(changes.get(key), direction)
        if (quantity <= 0) continue
        usedKeys.add(key)
        items.push(resolvePreviewItem(member.item_id, quantity, key, catalog))
      }
      if (items.length === 0) continue
      lines.push({
        kind: 'group',
        group_id: line.group_id,
        groupName: line.group?.name?.trim() || 'Group',
        category:
          groupCategoryById.get(line.group_id)?.trim() ||
          items[0]?.category ||
          'Other',
        quantity: impliedBookedGroupCount(members, items),
        items,
      })
    }

    if (lines.length === 0) continue
    groups.push({
      id: group.id,
      name: offerGroupTitle(group),
      lines,
    })
  }

  return { groups, usedKeys }
}

export function buildSyncPreviewViewModel(
  diff: OfferDiff,
  detail: SyncLineItems,
  catalog: Map<string, ItemCatalogEntry>,
  leafItemsByGroupId: Map<string, Array<{ item_id: string; quantity: number }>>,
  formatItem: (itemId: string) => string,
  formatVehicle?: (vehicleId: string) => string,
  snapshot?: BookingsSnapshot,
  groupCategoryById: Map<string, string> = new Map(),
): SyncPreviewViewModel {
  const formatted = formatOfferDiffForPreview(diff, formatItem, formatVehicle)
  const additions = buildOfferGroupTrees(
    detail,
    diff,
    catalog,
    leafItemsByGroupId,
    groupCategoryById,
    'add',
  )
  const removals = buildOfferGroupTrees(
    detail,
    diff,
    catalog,
    leafItemsByGroupId,
    groupCategoryById,
    'remove',
  )

  const additionUngrouped: Array<SyncPreviewItem> = []
  const removalUngrouped: Array<SyncPreviewItem> = []
  for (const change of diff.equipmentChanges) {
    const addQty = deltaFor(change, 'add')
    const removeQty = deltaFor(change, 'remove')
    if (addQty > 0 && !additions.usedKeys.has(change.key)) {
      additionUngrouped.push(
        resolvePreviewItem(change.item_id, addQty, change.key, catalog),
      )
    }
    if (removeQty > 0 && !removals.usedKeys.has(change.key)) {
      removalUngrouped.push(
        resolvePreviewItem(change.item_id, removeQty, change.key, catalog),
      )
    }
  }

  return {
    ...formatted,
    additionCompact: compactFromPreview(
      additions.groups,
      additionUngrouped,
      formatted.transportAdditions,
      crewCompactLabels(diff, 'add'),
    ),
    removalCompact: compactFromPreview(
      removals.groups,
      removalUngrouped,
      formatted.transportRemovals,
      crewCompactLabels(diff, 'remove'),
    ),
    additionGroups: additions.groups,
    removalGroups: removals.groups,
    additionUngrouped,
    removalUngrouped,
    additionCrew: crewPreviewRows(diff, detail, snapshot, 'add'),
    removalCrew: crewPreviewRows(diff, detail, snapshot, 'remove'),
  }
}
