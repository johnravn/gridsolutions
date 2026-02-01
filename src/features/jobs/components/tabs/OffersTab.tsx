// src/features/jobs/components/tabs/OffersTab.tsx
import * as React from 'react'
import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import {
  Badge,
  Box,
  Button,
  Callout,
  Dialog,
  DropdownMenu,
  Flex,
  Heading,
  IconButton,
  RadioCards,
  Separator,
  Table,
  Text,
  TextArea,
  TextField,
  Tooltip,
} from '@radix-ui/themes'
import {
  Calendar,
  Copy,
  Download,
  Edit,
  Eye,
  Import,
  InfoCircle,
  Link,
  Lock,
  Plus,
  Refresh,
  Trash,
} from 'iconoir-react'
import { useToast } from '@shared/ui/toast/ToastProvider'
import { useAuthz } from '@shared/auth/useAuthz'
import { supabase } from '@shared/api/supabase'
import { CopyIconButton } from '@shared/lib/CopyIconButton'
import { createMatter } from '@features/matters/api/queries'
import {
  createBookingsFromOffer,
  createTechnicalOfferFromBookings,
  deleteOffer,
  duplicateOffer,
  exportOfferPDF,
  jobOffersQuery,
  lockOffer,
  offerDetailQuery,
  syncBookingsFromOffer,
} from '../../api/offerQueries'
import TechnicalOfferEditor from '../dialogs/TechnicalOfferEditor'
import PrettyOfferEditor from '../dialogs/PrettyOfferEditor'
import type { JobOffer, OfferDetail, OfferType } from '../../types'

function getOfferStatusBadgeColor(offer: JobOffer) {
  if (offer.revision_requested_at) return 'orange'
  switch (offer.status) {
    case 'draft':
      return 'gray'
    case 'sent':
      return 'blue'
    case 'viewed':
      return 'purple'
    case 'accepted':
      return 'green'
    case 'rejected':
      return 'red'
    case 'superseded':
      return 'orange'
    default:
      return 'gray'
  }
}

function getOfferStatusLabel(offer: JobOffer) {
  return offer.revision_requested_at ? 'wants revision' : offer.status
}

function getOfferTypeLabel(type: OfferType) {
  return type === 'technical' ? 'Technical' : 'Pretty'
}

type GroupItemRow = {
  group_id: string
  item_id: string
  quantity: number | null
}

export default function OffersTab({
  jobId,
  companyId,
  isActive,
}: {
  jobId: string
  companyId: string
  isActive?: boolean
}) {
  const { companyRole } = useAuthz()
  const isReadOnly = companyRole === 'freelancer'
  const [syncingOfferId, setSyncingOfferId] = React.useState<string | null>(
    null,
  )
  const [syncConfirm, setSyncConfirm] = React.useState<{
    offer: JobOffer
    removals: {
      equipment: Array<string>
      crew: Array<string>
      transport: Array<string>
    }
  } | null>(null)
  const [deleteOpen, setDeleteOpen] = React.useState<JobOffer | null>(null)
  const [editorOpen, setEditorOpen] = React.useState(false)
  const [editingOfferId, setEditingOfferId] = React.useState<string | null>(
    null,
  )
  const [linkDialogOpen, setLinkDialogOpen] = React.useState<JobOffer | null>(
    null,
  )
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false)
  const [responseDialogOpen, setResponseDialogOpen] =
    React.useState<JobOffer | null>(null)
  const [responseType, setResponseType] = React.useState<
    'accepted' | 'rejected' | 'revision'
  >('accepted')
  const [responseComment, setResponseComment] = React.useState('')
  const [revisionMessageOffer, setRevisionMessageOffer] =
    React.useState<JobOffer | null>(null)

  const qc = useQueryClient()
  const { success, error: toastError, info } = useToast()
  const invalidateBookingQueries = React.useCallback(() => {
    qc.invalidateQueries({ queryKey: ['jobs.equipment', jobId] })
    qc.invalidateQueries({ queryKey: ['jobs.crew', jobId] })
    qc.invalidateQueries({ queryKey: ['jobs.transport', jobId] })
    // CrewTab also has a dedicated roles query key (time_periods), so invalidate it too.
    qc.invalidateQueries({ queryKey: ['jobs', jobId, 'time_periods', 'crew'] })
    // OffersTab internal snapshot
    qc.invalidateQueries({
      queryKey: ['jobs', jobId, 'bookings-snapshot-for-offers'],
    })
  }, [qc, jobId])

  const offersQuery = useQuery({
    ...jobOffersQuery(jobId),
    // The "Synced" column depends on current bookings; always re-check on tab entry.
    refetchOnMount: 'always',
    staleTime: 0,
  })
  const { data: offers = [], isLoading } = offersQuery

  type BookingsSnapshot = {
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

  const bookingsSnapshotQuery = useQuery({
    queryKey: ['jobs', jobId, 'bookings-snapshot-for-offers'] as const,
    enabled: isActive ?? true,
    staleTime: 0,
    refetchOnMount: 'always',
    queryFn: async (): Promise<BookingsSnapshot> => {
      const { data: timePeriodsRaw, error: tpErr } = await supabase
        .from('time_periods')
        .select(
          'id, title, start_at, end_at, category, needed_count, role_category, deleted',
        )
        .eq('job_id', jobId)
        .in('category', ['equipment', 'crew', 'transport'])
        .or('deleted.is.null,deleted.eq.false')

      if (tpErr) throw tpErr

      const timePeriods =
        (timePeriodsRaw as Array<any> | null | undefined) ?? []

      const equipmentPeriodIds = timePeriods
        .filter((tp: any) => tp.category === 'equipment')
        .map((tp: any) => tp.id as string)
      const transportPeriodIds = timePeriods
        .filter((tp: any) => tp.category === 'transport')
        .map((tp: any) => tp.id as string)
      const crewPeriods = timePeriods
        .filter((tp: any) => tp.category === 'crew')
        .map((tp: any) => ({
          title: (tp.title as string | null) ?? null,
          start_at: tp.start_at as string,
          end_at: tp.end_at as string,
          needed_count: (tp.needed_count as number | null) ?? null,
          role_category: (tp.role_category as string | null) ?? null,
        }))

      const equipment =
        equipmentPeriodIds.length > 0
          ? await (async () => {
              const { data: rows, error: itemsErr } = await supabase
                .from('reserved_items')
                .select('item_id, quantity, source_kind, source_group_id')
                .in('time_period_id', equipmentPeriodIds)

              if (itemsErr) throw itemsErr

              return ((rows as Array<any> | null | undefined) ?? []).map(
                (r: any) => {
                  const sourceKind: 'group' | 'direct' =
                    r.source_kind === 'group' ? 'group' : 'direct'
                  return {
                    item_id: r.item_id as string,
                    quantity: Number(r.quantity ?? 0),
                    source_kind: sourceKind,
                    source_group_id:
                      (r.source_group_id as string | null) ?? null,
                  }
                },
              )
            })()
          : []

      const transport =
        transportPeriodIds.length > 0
          ? await (async () => {
              const { data: rows, error: vehiclesErr } = await supabase
                .from('reserved_vehicles')
                .select('vehicle_id')
                .in('time_period_id', transportPeriodIds)

              if (vehiclesErr) throw vehiclesErr

              return ((rows as Array<any> | null | undefined) ?? [])
                .map((r: any) => ({
                  vehicle_id: r.vehicle_id as string,
                }))
                .filter((r) => !!r.vehicle_id)
            })()
          : []

      return { equipment, crewPeriods, transport }
    },
  })

  const technicalOffers = React.useMemo(
    () => offers.filter((o) => o.offer_type === 'technical'),
    [offers],
  )

  const offerDetailResults = useQueries({
    queries: technicalOffers.map((offer) => ({
      ...offerDetailQuery(offer.id),
      enabled: (isActive ?? true) && technicalOffers.length > 0,
      staleTime: 0,
      refetchOnMount: 'always' as const,
    })),
  })

  const offerDetailsById = React.useMemo(() => {
    const m = new Map<string, OfferDetail>()
    for (const res of offerDetailResults) {
      const offerDetail = res.data
      if (offerDetail?.id) {
        m.set(offerDetail.id, offerDetail)
      }
    }
    return m
  }, [offerDetailResults])

  const groupIdsUsedByOffers = React.useMemo(() => {
    const ids = new Set<string>()
    for (const offerDetail of offerDetailsById.values()) {
      for (const group of offerDetail.groups || []) {
        for (const item of group.items) {
          if (item.group_id) ids.add(item.group_id)
        }
      }
    }
    return Array.from(ids).sort()
  }, [offerDetailsById])

  const groupItemsQuery = useQuery({
    queryKey: ['group-items', ...groupIdsUsedByOffers] as const,
    enabled: (isActive ?? true) && groupIdsUsedByOffers.length > 0,
    staleTime: 0,
    refetchOnMount: 'always',
    queryFn: async (): Promise<
      Map<string, Array<{ item_id: string; quantity: number }>>
    > => {
      const { data, error } = await supabase
        .from('group_items')
        .select('group_id, item_id, quantity')
        .in('group_id', groupIdsUsedByOffers)

      if (error) throw error

      const map = new Map<
        string,
        Array<{ item_id: string; quantity: number }>
      >()
      for (const row of (data as Array<GroupItemRow> | null | undefined) ??
        []) {
        if (!row.group_id || !row.item_id) continue
        const list = map.get(row.group_id) ?? []
        list.push({
          item_id: row.item_id,
          quantity: row.quantity ?? 1,
        })
        map.set(row.group_id, list)
      }
      return map
    },
  })

  const makeEquipmentKey = (row: {
    item_id: string
    source_kind: 'direct' | 'group'
    source_group_id: string | null
  }) => `${row.source_kind}:${row.source_group_id ?? ''}:${row.item_id}`

  const buildCurrentEquipmentMap = React.useCallback(
    (snapshot: BookingsSnapshot) => {
      const m = new Map<string, number>()
      for (const row of snapshot.equipment) {
        const k = makeEquipmentKey(row)
        m.set(k, (m.get(k) ?? 0) + row.quantity)
      }
      // normalize: remove zeroes
      for (const [k, v] of m.entries()) {
        if (!v) m.delete(k)
      }
      return m
    },
    [],
  )

  const buildExpectedEquipmentMap = React.useCallback(
    (
      offerDetail: OfferDetail,
      groupItemsMap: Map<string, Array<{ item_id: string; quantity: number }>>,
    ) => {
      const m = new Map<string, number>()
      for (const group of offerDetail.groups || []) {
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
      // normalize: remove zeroes
      for (const [k, v] of m.entries()) {
        if (!v) m.delete(k)
      }
      return m
    },
    [],
  )

  const mapsEqual = (a: Map<string, number>, b: Map<string, number>) => {
    if (a.size !== b.size) return false
    for (const [k, v] of a.entries()) {
      if ((b.get(k) ?? 0) !== v) return false
    }
    return true
  }

  const parseEquipmentKey = (
    key: string,
  ): { source_kind: 'direct' | 'group'; source_group_id: string | null; item_id: string } => {
    const [source_kind, source_group_id_raw, item_id] = key.split(':')
    return {
      source_kind: source_kind === 'group' ? 'group' : 'direct',
      source_group_id: source_group_id_raw ? source_group_id_raw : null,
      item_id: item_id || '',
    }
  }

  type OfferDiff = {
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

  const computeOfferDiff = React.useCallback(
    (
      snapshot: BookingsSnapshot,
      detail: OfferDetail,
      groupItemsMap: Map<string, Array<{ item_id: string; quantity: number }>>,
    ): OfferDiff => {
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
    },
    [
      buildCurrentEquipmentMap,
      buildExpectedEquipmentMap,
      buildCurrentCrewMap,
      buildExpectedCrewMap,
    ],
  )

  const getOfferDiff = React.useCallback(
    (offer: JobOffer) => {
      if (offer.offer_type !== 'technical') return null

      const snapshot = bookingsSnapshotQuery.data
      const detail = offerDetailsById.get(offer.id)
      if (!snapshot || !detail) return null

      const needsGroupItems = (detail.groups ?? []).some((g) =>
        g.items.some((i) => !!i.group_id),
      )
      if (needsGroupItems && groupItemsQuery.isLoading) return null

      const groupItemsMap = groupItemsQuery.data ?? new Map()
      return computeOfferDiff(snapshot, detail, groupItemsMap)
    },
    [
      bookingsSnapshotQuery.data,
      groupItemsQuery.data,
      groupItemsQuery.isLoading,
      offerDetailsById,
      computeOfferDiff,
    ],
  )

  const diffItemIds = React.useMemo(() => {
    const ids = new Set<string>()
    for (const offer of technicalOffers) {
      const diff = getOfferDiff(offer)
      if (!diff) continue
      for (const ch of diff.equipmentChanges) {
        if (ch.item_id) ids.add(ch.item_id)
      }
    }
    return Array.from(ids).slice(0, 200).sort()
  }, [getOfferDiff, technicalOffers])

  const itemNamesQuery = useQuery({
    queryKey: ['items', 'names', diffItemIds] as const,
    enabled: (isActive ?? true) && diffItemIds.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('items')
        .select('id, name')
        .in('id', diffItemIds)
      if (error) throw error
      const m = new Map<string, string>()
      for (const row of ((data as Array<{ id: string; name: string }> | null) ?? [])) {
        m.set(row.id, row.name)
      }
      return m
    },
  })

  const formatItem = (itemId: string) => {
    const name = itemNamesQuery.data?.get(itemId)
    return name ? `${name}` : itemId
  }

  const buildDiffTooltip = (offer: JobOffer) => {
    const diff = getOfferDiff(offer)
    if (!diff) {
      return (
        <Text size="1" color="gray">
          Loading differences…
        </Text>
      )
    }

    const removedEquipment = diff.equipmentChanges
      .filter((c) => c.current > c.expected)
      .sort((a, b) => b.current - b.expected - (a.current - a.expected))
    const addedEquipment = diff.equipmentChanges
      .filter((c) => c.expected > c.current)
      .sort((a, b) => b.expected - b.current - (a.expected - a.current))

    const removedCrew = diff.crewChanges
      .filter((c) => c.current > c.expected)
      .sort((a, b) => b.current - b.expected - (a.current - a.expected))
    const addedCrew = diff.crewChanges
      .filter((c) => c.expected > c.current)
      .sort((a, b) => b.expected - b.current - (a.expected - a.current))

    const lines: Array<React.ReactNode> = []

    const pushSection = (
      title: string,
      items: Array<React.ReactNode>,
      emptyText: string,
    ) => {
      lines.push(
        <Text key={`${title}-title`} size="1" weight="bold">
          {title}
        </Text>,
      )
      if (items.length === 0) {
        lines.push(
          <Text key={`${title}-empty`} size="1" color="gray">
            {emptyText}
          </Text>,
        )
      } else {
        for (const node of items.slice(0, 8)) lines.push(node)
        if (items.length > 8) {
          lines.push(
            <Text key={`${title}-more`} size="1" color="gray">
              …and {items.length - 8} more
            </Text>,
          )
        }
      }
      lines.push(<Box key={`${title}-spacer`} height="6px" />)
    }

    pushSection(
      'Removed from bookings (present now, not in offer)',
      removedEquipment.map((c) => (
        <Text key={`re-${c.key}`} size="1">
          - {formatItem(c.item_id)}
          {c.source_kind === 'group' ? ' (group)' : ''}: -{c.current - c.expected}
        </Text>
      )),
      'None',
    )

    pushSection(
      'Added to bookings (in offer, missing now)',
      addedEquipment.map((c) => (
        <Text key={`ae-${c.key}`} size="1">
          - {formatItem(c.item_id)}
          {c.source_kind === 'group' ? ' (group)' : ''}: +{c.expected - c.current}
        </Text>
      )),
      'None',
    )

    pushSection(
      'Crew role changes',
      [...removedCrew, ...addedCrew].map((c) => (
        <Text key={`cr-${c.key}`} size="1">
          - {c.title || 'Crew'}: {c.current} → {c.expected}
        </Text>
      )),
      'None',
    )

    if (diff.expectedTransport === null) {
      lines.push(
        <Text key="transport" size="1" color="gray">
          Transport: cannot be strictly compared (offer does not specify vehicles).
        </Text>,
      )
    } else {
      const exp = diff.expectedTransport.join('|')
      const cur = diff.currentTransport.join('|')
      lines.push(
        <Text key="transport" size="1" color={exp === cur ? 'gray' : undefined}>
          Transport: {exp === cur ? 'matches' : 'differs'}
        </Text>,
      )
    }

    return <Box style={{ maxWidth: 360 }}>{lines}</Box>
  }

  function buildExpectedCrewMap(offerDetail: OfferDetail) {
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

  function buildCurrentCrewMap(snapshot: BookingsSnapshot) {
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

  function buildExpectedTransportMultiset(offerDetail: OfferDetail) {
    const expected: Array<string> = []
    for (const item of offerDetail.transport_items || []) {
      if (!item.vehicle_id) return null // can't deterministically verify
      expected.push(item.vehicle_id)
    }
    expected.sort()
    return expected
  }

  function buildCurrentTransportMultiset(snapshot: BookingsSnapshot) {
    const current = snapshot.transport.map((t) => t.vehicle_id).filter(Boolean)
    current.sort()
    return current
  }

  const getOfferSyncStatus = React.useCallback(
    (
      offer: JobOffer,
    ): { label: string; color: 'green' | 'gray'; title: string } => {
      if (offer.offer_type !== 'technical') {
        return {
          label: '—',
          color: 'gray',
          title: 'Only technical offers can sync to bookings.',
        }
      }

      const snapshot = bookingsSnapshotQuery.data
      const detail = offerDetailsById.get(offer.id)

      if (!snapshot || !detail) {
        return {
          label: 'Checking…',
          color: 'gray',
          title: 'Refreshing bookings sync status…',
        }
      }

      if (syncingOfferId === offer.id) {
        return {
          label: 'Checking…',
          color: 'gray',
          title: 'Sync in progress… refreshing status.',
        }
      }

      // If this offer references item groups, we need the group member list to compare accurately.
      const needsGroupItems = (detail.groups ?? []).some((g) =>
        g.items.some((i) => !!i.group_id),
      )
      const groupItemsMap = groupItemsQuery.data ?? new Map()
      if (needsGroupItems && groupItemsQuery.isLoading) {
        return {
          label: 'Checking…',
          color: 'gray',
          title: 'Loading item group definitions…',
        }
      }

      const expectedEquip = buildExpectedEquipmentMap(detail, groupItemsMap)
      const currentEquip = buildCurrentEquipmentMap(snapshot)
      const equipmentMatches = mapsEqual(expectedEquip, currentEquip)

      const expectedCrew = buildExpectedCrewMap(detail)
      const currentCrew = buildCurrentCrewMap(snapshot)
      const crewMatches = mapsEqual(expectedCrew, currentCrew)

      const expectedTransport = buildExpectedTransportMultiset(detail)
      const currentTransport = buildCurrentTransportMultiset(snapshot)
      const transportMatches =
        expectedTransport === null
          ? true
          : expectedTransport.join('|') === currentTransport.join('|')

      const isSyncedNow = equipmentMatches && crewMatches && transportMatches

      if (isSyncedNow) {
        return {
          label: 'Synced',
          color: 'green',
          title:
            expectedTransport === null
              ? 'Offer matches current bookings (transport not strictly verifiable).'
              : 'Offer matches current bookings.',
        }
      }

      const reasons: Array<string> = []
      if (!equipmentMatches) reasons.push('Equipment differs')
      if (!crewMatches) reasons.push('Crew differs')
      if (expectedTransport === null) {
        // Transport is ignored in match calculation when not verifiable
      } else if (!transportMatches) {
        reasons.push('Transport differs')
      }

      return {
        label: 'Not synced',
        color: 'gray',
        title: `Offer does not match current bookings. ${reasons.join(' • ')}`,
      }
    },
    [
      bookingsSnapshotQuery.data,
      buildCurrentEquipmentMap,
      buildExpectedEquipmentMap,
      groupItemsQuery.data,
      groupItemsQuery.isLoading,
      offerDetailsById,
      syncingOfferId,
    ],
  )

  const prevIsActiveRef = React.useRef<boolean>(false)
  React.useEffect(() => {
    const nowActive = isActive ?? true
    const wasActive = prevIsActiveRef.current
    prevIsActiveRef.current = nowActive
    if (!nowActive || wasActive) return

    // Force-refresh whenever the user enters the Offers tab.
    offersQuery.refetch()
    bookingsSnapshotQuery.refetch()
    for (const res of offerDetailResults) {
      res.refetch()
    }
    groupItemsQuery.refetch()
  }, [
    isActive,
    jobId,
    bookingsSnapshotQuery,
    groupItemsQuery,
    offerDetailResults,
    offersQuery,
  ])

  const deleteOfferMutation = useMutation({
    mutationFn: deleteOffer,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['job-offers', jobId] })
      success('Offer deleted', 'The offer has been deleted.')
      setDeleteOpen(null)
    },
    onError: (err: any) => {
      toastError('Failed to delete offer', err?.message || 'Please try again.')
    },
  })

  const duplicateOfferMutation = useMutation({
    mutationFn: duplicateOffer,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['job-offers', jobId] })
      success(
        'Offer duplicated',
        'A new version of the offer has been created.',
      )
    },
    onError: (err: any) => {
      toastError(
        'Failed to duplicate offer',
        err?.message || 'Please try again.',
      )
    },
  })

  const lockOfferMutation = useMutation({
    mutationFn: async (offer: JobOffer) => {
      await lockOffer(offer.id)
      return offer
    },
    onSuccess: (offer) => {
      qc.invalidateQueries({ queryKey: ['job-offers', jobId] })
      // Show the link dialog with the offer (access_token is already available)
      setLinkDialogOpen(offer)
      success('Offer locked', 'The offer has been locked and sent.')
    },
    onError: (err: any) => {
      toastError('Failed to lock offer', err?.message || 'Please try again.')
    },
  })

  // Get current user ID for booking creation
  const { data: user } = useQuery({
    queryKey: ['auth', 'user'],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser()
      return data.user
    },
  })

  const createBookingsMutation = useMutation({
    mutationFn: async (offerId: string) => {
      if (!user?.id) throw new Error('User not authenticated')
      await createBookingsFromOffer(offerId, user.id)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['job-offers', jobId] })
      // Invalidate calendar queries to show new bookings
      qc.invalidateQueries({ queryKey: ['job-calendar', jobId] })
      qc.invalidateQueries({ queryKey: ['time-periods', jobId] })
      invalidateBookingQueries()
      success(
        'Bookings created',
        'Time periods and reservations have been created from the offer.',
      )
    },
    onError: (err: any) => {
      toastError(
        'Failed to create bookings',
        err?.message || 'Please try again.',
      )
    },
  })

  const syncBookingsMutation = useMutation({
    mutationFn: async (offerId: string) => {
      if (!user?.id) throw new Error('User not authenticated')
      return await syncBookingsFromOffer(offerId, user.id)
    },
    onMutate: (offerId) => {
      setSyncingOfferId(offerId)
    },
    onSuccess: (warnings) => {
      qc.invalidateQueries({ queryKey: ['job-offers', jobId] })
      qc.invalidateQueries({ queryKey: ['job-calendar', jobId] })
      qc.invalidateQueries({ queryKey: ['time-periods', jobId] })
      invalidateBookingQueries()
      success('Bookings synced', 'Bookings were synced from the offer.')
      // Re-check immediately so the "Synced" badge updates in realtime.
      offersQuery.refetch()
      bookingsSnapshotQuery.refetch()
      if (warnings.length) {
        info('Booking warnings', warnings.join('\n'), 6000)
      }
    },
    onSettled: () => {
      setSyncingOfferId(null)
      // Defensive refetch: ensures UI settles even if queries were fresh.
      bookingsSnapshotQuery.refetch()
    },
    onError: (err: any) => {
      setSyncingOfferId(null)
      toastError('Failed to sync bookings', err?.message || 'Please try again.')
    },
  })

  const setOfferResponseMutation = useMutation({
    mutationFn: async (payload: {
      offerId: string
      offerTitle: string
      responseType: 'accepted' | 'rejected' | 'revision'
      comment: string
    }) => {
      const now = new Date().toISOString()
      const comment = payload.comment.trim()
      const recordedBy = 'Project lead'

      let jobData: {
        id: string
        title: string | null
        project_lead_user_id: string | null
      } | null = null

      if (payload.responseType === 'revision') {
        const { data, error: jobError } = await supabase
          .from('jobs')
          .select('id, title, project_lead_user_id')
          .eq('id', jobId)
          .single()
        if (jobError) throw jobError
        jobData = data
        if (!jobData.project_lead_user_id) {
          throw new Error(
            'Project lead is missing. Assign a project lead to send the revision matter.',
          )
        }
      }

      const baseUpdate = {
        accepted_at: null,
        accepted_by_name: null,
        accepted_by_phone: null,
        accepted_by_email: null,
        rejected_at: null,
        rejected_by_name: null,
        rejected_by_phone: null,
        rejection_comment: null,
        revision_requested_at: null,
        revision_requested_by_name: null,
        revision_requested_by_phone: null,
        revision_comment: null,
      }

      let update: Record<string, any> = baseUpdate

      if (payload.responseType === 'accepted') {
        update = {
          ...baseUpdate,
          status: 'accepted',
          accepted_at: now,
          accepted_by_name: recordedBy,
          accepted_by_phone: null,
        }
      } else if (payload.responseType === 'rejected') {
        update = {
          ...baseUpdate,
          status: 'rejected',
          rejected_at: now,
          rejected_by_name: recordedBy,
          rejected_by_phone: null,
          rejection_comment: null,
        }
      } else {
        update = {
          ...baseUpdate,
          status: 'viewed',
          revision_requested_at: now,
          revision_requested_by_name: recordedBy,
          revision_requested_by_phone: null,
          revision_comment: comment || null,
        }
      }

      const { error } = await supabase
        .from('job_offers')
        .update(update)
        .eq('id', payload.offerId)

      if (error) throw error

      if (payload.responseType === 'revision') {
        const projectLeadId = jobData?.project_lead_user_id as string
        const jobTitle = jobData?.title?.trim() || 'Job'
        const jobLink = `${window.location.origin}/jobs?jobId=${jobId}`
        const message = comment || 'No message provided.'
        const content = [
          `Customer requested a revision on offer "${payload.offerTitle}".`,
          `Message: ${message}`,
          `Job: ${jobTitle}`,
          `Go to job: ${jobLink}`,
        ].join('\n')

        await createMatter({
          company_id: companyId,
          matter_type: 'update',
          title: `Offer revision requested: ${jobTitle}`,
          content,
          job_id: jobId,
          recipient_user_ids: [projectLeadId],
          created_as_company: true,
        })
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['job-offers', jobId] })
      success('Offer response updated', 'The offer response has been set.')
      setResponseDialogOpen(null)
    },
    onError: (err: any) => {
      toastError(
        'Failed to set offer response',
        err?.message || 'Please try again.',
      )
    },
  })

  const createOfferFromBookingsMutation = useMutation({
    mutationFn: async () => {
      return await createTechnicalOfferFromBookings({ jobId, companyId })
    },
    onSuccess: (newOfferId) => {
      qc.invalidateQueries({ queryKey: ['job-offers', jobId] })
      setEditorType('technical')
      setEditingOfferId(newOfferId)
      setEditorOpen(true)
      success(
        'Offer created',
        'A technical offer was created from the current bookings.',
      )
    },
    onError: (err: any) => {
      toastError(
        'Failed to create offer from bookings',
        err?.message || 'Please try again.',
      )
    },
  })

  const exportPdfMutation = useMutation({
    mutationFn: exportOfferPDF,
    onSuccess: () => {
      success('PDF exported', 'The offer has been exported as PDF.')
    },
    onError: (err: any) => {
      toastError('Failed to export PDF', err?.message || 'Please try again.')
    },
  })

  const [editorType, setEditorType] = React.useState<'technical' | 'pretty'>(
    'technical',
  )

  const handleCreateTechnicalOffer = () => {
    setEditingOfferId(null)
    setEditorType('technical')
    setEditorOpen(true)
  }

  const handleCreatePrettyOffer = () => {
    setEditingOfferId(null)
    setEditorType('pretty')
    setEditorOpen(true)
  }

  const handleCreateOfferFromBookings = () => {
    createOfferFromBookingsMutation.mutate()
  }

  const handleEditOffer = (offer: JobOffer) => {
    if (offer.locked || offer.status !== 'draft') {
      toastError(
        'Cannot edit offer',
        'Only draft offers can be edited. Locked or sent offers cannot be modified.',
      )
      return
    }
    setEditingOfferId(offer.id)
    setEditorOpen(true)
  }

  const handleViewOffer = (offer: JobOffer) => {
    // Open the editor in view mode (read-only)
    setEditingOfferId(offer.id)
    setEditorOpen(true)
  }

  const handleDuplicateOffer = (offer: JobOffer) => {
    duplicateOfferMutation.mutate(offer.id)
  }

  const handleLockOffer = (offer: JobOffer) => {
    lockOfferMutation.mutate(offer)
  }

  const getOfferLink = (offer: JobOffer) => {
    return `${window.location.origin}/offer/${offer.access_token}`
  }

  const handleCopyLink = (offer: JobOffer) => {
    const link = getOfferLink(offer)
    navigator.clipboard
      .writeText(link)
      .then(() => {
        success(
          'Link copied',
          'The offer link has been copied to your clipboard.',
        )
      })
      .catch((err) => {
        toastError('Failed to copy link', err?.message || 'Please try again.')
      })
  }

  const handleCreateBookings = (offer: JobOffer) => {
    if (!user?.id) {
      toastError('Authentication required', 'Please log in to create bookings.')
      return
    }
    createBookingsMutation.mutate(offer.id)
  }

  const fetchGroupItemsMap = React.useCallback(
    async (groupIds: Array<string>) => {
      const ids = Array.from(new Set(groupIds)).filter(Boolean)
      if (ids.length === 0) return new Map<string, Array<{ item_id: string; quantity: number }>>()

      const { data, error } = await supabase
        .from('group_items')
        .select('group_id, item_id, quantity')
        .in('group_id', ids)

      if (error) throw error

      const map = new Map<string, Array<{ item_id: string; quantity: number }>>()
      for (const row of (data as Array<GroupItemRow> | null | undefined) ?? []) {
        if (!row.group_id || !row.item_id) continue
        const list = map.get(row.group_id) ?? []
        list.push({ item_id: row.item_id, quantity: row.quantity ?? 1 })
        map.set(row.group_id, list)
      }
      return map
    },
    [],
  )

  const fetchOfferDiffForSync = React.useCallback(
    async (offer: JobOffer): Promise<OfferDiff | null> => {
      if (offer.offer_type !== 'technical') return null

      const snapshotResult = await bookingsSnapshotQuery.refetch()
      const snapshot = snapshotResult.data
      const detail = await qc.fetchQuery(offerDetailQuery(offer.id))
      if (!snapshot || !detail) return null

      const groupIds: Array<string> = []
      for (const group of detail.groups ?? []) {
        for (const item of group.items) {
          if (item.group_id) groupIds.push(item.group_id)
        }
      }
      const groupItemsMap = await fetchGroupItemsMap(groupIds)
      return computeOfferDiff(snapshot, detail, groupItemsMap)
    },
    [bookingsSnapshotQuery, computeOfferDiff, fetchGroupItemsMap, qc],
  )

  const handleSyncBookings = React.useCallback(async (offer: JobOffer) => {
    if (!user?.id) {
      toastError('Authentication required', 'Please log in to sync bookings.')
      return
    }
    // If syncing would remove anything, warn before proceeding.
    let diff: OfferDiff | null = null
    try {
      diff = await fetchOfferDiffForSync(offer)
    } catch (e: any) {
      toastError(
        'Failed to check booking changes',
        e?.message || 'Please try again.',
      )
      return
    }
    if (!diff) {
      info(
        'Just a sec…',
        'Loading differences so we can warn you about removals. Try again in a moment.',
      )
      offersQuery.refetch()
      bookingsSnapshotQuery.refetch()
      groupItemsQuery.refetch()
      return
    }

    const equipmentRemovals: Array<string> = []
    const crewRemovals: Array<string> = []
    const transportRemovals: Array<string> = []

    const removedEquipment = diff.equipmentChanges
      .filter((c) => c.current > c.expected)
      .sort((a, b) => (b.current - b.expected) - (a.current - a.expected))
    for (const c of removedEquipment.slice(0, 10)) {
      equipmentRemovals.push(
        `Equipment: ${formatItem(c.item_id)}${c.source_kind === 'group' ? ' (group)' : ''} (-${c.current - c.expected})`,
      )
    }
    if (removedEquipment.length > 10) {
      equipmentRemovals.push(
        `…and ${removedEquipment.length - 10} more equipment removals`,
      )
    }

    const removedCrew = diff.crewChanges
      .filter((c) => c.current > c.expected)
      .sort((a, b) => (b.current - b.expected) - (a.current - a.expected))
    for (const c of removedCrew.slice(0, 10)) {
      crewRemovals.push(`${c.title || 'Crew'} (${c.current} → ${c.expected})`)
    }
    if (removedCrew.length > 10) {
      crewRemovals.push(`…and ${removedCrew.length - 10} more crew removals`)
    }

    // Transport removals (best-effort)
    if (diff.expectedTransport === null) {
      if (diff.currentTransport.length > 0) {
        transportRemovals.push(
          `Transport: existing vehicle bookings may be replaced (${diff.currentTransport.length} current)`,
        )
      }
    } else {
      const expectedSet = new Set(diff.expectedTransport)
      const removedVehicles = diff.currentTransport.filter(
        (id) => !expectedSet.has(id),
      )
      if (removedVehicles.length > 0) {
        transportRemovals.push(
          `${removedVehicles.length} vehicle booking(s) will be removed/replaced`,
        )
      }
    }

    const totalRemovalCount =
      equipmentRemovals.length + crewRemovals.length + transportRemovals.length
    if (totalRemovalCount > 0) {
      setSyncConfirm({
        offer,
        removals: {
          equipment: equipmentRemovals,
          crew: crewRemovals,
          transport: transportRemovals,
        },
      })
      return
    }

    setSyncingOfferId(offer.id)
    syncBookingsMutation.mutate(offer.id)
  }, [
    bookingsSnapshotQuery,
    fetchOfferDiffForSync,
    groupItemsQuery,
    info,
    offersQuery,
    syncBookingsMutation,
    toastError,
    user?.id,
  ])

  const handleExportPDF = (offer: JobOffer) => {
    exportPdfMutation.mutate(offer.id)
  }

  const openResponseDialog = (offer: JobOffer) => {
    setResponseDialogOpen(offer)
    setResponseType('accepted')
    setResponseComment('')
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('nb-NO', {
      style: 'currency',
      currency: 'NOK',
      minimumFractionDigits: 2,
    }).format(amount)
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '—'
    return new Date(dateString).toLocaleDateString('nb-NO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  return (
    <Box>
      <Flex mb="3" justify="between" align="center">
        <Heading size="3">Offers</Heading>
        {!isReadOnly && (
          <Flex gap="2">
            <Button
              size="2"
              variant="outline"
              onClick={() => setCreateDialogOpen(true)}
            >
              <Plus width={16} height={16} /> New Offer
            </Button>
          </Flex>
        )}
      </Flex>

      {isLoading ? (
        <Text>Loading offers...</Text>
      ) : offers.length === 0 && !isReadOnly ? (
        <Box
          p="4"
          style={{
            border: '2px dashed var(--gray-a6)',
            borderRadius: 8,
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'all 100ms',
          }}
          onClick={() => setCreateDialogOpen(true)}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--gray-a8)'
            e.currentTarget.style.background = 'var(--gray-a2)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--gray-a6)'
            e.currentTarget.style.background = 'transparent'
          }}
        >
          <Flex direction="column" align="center" gap="2">
            <Plus width={24} height={24} />
            <Text size="2" color="gray">
              Create your first offer
            </Text>
          </Flex>
        </Box>
      ) : offers.length === 0 && isReadOnly ? (
        <Box
          p="4"
          style={{
            border: '2px dashed var(--gray-a6)',
            borderRadius: 8,
            textAlign: 'center',
          }}
        >
          <Text size="3" color="gray">
            No offers yet
          </Text>
        </Box>
      ) : (
        <Box style={{ overflowX: 'auto' }}>
          <Table.Root variant="surface" style={{ minWidth: 1060 }}>
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeaderCell>Version</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Type</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Status</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Synced</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Title</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Total</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Created</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Actions</Table.ColumnHeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {offers.map((offer) => (
                <Table.Row key={offer.id}>
                  <Table.Cell>
                    <Flex align="center" gap="2">
                      <Text>v{offer.version_number}</Text>
                      {offer.locked && (
                        <Lock width={14} height={14} color="var(--orange-9)" />
                      )}
                    </Flex>
                  </Table.Cell>
                  <Table.Cell>
                    <Badge variant="soft">
                      {getOfferTypeLabel(offer.offer_type)}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <Flex direction="column" gap="1">
                      <Badge
                        radius="full"
                        color={getOfferStatusBadgeColor(offer)}
                        highContrast
                      >
                        {getOfferStatusLabel(offer)}
                      </Badge>
                      {offer.revision_requested_at && (
                        <Button
                          size="1"
                          variant="ghost"
                          onClick={() => setRevisionMessageOffer(offer)}
                        >
                          Show message
                        </Button>
                      )}
                    </Flex>
                  </Table.Cell>
                  <Table.Cell>
                    {(() => {
                      const status = getOfferSyncStatus(offer)
                      const showInfo =
                        status.label === 'Not synced' &&
                        offer.offer_type === 'technical'
                      return (
                        <Flex align="center" gap="2">
                          <Badge
                            variant="soft"
                            color={status.color}
                            title={status.title}
                          >
                            {status.label}
                          </Badge>
                          {showInfo && (
                            <Tooltip content={buildDiffTooltip(offer)}>
                              <IconButton
                                size="1"
                                variant="ghost"
                                aria-label="Show differences"
                              >
                                <InfoCircle width={14} height={14} />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Flex>
                      )
                    })()}
                  </Table.Cell>
                  <Table.Cell>
                    <Text weight="medium">{offer.title}</Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Text>
                      {offer.total_with_vat && offer.total_with_vat > 0
                        ? formatCurrency(offer.total_with_vat)
                        : '—'}
                    </Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Text size="2">{formatDate(offer.created_at)}</Text>
                  </Table.Cell>
                  <Table.Cell style={{ width: 56, minWidth: 56 }}>
                    {(() => {
                      const canView = offer.locked
                      const canEdit = !offer.locked && !isReadOnly
                      const canCopyLink =
                        offer.locked && offer.status !== 'draft'
                      const canManage = !isReadOnly
                      const hasAnyAction =
                        canView || canEdit || canCopyLink || canManage

                      if (!hasAnyAction) return null

                      return (
                        <Flex justify="end">
                          <DropdownMenu.Root>
                            <DropdownMenu.Trigger>
                              <IconButton
                                size="1"
                                variant="ghost"
                                aria-label="Offer actions"
                                title="Actions"
                              >
                                <Text
                                  size="4"
                                  style={{
                                    lineHeight: 1,
                                    transform: 'translateY(-1px)',
                                  }}
                                >
                                  ⋯
                                </Text>
                              </IconButton>
                            </DropdownMenu.Trigger>
                            <DropdownMenu.Content align="end">
                              {offer.offer_type === 'technical' ? (
                                <>
                                  {offer.locked ? (
                                    <DropdownMenu.Item
                                      onSelect={() => {
                                        setEditorType('technical')
                                        handleViewOffer(offer)
                                      }}
                                    >
                                      <Flex align="center" gap="2">
                                        <Eye width={14} height={14} />
                                        <Text>View</Text>
                                      </Flex>
                                    </DropdownMenu.Item>
                                  ) : (
                                    !isReadOnly && (
                                      <DropdownMenu.Item
                                        onSelect={() => {
                                          setEditorType('technical')
                                          handleEditOffer(offer)
                                        }}
                                      >
                                        <Flex align="center" gap="2">
                                          <Edit width={14} height={14} />
                                          <Text>Edit</Text>
                                        </Flex>
                                      </DropdownMenu.Item>
                                    )
                                  )}
                                </>
                              ) : (
                                <>
                                  {offer.locked ? (
                                    <DropdownMenu.Item
                                      onSelect={() => {
                                        setEditorType('pretty')
                                        handleViewOffer(offer)
                                      }}
                                    >
                                      <Flex align="center" gap="2">
                                        <Eye width={14} height={14} />
                                        <Text>View</Text>
                                      </Flex>
                                    </DropdownMenu.Item>
                                  ) : (
                                    !isReadOnly && (
                                      <DropdownMenu.Item
                                        onSelect={() => {
                                          setEditorType('pretty')
                                          handleEditOffer(offer)
                                        }}
                                      >
                                        <Flex align="center" gap="2">
                                          <Edit width={14} height={14} />
                                          <Text>Edit</Text>
                                        </Flex>
                                      </DropdownMenu.Item>
                                    )
                                  )}
                                </>
                              )}

                              {canCopyLink && (
                                <DropdownMenu.Item
                                  onSelect={() => handleCopyLink(offer)}
                                >
                                  <Flex align="center" gap="2">
                                    <Link width={14} height={14} />
                                    <Text>Copy link</Text>
                                  </Flex>
                                </DropdownMenu.Item>
                              )}

                              {!isReadOnly && (
                                <>
                                  <DropdownMenu.Separator />
                                  <DropdownMenu.Item
                                    onSelect={() => handleDuplicateOffer(offer)}
                                    disabled={duplicateOfferMutation.isPending}
                                  >
                                    <Flex align="center" gap="2">
                                      <Copy width={14} height={14} />
                                      <Text>Duplicate</Text>
                                    </Flex>
                                  </DropdownMenu.Item>
                                  {!offer.locked && (
                                    <DropdownMenu.Item
                                      onSelect={() => handleLockOffer(offer)}
                                      disabled={lockOfferMutation.isPending}
                                    >
                                      <Flex align="center" gap="2">
                                        <Lock width={14} height={14} />
                                        <Text>Lock &amp; send</Text>
                                      </Flex>
                                    </DropdownMenu.Item>
                                  )}
                                  {offer.status === 'accepted' && (
                                    <DropdownMenu.Item
                                      onSelect={() =>
                                        handleCreateBookings(offer)
                                      }
                                      disabled={createBookingsMutation.isPending}
                                    >
                                      <Flex align="center" gap="2">
                                        <Calendar width={14} height={14} />
                                        <Text>Create bookings</Text>
                                      </Flex>
                                    </DropdownMenu.Item>
                                  )}
                                  {offer.offer_type === 'technical' && (
                                    <DropdownMenu.Item
                                      onSelect={() => handleSyncBookings(offer)}
                                      disabled={syncBookingsMutation.isPending}
                                    >
                                      <Flex align="center" gap="2">
                                        <Refresh width={14} height={14} />
                                        <Text>Sync bookings</Text>
                                      </Flex>
                                    </DropdownMenu.Item>
                                  )}
                                  <DropdownMenu.Item
                                    onSelect={() => handleExportPDF(offer)}
                                    disabled={exportPdfMutation.isPending}
                                  >
                                    <Flex align="center" gap="2">
                                      <Download width={14} height={14} />
                                      <Text>Export PDF</Text>
                                    </Flex>
                                  </DropdownMenu.Item>
                                  <DropdownMenu.Item
                                    onSelect={() => openResponseDialog(offer)}
                                  >
                                    <Flex align="center" gap="2">
                                      <Edit width={14} height={14} />
                                      <Text>Set response</Text>
                                    </Flex>
                                  </DropdownMenu.Item>
                                  <DropdownMenu.Separator />
                                  <DropdownMenu.Item
                                    onSelect={() => setDeleteOpen(offer)}
                                  >
                                    <Flex align="center" gap="2">
                                      <Trash width={14} height={14} />
                                      <Text>Delete</Text>
                                    </Flex>
                                  </DropdownMenu.Item>
                                </>
                              )}
                            </DropdownMenu.Content>
                          </DropdownMenu.Root>
                        </Flex>
                      )
                    })()}
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
        </Box>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteOpen && (
        <Dialog.Root
          open={!!deleteOpen}
          onOpenChange={(v) => !v && setDeleteOpen(null)}
        >
          <Dialog.Content maxWidth="450px">
            <Dialog.Title>Delete Offer?</Dialog.Title>
            <Separator my="3" />
            <Text size="2">
              Are you sure you want to delete this offer? This action cannot be
              undone.
            </Text>
            <Box
              mt="3"
              p="3"
              style={{
                background: 'var(--gray-a2)',
                borderRadius: 8,
              }}
            >
              <Flex direction="column" gap="1">
                <Text size="2">
                  <strong>Title:</strong> {deleteOpen.title}
                </Text>
                <Text size="2">
                  <strong>Type:</strong>{' '}
                  {getOfferTypeLabel(deleteOpen.offer_type)}
                </Text>
                <Text size="2">
                  <strong>Status:</strong> {deleteOpen.status}
                </Text>
                <Text size="2">
                  <strong>Version:</strong> {deleteOpen.version_number}
                </Text>
              </Flex>
            </Box>
            <Flex gap="2" mt="4" justify="end">
              <Dialog.Close>
                <Button variant="soft" disabled={deleteOfferMutation.isPending}>
                  Cancel
                </Button>
              </Dialog.Close>
              <Button
                color="red"
                onClick={() => deleteOfferMutation.mutate(deleteOpen.id)}
                disabled={deleteOfferMutation.isPending}
              >
                {deleteOfferMutation.isPending ? 'Deleting...' : 'Delete'}
              </Button>
            </Flex>
          </Dialog.Content>
        </Dialog.Root>
      )}

      {/* Sync Confirmation Dialog (only when removals are detected) */}
      {syncConfirm && (
        <Dialog.Root
          open={!!syncConfirm}
          onOpenChange={(v) => !v && setSyncConfirm(null)}
        >
          <Dialog.Content maxWidth="560px">
            <Dialog.Title>Sync bookings from this offer?</Dialog.Title>
            <Separator my="3" />
            <Callout.Root color="yellow">
              <Callout.Icon>
                <InfoCircle width={18} height={18} />
              </Callout.Icon>
              <Callout.Text>
                This sync will <strong>remove or reduce</strong> existing bookings
                so they match the offer.
              </Callout.Text>
            </Callout.Root>

            <Box
              mt="3"
              p="3"
              style={{
                background: 'var(--gray-a2)',
                border: '1px solid var(--gray-a6)',
                borderRadius: 8,
              }}
            >
              <Flex direction="column" gap="3">
                {syncConfirm.removals.equipment.length > 0 && (
                  <Box>
                    <Text size="2" weight="bold">
                      Equipment
                    </Text>
                    <Flex direction="column" gap="1" mt="2">
                      {syncConfirm.removals.equipment.map((line, idx) => (
                        <Text key={`equip-${idx}`} size="2">
                          - {line.replace(/^Equipment:\s*/, '')}
                        </Text>
                      ))}
                    </Flex>
                  </Box>
                )}

                {syncConfirm.removals.crew.length > 0 && (
                  <Box>
                    <Text size="2" weight="bold">
                      Crew
                    </Text>
                    <Flex direction="column" gap="1" mt="2">
                      {syncConfirm.removals.crew.map((line, idx) => (
                        <Text key={`crew-${idx}`} size="2">
                          - {line}
                        </Text>
                      ))}
                    </Flex>
                  </Box>
                )}

                {syncConfirm.removals.transport.length > 0 && (
                  <Box>
                    <Text size="2" weight="bold">
                      Vehicles
                    </Text>
                    <Flex direction="column" gap="1" mt="2">
                      {syncConfirm.removals.transport.map((line, idx) => (
                        <Text key={`transport-${idx}`} size="2">
                          - {line.replace(/^Transport:\s*/, '')}
                        </Text>
                      ))}
                    </Flex>
                  </Box>
                )}
              </Flex>
            </Box>

            <Flex gap="2" mt="4" justify="end">
              <Dialog.Close>
                <Button
                  color="yellow"
                  variant="soft"
                  disabled={syncBookingsMutation.isPending}
                >
                  Cancel
                </Button>
              </Dialog.Close>
              <Button
                color="yellow"
                variant="surface"
                onClick={() => {
                  setSyncingOfferId(syncConfirm.offer.id)
                  syncBookingsMutation.mutate(syncConfirm.offer.id)
                  setSyncConfirm(null)
                }}
                disabled={syncBookingsMutation.isPending}
              >
                {syncBookingsMutation.isPending
                  ? 'Syncing…'
                  : 'Sync & replace bookings'}
              </Button>
            </Flex>
          </Dialog.Content>
        </Dialog.Root>
      )}

      {/* Create Offer Dialog */}
      {!isReadOnly && (
        <Dialog.Root
          open={createDialogOpen}
          onOpenChange={(v) => setCreateDialogOpen(v)}
        >
          <Dialog.Content maxWidth="500px">
            <Dialog.Title>Create New Offer</Dialog.Title>
            <Separator my="3" />
            <Text size="2" mb="3">
              Choose how you want to create the offer:
            </Text>
            <Flex direction="column" gap="2">
              <Box
                p="3"
                style={{
                  border: '1px solid var(--gray-a6)',
                  borderRadius: 8,
                  cursor: 'pointer',
                  transition: 'all 100ms',
                }}
                role="button"
                tabIndex={0}
                onClick={() => {
                  setCreateDialogOpen(false)
                  handleCreateTechnicalOffer()
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setCreateDialogOpen(false)
                    handleCreateTechnicalOffer()
                  }
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--gray-a8)'
                  e.currentTarget.style.background = 'var(--gray-a2)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--gray-a6)'
                  e.currentTarget.style.background = 'transparent'
                }}
              >
                <Flex align="center" gap="2" mb="1">
                  <Plus width={16} height={16} />
                  <Text weight="medium">Create Technical Offer</Text>
                </Flex>
                <Text size="2" color="gray">
                  Build a detailed technical offer from scratch.
                </Text>
              </Box>
              <Box
                p="3"
                style={{
                  border: '1px solid var(--gray-a6)',
                  borderRadius: 8,
                  cursor: createOfferFromBookingsMutation.isPending
                    ? 'not-allowed'
                    : 'pointer',
                  opacity: createOfferFromBookingsMutation.isPending ? 0.6 : 1,
                  transition: 'all 100ms',
                }}
                role="button"
                tabIndex={createOfferFromBookingsMutation.isPending ? -1 : 0}
                onClick={() => {
                  if (createOfferFromBookingsMutation.isPending) return
                  setCreateDialogOpen(false)
                  handleCreateOfferFromBookings()
                }}
                onKeyDown={(e) => {
                  if (createOfferFromBookingsMutation.isPending) return
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setCreateDialogOpen(false)
                    handleCreateOfferFromBookings()
                  }
                }}
                onMouseEnter={(e) => {
                  if (createOfferFromBookingsMutation.isPending) return
                  e.currentTarget.style.borderColor = 'var(--gray-a8)'
                  e.currentTarget.style.background = 'var(--gray-a2)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--gray-a6)'
                  e.currentTarget.style.background = 'transparent'
                }}
              >
                <Flex align="center" gap="2" mb="1">
                  <Import width={16} height={16} />
                  <Text weight="medium">Create Offer from Bookings</Text>
                </Flex>
                <Text size="2" color="gray">
                  Creates a technical offer based on the current bookings.
                </Text>
              </Box>
              <Box
                p="3"
                style={{
                  border: '1px solid var(--gray-a6)',
                  borderRadius: 8,
                  cursor: 'pointer',
                  transition: 'all 100ms',
                }}
                role="button"
                tabIndex={0}
                onClick={() => {
                  setCreateDialogOpen(false)
                  handleCreatePrettyOffer()
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setCreateDialogOpen(false)
                    handleCreatePrettyOffer()
                  }
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--gray-a8)'
                  e.currentTarget.style.background = 'var(--gray-a2)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--gray-a6)'
                  e.currentTarget.style.background = 'transparent'
                }}
              >
                <Flex align="center" gap="2" mb="1">
                  <Plus width={16} height={16} />
                  <Text weight="medium">Create Pretty Offer</Text>
                </Flex>
                <Text size="2" color="gray">
                  Create a customer-friendly offer with a polished layout.
                </Text>
              </Box>
            </Flex>
            <Flex gap="2" mt="4" justify="end">
              <Dialog.Close>
                <Button variant="soft">Close</Button>
              </Dialog.Close>
            </Flex>
          </Dialog.Content>
        </Dialog.Root>
      )}

      {/* Offer Link Dialog */}
      {linkDialogOpen && (
        <Dialog.Root
          open={!!linkDialogOpen}
          onOpenChange={(v) => !v && setLinkDialogOpen(null)}
        >
          <Dialog.Content maxWidth="500px">
            <Dialog.Title>Offer Link Ready</Dialog.Title>
            <Separator my="3" />
            <Text size="2" mb="3">
              The offer has been locked and is ready to share. Copy the link
              below to send it to your customer:
            </Text>
            <Flex gap="2" align="center">
              <TextField.Root
                readOnly
                value={getOfferLink(linkDialogOpen)}
                style={{ flex: 1 }}
              />
              <CopyIconButton text={getOfferLink(linkDialogOpen)} />
            </Flex>
            <Text size="1" color="gray" mt="2">
              This link allows anyone to view and accept the offer without
              logging in.
            </Text>
            <Flex gap="2" mt="4" justify="end">
              <Dialog.Close>
                <Button variant="soft">Close</Button>
              </Dialog.Close>
              <Button
                onClick={() => {
                  window.open(getOfferLink(linkDialogOpen), '_blank')
                }}
              >
                Open in New Tab
              </Button>
            </Flex>
          </Dialog.Content>
        </Dialog.Root>
      )}

      {/* Offer Editor */}
      {editorOpen && editorType === 'technical' && (
        <TechnicalOfferEditor
          open={editorOpen}
          onOpenChange={(open) => {
            setEditorOpen(open)
            if (!open) {
              setEditingOfferId(null)
            }
          }}
          jobId={jobId}
          companyId={companyId}
          offerId={editingOfferId}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ['job-offers', jobId] })
          }}
          onSyncBookingsAfterSave={async (offerId) => {
            try {
              // Ensure the new offer exists in the list, then run the exact same
              // sync flow as the "Sync Bookings" action (including removal warnings
              // and synced badge refresh).
              await qc.invalidateQueries({ queryKey: ['job-offers', jobId] })
              const list = await qc.fetchQuery(jobOffersQuery(jobId))
              const createdOffer = list.find((o) => o.id === offerId)
              if (!createdOffer) {
                toastError(
                  'Offer not found',
                  'The offer was saved but could not be found to sync bookings.',
                )
                return
              }
              await handleSyncBookings(createdOffer)
            } catch (e: any) {
              toastError(
                'Failed to sync bookings',
                e?.message || 'Please try again.',
              )
            }
          }}
        />
      )}
      {editorOpen && editorType === 'pretty' && (
        <PrettyOfferEditor
          open={editorOpen}
          onOpenChange={(open) => {
            setEditorOpen(open)
            if (!open) {
              setEditingOfferId(null)
            }
          }}
          jobId={jobId}
          companyId={companyId}
          offerId={editingOfferId}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ['job-offers', jobId] })
          }}
        />
      )}

      {/* Set Offer Response Dialog */}
      {!isReadOnly && responseDialogOpen && (
        <Dialog.Root
          open={!!responseDialogOpen}
          onOpenChange={(open) => {
            setResponseDialogOpen(open ? responseDialogOpen : null)
            if (!open) {
              setResponseType('accepted')
              setResponseComment('')
            }
          }}
        >
          <Dialog.Content maxWidth="520px">
            <Dialog.Title>Set offer response</Dialog.Title>
            <Separator my="3" />
            <Flex direction="column" gap="3">
              <Box>
                <Text size="2" weight="medium" mb="1">
                  Response
                </Text>
                <RadioCards.Root
                  value={responseType}
                  onValueChange={(value) =>
                    setResponseType(
                      value as 'accepted' | 'rejected' | 'revision',
                    )
                  }
                >
                  <Flex gap="3" wrap="wrap">
                    <RadioCards.Item value="accepted">
                      <Text weight="medium">Accepted</Text>
                    </RadioCards.Item>
                    <RadioCards.Item value="rejected">
                      <Text weight="medium">Rejected</Text>
                    </RadioCards.Item>
                    <RadioCards.Item value="revision">
                      <Text weight="medium">Wants revision</Text>
                    </RadioCards.Item>
                  </Flex>
                </RadioCards.Root>
                <Text size="1" color="gray" mt="2">
                  Recorded by the project lead.
                </Text>
              </Box>
              {responseType === 'revision' && (
                <Box>
                  <Text size="2" weight="medium" mb="1">
                    Message to customer
                  </Text>
                  <TextArea
                    placeholder="Add the revision request message..."
                    rows={4}
                    value={responseComment}
                    onChange={(e) => setResponseComment(e.target.value)}
                  />
                </Box>
              )}
            </Flex>
            <Flex gap="2" mt="4" justify="end">
              <Dialog.Close>
                <Button variant="soft">Cancel</Button>
              </Dialog.Close>
              <Button
                onClick={() => {
                  setOfferResponseMutation.mutate({
                    offerId: responseDialogOpen.id,
                    offerTitle: responseDialogOpen.title,
                    responseType,
                    comment: responseComment,
                  })
                }}
                disabled={setOfferResponseMutation.isPending}
              >
                {setOfferResponseMutation.isPending
                  ? 'Saving...'
                  : 'Set response'}
              </Button>
            </Flex>
          </Dialog.Content>
        </Dialog.Root>
      )}
      {revisionMessageOffer && (
        <Dialog.Root
          open={!!revisionMessageOffer}
          onOpenChange={(open) => !open && setRevisionMessageOffer(null)}
        >
          <Dialog.Content maxWidth="520px">
            <Dialog.Title>Revision request</Dialog.Title>
            <Separator my="3" />
            <Flex direction="column" gap="2">
              <Text size="1" color="gray">
                Signed by
              </Text>
              <Text size="2" weight="medium">
                {revisionMessageOffer.revision_requested_by_name || '—'}
              </Text>
              <Box
                mt="2"
                p="3"
                style={{ background: 'var(--gray-a2)', borderRadius: 8 }}
              >
                <Text size="1" color="gray" mb="1">
                  Revision text
                </Text>
                <br />
                <Text size="2">
                  {revisionMessageOffer.revision_comment?.trim() ||
                    'No message provided.'}
                </Text>
              </Box>
            </Flex>
            <Flex gap="2" mt="4" justify="end">
              <Dialog.Close>
                <Button variant="soft">Close</Button>
              </Dialog.Close>
            </Flex>
          </Dialog.Content>
        </Dialog.Root>
      )}
    </Box>
  )
}
