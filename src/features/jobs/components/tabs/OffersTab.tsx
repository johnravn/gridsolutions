// src/features/jobs/components/tabs/OffersTab.tsx
import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Badge,
  Box,
  Button,
  Callout,
  Card,
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
  Copy,
  Download,
  Edit,
  Eye,
  InfoCircle,
  Link,
  Lock,
  NavArrowDown,
  NavArrowRight,
  Plus,
  Refresh,
  Sparks,
  Trash,
  Wrench,
} from 'iconoir-react'
import { useToast } from '@shared/ui/toast/ToastProvider'
import { useCompanyWriteAccess } from '@features/demo/hooks/useCompanyWriteAccess'
import { supabase } from '@shared/api/supabase'
import { CopyIconButton } from '@shared/lib/CopyIconButton'
import { ForceBookingDialog } from '@features/conflicts/components/ForceBookingDialog'
import {
  OVERLAP_NEEDS_FORCE,
  isBookingOverlapError,
} from '@features/conflicts/api/forceBooking'
import {
  createBookingsFromOfferBasis,
  createEmptyOfferBasis,
  deleteOfferBasis,
  duplicateOfferBasis,
  jobOfferBasesQuery,
  offerBasisDetailQuery,
  syncBookingsFromOfferBasis,
} from '../../api/offerBasisQueries'
import {
  createOffer,
  deleteOffer,
  duplicateOffer,
  exportOfferPDF,
  lockOffer,
  recalculateOfferTotals,
} from '../../api/offerQueries'
import { createEmptyDraftPrettyOffer } from '../../api/prettyOfferQueries'
import { JobBookingRecap } from '../JobBookingRecap'
import OfferBasisEditor from '../dialogs/OfferBasisEditor'
import PrettyOfferEditor from '../dialogs/PrettyOfferEditor'
import TechnicalOfferEditor from '../dialogs/TechnicalOfferEditor'
import {
  buildBasisVersionById,
  buildOfferSubVersionById,
  formatBasisVersionLabel,
  formatOfferNumberDisplay,
  formatOfferVersionOnBasis,
  getMaxLockedBasisVersion,
} from '../../utils/offerNumber'
import {
  EMPTY_JOB_BOOKING_SUMMARY,
  buildOfferBasisBookingSummary,
} from '../../utils/bookingSummary'
import { OffersStructureHelpDialog } from '../OffersStructureHelpDialog'
import { PrettyOfferBetaBadge } from '../PrettyOfferBetaBadge'
import type { JobOfferBasisRow } from '../../api/offerBasisQueries'
import type { OverlapConflict } from '@features/conflicts/api/overlapChecks'
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

type SyncLineItems = Pick<
  OfferDetail,
  'groups' | 'crew_items' | 'transport_items' | 'transport_groups'
>

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

function offerDaySpanBetween(start?: string | null, end?: string | null) {
  if (!start || !end) return 1
  const startDate = new Date(start)
  const endDate = new Date(end)
  const diffMs = endDate.getTime() - startDate.getTime()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
  return Math.max(1, diffDays)
}

function makeEquipmentKey(row: {
  item_id: string
  source_kind: 'direct' | 'group'
  source_group_id: string | null
}) {
  return `${row.source_kind}:${row.source_group_id ?? ''}:${row.item_id}`
}

function parseEquipmentKey(key: string): {
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

function mapsEqual(a: Map<string, number>, b: Map<string, number>) {
  if (a.size !== b.size) return false
  for (const [k, v] of a.entries()) {
    if ((b.get(k) ?? 0) !== v) return false
  }
  return true
}

function buildExpectedCrewMap(offerDetail: SyncLineItems) {
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

function buildExpectedTransportMultiset(offerDetail: SyncLineItems) {
  const expected: Array<string> = []
  for (const item of offerDetail.transport_items || []) {
    if (!item.vehicle_id) return null
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

export default function OffersTab({
  jobId,
  companyId,
  isActive,
}: {
  jobId: string
  companyId: string
  isActive?: boolean
}) {
  const { isReadOnly } = useCompanyWriteAccess()
  const [syncingBasisId, setSyncingBasisId] = React.useState<string | null>(
    null,
  )
  const [syncConfirm, setSyncConfirm] = React.useState<{
    basisId: string
    basisTitle: string
    removals: {
      equipment: Array<string>
      crew: Array<string>
      transport: Array<string>
    }
  } | null>(null)
  const [forceDialogOpen, setForceDialogOpen] = React.useState(false)
  const [forceSummaryLines, setForceSummaryLines] = React.useState<
    Array<string>
  >([])
  const [forceConflicts, setForceConflicts] = React.useState<
    Array<OverlapConflict>
  >([])
  const pendingForceBookingRef = React.useRef<{
    basisId: string
    action: 'sync' | 'create'
  } | null>(null)
  const [deleteOpen, setDeleteOpen] = React.useState<JobOffer | null>(null)
  const [deleteBasisOpen, setDeleteBasisOpen] =
    React.useState<JobOfferBasisRow | null>(null)
  const [technicalEditorOpen, setTechnicalEditorOpen] = React.useState(false)
  const [prettyEditorOpen, setPrettyEditorOpen] = React.useState(false)
  const [basisEditorOpen, setBasisEditorOpen] = React.useState(false)
  const [editingOfferId, setEditingOfferId] = React.useState<string | null>(
    null,
  )
  const [editingBasisId, setEditingBasisId] = React.useState<string | null>(
    null,
  )
  const [prettyOfferBasisId, setPrettyOfferBasisId] = React.useState<
    string | undefined
  >(undefined)
  const [linkDialogOpen, setLinkDialogOpen] = React.useState<JobOffer | null>(
    null,
  )
  const [responseDialogOpen, setResponseDialogOpen] =
    React.useState<JobOffer | null>(null)
  const [responseType, setResponseType] = React.useState<
    'accepted' | 'rejected' | 'revision'
  >('accepted')
  const [responseComment, setResponseComment] = React.useState('')
  const [revisionMessageOffer, setRevisionMessageOffer] =
    React.useState<JobOffer | null>(null)
  const [expandedOlderBasisIds, setExpandedOlderBasisIds] = React.useState<
    Set<string>
  >(() => new Set())

  const qc = useQueryClient()
  const { success, error: toastError, info } = useToast()

  const invalidateOfferQueries = React.useCallback(() => {
    qc.invalidateQueries({ queryKey: ['job-offer-bases', jobId] })
    qc.invalidateQueries({ queryKey: ['job-offers', jobId] })
  }, [qc, jobId])

  const invalidateBookingQueries = React.useCallback(() => {
    qc.invalidateQueries({ queryKey: ['jobs.equipment', jobId] })
    qc.invalidateQueries({ queryKey: ['jobs.crew', jobId] })
    qc.invalidateQueries({ queryKey: ['jobs.transport', jobId] })
    qc.invalidateQueries({ queryKey: ['jobs', jobId, 'time_periods', 'crew'] })
    qc.invalidateQueries({
      queryKey: ['jobs', jobId, 'bookings-snapshot-for-offers'],
    })
  }, [qc, jobId])

  const basesQuery = useQuery({
    ...jobOfferBasesQuery(jobId),
    staleTime: 30_000,
    refetchOnMount: false,
  })
  const { data: bases = [], isLoading } = basesQuery

  const basisVersionById = React.useMemo(
    () => buildBasisVersionById(bases),
    [bases],
  )

  const maxLockedBasisVersion = React.useMemo(
    () => getMaxLockedBasisVersion(bases, basisVersionById),
    [bases, basisVersionById],
  )

  const toggleOlderBasisExpanded = React.useCallback((basisId: string) => {
    setExpandedOlderBasisIds((prev) => {
      const next = new Set(prev)
      if (next.has(basisId)) next.delete(basisId)
      else next.add(basisId)
      return next
    })
  }, [])

  const basisIds = React.useMemo(
    () => bases.map((b) => b.id).filter(Boolean),
    [bases],
  )

  const bookingsSnapshotQuery = useQuery({
    queryKey: ['jobs', jobId, 'bookings-snapshot-for-offers'] as const,
    enabled: isActive ?? true,
    staleTime: 30_000,
    refetchOnMount: false,
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

  const basisDetailsQuery = useQuery({
    queryKey: ['offer-basis-details-batch', ...basisIds] as const,
    enabled: (isActive ?? true) && basisIds.length > 0,
    staleTime: 30_000,
    refetchOnMount: false,
    queryFn: async (): Promise<Map<string, SyncLineItems>> => {
      if (basisIds.length === 0) return new Map()

      const { data: groupsRaw, error: groupsErr } = await supabase
        .from('offer_equipment_groups')
        .select('*')
        .in('offer_basis_id', basisIds)
        .order('sort_order', { ascending: true })
      if (groupsErr) throw groupsErr

      const groups = (groupsRaw as Array<any> | null | undefined) ?? []
      const groupIds = groups.map((g) => g.id).filter(Boolean) as Array<string>

      const { data: equipmentItemsRaw, error: equipmentItemsErr } =
        groupIds.length > 0
          ? await supabase
              .from('offer_equipment_items')
              .select('*')
              .in('offer_group_id', groupIds)
              .order('sort_order', { ascending: true })
          : { data: [], error: null }
      if (equipmentItemsErr) throw equipmentItemsErr

      const equipmentItems =
        (equipmentItemsRaw as Array<any> | null | undefined) ?? []

      const { data: crewItemsRaw, error: crewItemsErr } = await supabase
        .from('offer_crew_items')
        .select('*')
        .in('offer_basis_id', basisIds)
      if (crewItemsErr) throw crewItemsErr

      const { data: transportGroupsRaw, error: transportGroupsErr } =
        await supabase
          .from('offer_transport_groups')
          .select('*')
          .in('offer_basis_id', basisIds)
          .order('sort_order', { ascending: true })
      if (transportGroupsErr) throw transportGroupsErr

      const transportGroups =
        (transportGroupsRaw as Array<any> | null | undefined) ?? []
      const transportGroupIds = transportGroups
        .map((group) => group.id)
        .filter(Boolean) as Array<string>

      const { data: transportItemsRaw, error: transportItemsErr } =
        transportGroupIds.length > 0
          ? await supabase
              .from('offer_transport_items')
              .select('*')
              .in('transport_group_id', transportGroupIds)
              .order('sort_order', { ascending: true })
          : { data: [], error: null }
      if (transportItemsErr) throw transportItemsErr

      const crewItems = (crewItemsRaw as Array<any> | null | undefined) ?? []
      const transportItems =
        (transportItemsRaw as Array<any> | null | undefined) ?? []

      const itemsByGroupId = new Map<string, Array<any>>()
      for (const it of equipmentItems) {
        const gid = String(it.offer_group_id ?? '')
        if (!gid) continue
        const list = itemsByGroupId.get(gid) ?? []
        list.push(it)
        itemsByGroupId.set(gid, list)
      }

      const groupsByBasisId = new Map<string, Array<any>>()
      for (const g of groups) {
        const bid = String(g.offer_basis_id ?? '')
        if (!bid) continue
        const list = groupsByBasisId.get(bid) ?? []
        list.push({
          ...g,
          items: itemsByGroupId.get(String(g.id ?? '')) ?? [],
        })
        groupsByBasisId.set(bid, list)
      }

      const crewByBasisId = new Map<string, Array<any>>()
      for (const it of crewItems) {
        const bid = String(it.offer_basis_id ?? '')
        if (!bid) continue
        const list = crewByBasisId.get(bid) ?? []
        list.push(it)
        crewByBasisId.set(bid, list)
      }

      const transportByBasisId = new Map<string, Array<any>>()
      const transportGroupsByBasisId = new Map<string, Array<any>>()
      for (const group of transportGroups) {
        const bid = String(group.offer_basis_id ?? '')
        if (!bid) continue
        const groupItems = transportItems.filter(
          (item) => String(item.transport_group_id ?? '') === String(group.id),
        )
        const list = transportGroupsByBasisId.get(bid) ?? []
        list.push({ ...group, items: groupItems })
        transportGroupsByBasisId.set(bid, list)
      }

      for (const groupList of transportGroupsByBasisId.values()) {
        for (const group of groupList) {
          const bid = String(group.offer_basis_id ?? '')
          if (!bid) continue
          const list = transportByBasisId.get(bid) ?? []
          list.push(...(group.items ?? []))
          transportByBasisId.set(bid, list)
        }
      }

      const out = new Map<string, SyncLineItems>()
      for (const basisId of basisIds) {
        out.set(basisId, {
          groups: (groupsByBasisId.get(basisId) ?? []) as any,
          crew_items: (crewByBasisId.get(basisId) ?? []) as any,
          transport_groups: (transportGroupsByBasisId.get(basisId) ??
            []) as any,
          transport_items: (transportByBasisId.get(basisId) ?? []) as any,
        })
      }
      return out
    },
  })

  const basisDetailsById = React.useMemo(() => {
    return basisDetailsQuery.data ?? new Map<string, SyncLineItems>()
  }, [basisDetailsQuery.data])

  const groupIdsUsedByBases = React.useMemo(() => {
    const ids = new Set<string>()
    for (const detail of basisDetailsById.values()) {
      for (const group of detail.groups || []) {
        for (const item of group.items) {
          if (item.group_id) ids.add(item.group_id)
        }
      }
    }
    return Array.from(ids).sort()
  }, [basisDetailsById])

  const itemIdsUsedByBases = React.useMemo(() => {
    const ids = new Set<string>()
    for (const detail of basisDetailsById.values()) {
      for (const group of detail.groups || []) {
        for (const item of group.items) {
          if (item.item_id) ids.add(item.item_id)
        }
      }
    }
    return Array.from(ids).sort()
  }, [basisDetailsById])

  const vehicleIdsUsedByBases = React.useMemo(() => {
    const ids = new Set<string>()
    for (const detail of basisDetailsById.values()) {
      for (const item of detail.transport_items || []) {
        if (item.vehicle_id) ids.add(item.vehicle_id)
      }
      for (const group of detail.transport_groups || []) {
        for (const item of group.items) {
          if (item.vehicle_id) ids.add(item.vehicle_id)
        }
      }
    }
    return Array.from(ids).sort()
  }, [basisDetailsById])

  const itemCategoriesQuery = useQuery({
    queryKey: ['items', 'categories', ...itemIdsUsedByBases] as const,
    enabled: (isActive ?? true) && itemIdsUsedByBases.length > 0,
    staleTime: 60_000,
    refetchOnMount: false,
    queryFn: async (): Promise<Map<string, string>> => {
      const { data, error } = await supabase
        .from('items')
        .select('id, category:category_id ( name )')
        .in('id', itemIdsUsedByBases)

      if (error) throw error

      const map = new Map<string, string>()
      for (const row of (data as Array<any> | null | undefined) ?? []) {
        const category = Array.isArray(row.category)
          ? row.category[0]
          : row.category
        const name = category?.name?.trim()
        if (row.id) {
          map.set(String(row.id), name || 'Other')
        }
      }
      return map
    },
  })

  const groupCategoriesQuery = useQuery({
    queryKey: ['item_groups', 'categories', ...groupIdsUsedByBases] as const,
    enabled: (isActive ?? true) && groupIdsUsedByBases.length > 0,
    staleTime: 60_000,
    refetchOnMount: false,
    queryFn: async (): Promise<Map<string, string>> => {
      const { data, error } = await supabase
        .from('item_groups')
        .select('id, category:category_id ( name )')
        .in('id', groupIdsUsedByBases)

      if (error) throw error

      const map = new Map<string, string>()
      for (const row of (data as Array<any> | null | undefined) ?? []) {
        const category = Array.isArray(row.category)
          ? row.category[0]
          : row.category
        const name = category?.name?.trim()
        if (row.id) {
          map.set(String(row.id), name || 'Other')
        }
      }
      return map
    },
  })

  const vehicleNamesQuery = useQuery({
    queryKey: ['vehicles', 'names', ...vehicleIdsUsedByBases] as const,
    enabled: (isActive ?? true) && vehicleIdsUsedByBases.length > 0,
    staleTime: 60_000,
    refetchOnMount: false,
    queryFn: async (): Promise<Map<string, string>> => {
      const { data, error } = await supabase
        .from('vehicles')
        .select('id, name')
        .in('id', vehicleIdsUsedByBases)

      if (error) throw error

      const map = new Map<string, string>()
      for (const row of (data as Array<{ id: string; name: string }> | null) ??
        []) {
        if (row.id && row.name.trim()) {
          map.set(row.id, row.name.trim())
        }
      }
      return map
    },
  })

  const basisBookingSummaries = React.useMemo(() => {
    const summaries = new Map<
      string,
      ReturnType<typeof buildOfferBasisBookingSummary>
    >()
    const itemCategoryById =
      itemCategoriesQuery.data ?? new Map<string, string>()
    const groupCategoryById =
      groupCategoriesQuery.data ?? new Map<string, string>()
    const vehicleNameById = vehicleNamesQuery.data ?? new Map<string, string>()

    for (const basisId of basisIds) {
      const detail = basisDetailsById.get(basisId)
      if (!detail) {
        summaries.set(basisId, EMPTY_JOB_BOOKING_SUMMARY)
        continue
      }
      summaries.set(
        basisId,
        buildOfferBasisBookingSummary(
          detail,
          itemCategoryById,
          groupCategoryById,
          vehicleNameById,
        ),
      )
    }
    return summaries
  }, [
    basisDetailsById,
    basisIds,
    groupCategoriesQuery.data,
    itemCategoriesQuery.data,
    vehicleNamesQuery.data,
  ])

  const basisBookingSummaryLoading =
    basisDetailsQuery.isLoading ||
    (itemIdsUsedByBases.length > 0 && itemCategoriesQuery.isLoading) ||
    (groupIdsUsedByBases.length > 0 && groupCategoriesQuery.isLoading) ||
    (vehicleIdsUsedByBases.length > 0 && vehicleNamesQuery.isLoading)

  const groupItemsQuery = useQuery({
    queryKey: ['group-items', ...groupIdsUsedByBases] as const,
    enabled: (isActive ?? true) && groupIdsUsedByBases.length > 0,
    staleTime: 60_000,
    refetchOnMount: false,
    queryFn: async (): Promise<
      Map<string, Array<{ item_id: string; quantity: number }>>
    > => {
      const { data, error } = await supabase
        .from('group_items')
        .select('group_id, item_id, quantity')
        .in('group_id', groupIdsUsedByBases)

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

  const buildCurrentEquipmentMap = React.useCallback(
    (snapshot: BookingsSnapshot) => {
      const m = new Map<string, number>()
      for (const row of snapshot.equipment) {
        const k = makeEquipmentKey(row)
        m.set(k, (m.get(k) ?? 0) + row.quantity)
      }
      for (const [k, v] of m.entries()) {
        if (!v) m.delete(k)
      }
      return m
    },
    [],
  )

  const buildExpectedEquipmentMap = React.useCallback(
    (
      detail: SyncLineItems,
      groupItemsMap: Map<string, Array<{ item_id: string; quantity: number }>>,
    ) => {
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
    },
    [],
  )

  const computeOfferDiff = React.useCallback(
    (
      snapshot: BookingsSnapshot,
      detail: SyncLineItems,
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
    [buildCurrentEquipmentMap, buildExpectedEquipmentMap],
  )

  const getBasisDiff = React.useCallback(
    (basisId: string) => {
      const snapshot = bookingsSnapshotQuery.data
      const detail = basisDetailsById.get(basisId)
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
      basisDetailsById,
      computeOfferDiff,
    ],
  )

  const diffItemIds = React.useMemo(() => {
    const ids = new Set<string>()
    for (const basisId of basisIds) {
      const diff = getBasisDiff(basisId)
      if (!diff) continue
      for (const ch of diff.equipmentChanges) {
        if (ch.item_id) ids.add(ch.item_id)
      }
    }
    return Array.from(ids).slice(0, 200).sort()
  }, [getBasisDiff, basisIds])

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
      for (const row of (data as Array<{ id: string; name: string }> | null) ??
        []) {
        m.set(row.id, row.name)
      }
      return m
    },
  })

  const formatItem = (itemId: string) => {
    const name = itemNamesQuery.data?.get(itemId)
    return name ? `${name}` : itemId
  }

  const buildDiffTooltip = (basisId: string) => {
    const diff = getBasisDiff(basisId)
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
      'Removed from bookings (present now, not in basis)',
      removedEquipment.map((c) => (
        <Text key={`re-${c.key}`} size="1">
          - {formatItem(c.item_id)}
          {c.source_kind === 'group' ? ' (group)' : ''}: -
          {c.current - c.expected}
        </Text>
      )),
      'None',
    )

    pushSection(
      'Added to bookings (in basis, missing now)',
      addedEquipment.map((c) => (
        <Text key={`ae-${c.key}`} size="1">
          - {formatItem(c.item_id)}
          {c.source_kind === 'group' ? ' (group)' : ''}: +
          {c.expected - c.current}
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
          Transport: cannot be strictly compared (basis does not specify
          vehicles).
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

  const getBasisSyncStatus = React.useCallback(
    (
      basisId: string,
    ): { label: string; color: 'green' | 'gray'; title: string } => {
      const snapshot = bookingsSnapshotQuery.data
      const detail = basisDetailsById.get(basisId)

      if (!snapshot || !detail) {
        return {
          label: 'Checking…',
          color: 'gray',
          title: 'Refreshing bookings sync status…',
        }
      }

      if (syncingBasisId === basisId) {
        return {
          label: 'Checking…',
          color: 'gray',
          title: 'Sync in progress… refreshing status.',
        }
      }

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
              ? 'Offer basis matches current bookings (transport not strictly verifiable).'
              : 'Offer basis matches current bookings.',
        }
      }

      const reasons: Array<string> = []
      if (!equipmentMatches) reasons.push('Equipment differs')
      if (!crewMatches) reasons.push('Crew differs')
      if (expectedTransport !== null && !transportMatches) {
        reasons.push('Transport differs')
      }

      return {
        label: 'Not synced',
        color: 'gray',
        title: `Offer basis does not match current bookings. ${reasons.join(' • ')}`,
      }
    },
    [
      bookingsSnapshotQuery.data,
      buildCurrentEquipmentMap,
      buildExpectedEquipmentMap,
      groupItemsQuery.data,
      groupItemsQuery.isLoading,
      basisDetailsById,
      syncingBasisId,
    ],
  )

  const prevIsActiveRef = React.useRef<boolean>(false)
  React.useEffect(() => {
    const nowActive = isActive ?? true
    const wasActive = prevIsActiveRef.current
    prevIsActiveRef.current = nowActive
    if (!nowActive || wasActive) return

    basesQuery.refetch()
    bookingsSnapshotQuery.refetch()
    basisDetailsQuery.refetch()
    groupItemsQuery.refetch()
  }, [
    isActive,
    basesQuery,
    bookingsSnapshotQuery,
    basisDetailsQuery,
    groupItemsQuery,
  ])

  const { data: user } = useQuery({
    queryKey: ['auth', 'user'],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser()
      return data.user
    },
  })

  const handleBookingOverlapError = React.useCallback((err: unknown) => {
    if (!isBookingOverlapError(err)) return false
    setForceSummaryLines(err.summaryLines)
    setForceConflicts(err.conflicts)
    setForceDialogOpen(true)
    return true
  }, [])

  const createBookingsMutation = useMutation({
    mutationFn: async ({
      basisId,
      force = false,
    }: {
      basisId: string
      force?: boolean
    }) => {
      if (!user?.id) throw new Error('User not authenticated')
      await createBookingsFromOfferBasis(basisId, user.id, { force })
    },
    onSuccess: () => {
      setForceDialogOpen(false)
      pendingForceBookingRef.current = null
      invalidateOfferQueries()
      qc.invalidateQueries({ queryKey: ['job-calendar', jobId] })
      qc.invalidateQueries({ queryKey: ['time-periods', jobId] })
      invalidateBookingQueries()
      success(
        'Bookings created',
        'Time periods and reservations have been created from the offer basis.',
      )
    },
    onError: (err: unknown) => {
      if (err instanceof Error && err.message === OVERLAP_NEEDS_FORCE) return
      if (handleBookingOverlapError(err)) return
      toastError(
        'Failed to create bookings',
        err instanceof Error ? err.message : 'Please try again.',
      )
    },
  })

  const syncBookingsMutation = useMutation({
    mutationFn: async ({
      basisId,
      force = false,
    }: {
      basisId: string
      force?: boolean
    }) => {
      if (!user?.id) throw new Error('User not authenticated')
      return await syncBookingsFromOfferBasis(basisId, user.id, { force })
    },
    onMutate: ({ basisId }) => {
      setSyncingBasisId(basisId)
    },
    onSuccess: (warnings) => {
      setForceDialogOpen(false)
      pendingForceBookingRef.current = null
      invalidateOfferQueries()
      qc.invalidateQueries({ queryKey: ['job-calendar', jobId] })
      qc.invalidateQueries({ queryKey: ['time-periods', jobId] })
      invalidateBookingQueries()
      success('Bookings synced', 'Bookings were synced from the offer basis.')
      basesQuery.refetch()
      bookingsSnapshotQuery.refetch()
      if (warnings.length) {
        info('Booking warnings', warnings.join('\n'), 6000)
      }
    },
    onSettled: () => {
      setSyncingBasisId(null)
      bookingsSnapshotQuery.refetch()
    },
    onError: (err: unknown) => {
      setSyncingBasisId(null)
      if (err instanceof Error && err.message === OVERLAP_NEEDS_FORCE) return
      if (handleBookingOverlapError(err)) return
      toastError(
        'Failed to sync bookings',
        err instanceof Error ? err.message : 'Please try again.',
      )
    },
  })

  const deleteOfferMutation = useMutation({
    mutationFn: deleteOffer,
    onSuccess: () => {
      invalidateOfferQueries()
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
      invalidateOfferQueries()
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
      invalidateOfferQueries()
      setLinkDialogOpen(offer)
      success('Offer locked', 'The offer has been locked and sent.')
    },
    onError: (err: any) => {
      toastError('Failed to lock offer', err?.message || 'Please try again.')
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

      if (payload.responseType === 'revision') {
        const { data: jobRow, error: jobError } = await supabase
          .from('jobs')
          .select('project_lead_user_id')
          .eq('id', jobId)
          .single()
        if (jobError) throw jobError
        if (!jobRow.project_lead_user_id) {
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
    },
    onSuccess: () => {
      invalidateOfferQueries()
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

  const createEmptyBasisMutation = useMutation({
    mutationFn: async () => {
      return await createEmptyOfferBasis({ jobId, companyId })
    },
    onSuccess: (basisId) => {
      invalidateOfferQueries()
      setEditingBasisId(basisId)
      setBasisEditorOpen(true)
      success('Basis created', 'Add equipment, crew, and transport.')
    },
    onError: (err: any) => {
      toastError('Failed to create basis', err?.message || 'Please try again.')
    },
  })

  const createTechnicalFromBasisMutation = useMutation({
    mutationFn: async (basis: JobOfferBasisRow) => {
      const normalizedVat = basis.vat_percent === 0 ? 0 : 25
      const offerId = await createOffer({
        jobId,
        companyId,
        offerBasisId: basis.id,
        offerType: 'technical',
        title: basis.title,
        daysOfUse: basis.days_of_use,
        discountPercent: basis.discount_percent,
        vatPercent: normalizedVat,
        showPricePerLine: true,
      })
      await recalculateOfferTotals(offerId)
      return offerId
    },
    onSuccess: (offerId) => {
      invalidateOfferQueries()
      setEditingOfferId(offerId)
      setTechnicalEditorOpen(true)
      success('Technical offer created', 'Edit pricing and presentation.')
    },
    onError: (err: any) => {
      toastError(
        'Failed to create technical offer',
        err?.message || 'Please try again.',
      )
    },
  })

  const createPrettyFromBasisMutation = useMutation({
    mutationFn: async (basisId: string) => {
      return await createEmptyDraftPrettyOffer({
        jobId,
        companyId,
        offerBasisId: basisId,
      })
    },
    onSuccess: (offerId, basisId) => {
      invalidateOfferQueries()
      setEditingOfferId(offerId)
      setPrettyOfferBasisId(basisId)
      setPrettyEditorOpen(true)
      success('Pretty offer created', 'Add modules and save your proposal.')
    },
    onError: (err: any) => {
      toastError(
        'Failed to create pretty offer',
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

  const duplicateBasisMutation = useMutation({
    mutationFn: duplicateOfferBasis,
    onSuccess: () => {
      invalidateOfferQueries()
      basisDetailsQuery.refetch()
      success(
        'Offer basis copied',
        'A new basis was created with the same line items.',
      )
    },
    onError: (err: any) => {
      toastError('Failed to copy basis', err?.message || 'Please try again.')
    },
  })

  const deleteBasisMutation = useMutation({
    mutationFn: deleteOfferBasis,
    onSuccess: () => {
      invalidateOfferQueries()
      basisDetailsQuery.refetch()
      setDeleteBasisOpen(null)
      success(
        'Offer basis deleted',
        'The basis and linked offers were removed.',
      )
    },
    onError: (err: any) => {
      toastError('Failed to delete basis', err?.message || 'Please try again.')
    },
  })

  const startBasisBooking = React.useCallback(
    async (
      basisId: string,
      action: 'sync' | 'create',
      force = false,
    ): Promise<'overlap' | 'done'> => {
      pendingForceBookingRef.current = { basisId, action }
      try {
        if (action === 'sync') {
          await syncBookingsMutation.mutateAsync({ basisId, force })
        } else {
          await createBookingsMutation.mutateAsync({ basisId, force })
        }
        return 'done'
      } catch (err) {
        if (isBookingOverlapError(err)) return 'overlap'
        throw err
      }
    },
    [createBookingsMutation, syncBookingsMutation],
  )

  const fetchGroupItemsMap = React.useCallback(
    async (groupIds: Array<string>) => {
      const ids = Array.from(new Set(groupIds)).filter(Boolean)
      if (ids.length === 0)
        return new Map<string, Array<{ item_id: string; quantity: number }>>()

      const { data, error } = await supabase
        .from('group_items')
        .select('group_id, item_id, quantity')
        .in('group_id', ids)

      if (error) throw error

      const map = new Map<
        string,
        Array<{ item_id: string; quantity: number }>
      >()
      for (const row of (data as Array<GroupItemRow> | null | undefined) ??
        []) {
        if (!row.group_id || !row.item_id) continue
        const list = map.get(row.group_id) ?? []
        list.push({ item_id: row.item_id, quantity: row.quantity ?? 1 })
        map.set(row.group_id, list)
      }
      return map
    },
    [],
  )

  const fetchBasisDiffForSync = React.useCallback(
    async (basisId: string): Promise<OfferDiff | null> => {
      const snapshotResult = await bookingsSnapshotQuery.refetch()
      const snapshot = snapshotResult.data
      const detail = await qc.fetchQuery(offerBasisDetailQuery(basisId))
      if (!snapshot || !detail) return null

      const groupIds: Array<string> = []
      for (const group of detail.groups) {
        for (const item of group.items) {
          if (item.group_id) groupIds.push(item.group_id)
        }
      }
      const groupItemsMap = await fetchGroupItemsMap(groupIds)
      return computeOfferDiff(snapshot, detail, groupItemsMap)
    },
    [bookingsSnapshotQuery, computeOfferDiff, fetchGroupItemsMap, qc],
  )

  const handleSyncBookings = React.useCallback(
    async (
      basis: JobOfferBasisRow,
    ): Promise<'overlap' | 'done' | undefined> => {
      if (!user?.id) {
        toastError('Authentication required', 'Please log in to sync bookings.')
        return undefined
      }

      let diff: OfferDiff | null = null
      try {
        diff = await fetchBasisDiffForSync(basis.id)
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
        basesQuery.refetch()
        bookingsSnapshotQuery.refetch()
        groupItemsQuery.refetch()
        return
      }

      const equipmentRemovals: Array<string> = []
      const crewRemovals: Array<string> = []
      const transportRemovals: Array<string> = []

      const removedEquipment = diff.equipmentChanges
        .filter((c) => c.current > c.expected)
        .sort((a, b) => b.current - b.expected - (a.current - a.expected))
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
        .sort((a, b) => b.current - b.expected - (a.current - a.expected))
      for (const c of removedCrew.slice(0, 10)) {
        crewRemovals.push(`${c.title || 'Crew'} (${c.current} → ${c.expected})`)
      }
      if (removedCrew.length > 10) {
        crewRemovals.push(`…and ${removedCrew.length - 10} more crew removals`)
      }

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
        equipmentRemovals.length +
        crewRemovals.length +
        transportRemovals.length
      if (totalRemovalCount > 0) {
        setSyncConfirm({
          basisId: basis.id,
          basisTitle: formatBasisVersionLabel(
            basisVersionById.get(basis.id) ?? 1,
          ),
          removals: {
            equipment: equipmentRemovals,
            crew: crewRemovals,
            transport: transportRemovals,
          },
        })
        return undefined
      }

      setSyncingBasisId(basis.id)
      return await startBasisBooking(basis.id, 'sync')
    },
    [
      basesQuery,
      bookingsSnapshotQuery,
      fetchBasisDiffForSync,
      formatItem,
      groupItemsQuery,
      info,
      basisVersionById,
      startBasisBooking,
      toastError,
      user?.id,
    ],
  )

  const handleBasisSync = React.useCallback(
    (basis: JobOfferBasisRow) => {
      if (!user?.id) {
        toastError('Authentication required', 'Please log in to sync bookings.')
        return
      }

      const snapshot = bookingsSnapshotQuery.data
      const hasAnyBookings =
        !!snapshot &&
        (snapshot.equipment.length > 0 ||
          snapshot.crewPeriods.length > 0 ||
          snapshot.transport.length > 0)

      if (hasAnyBookings || basis.bookings_synced_at) {
        void handleSyncBookings(basis)
        return
      }

      startBasisBooking(basis.id, 'create')
    },
    [
      bookingsSnapshotQuery.data,
      handleSyncBookings,
      startBasisBooking,
      toastError,
      user?.id,
    ],
  )

  const getBasisPdfOffer = React.useCallback(
    (basis: JobOfferBasisRow): JobOffer | null => {
      if (basis.offers.length === 0) return null

      const technicalOffers = basis.offers
        .filter((offer) => offer.offer_type === 'technical')
        .sort((a, b) => b.version_number - a.version_number)
      if (technicalOffers.length > 0) return technicalOffers[0]

      return (
        [...basis.offers].sort(
          (a, b) => b.version_number - a.version_number,
        )[0] ?? null
      )
    },
    [],
  )

  const handleEditOffer = (offer: JobOffer) => {
    if (offer.locked || offer.status !== 'draft') {
      toastError(
        'Cannot edit offer',
        'Only draft offers can be edited. Locked or sent offers cannot be modified.',
      )
      return
    }
    setEditingOfferId(offer.id)
    if (offer.offer_type === 'pretty') {
      setPrettyOfferBasisId(offer.offer_basis_id)
      setPrettyEditorOpen(true)
    } else {
      setTechnicalEditorOpen(true)
    }
  }

  const handleViewOffer = (offer: JobOffer) => {
    setEditingOfferId(offer.id)
    if (offer.offer_type === 'pretty') {
      setPrettyOfferBasisId(offer.offer_basis_id)
      setPrettyEditorOpen(true)
    } else {
      setTechnicalEditorOpen(true)
    }
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

  const renderOfferMenuButton = () => (
    <IconButton
      size="1"
      variant="soft"
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
  )

  const renderOfferDropdownMenu = (
    offer: JobOffer,
    {
      hideEdit = false,
      hideView = false,
      hideCopyLink = false,
      hideDuplicate = false,
    }: {
      hideEdit?: boolean
      hideView?: boolean
      hideCopyLink?: boolean
      hideDuplicate?: boolean
    } = {},
  ) => {
    const canCopyLink = offer.locked && offer.status !== 'draft'
    const hasLeadingItems =
      (offer.locked && !hideView) ||
      (!offer.locked && !hideEdit && !isReadOnly) ||
      (canCopyLink && !hideCopyLink)

    return (
      <DropdownMenu.Root>
        <DropdownMenu.Trigger>{renderOfferMenuButton()}</DropdownMenu.Trigger>
        <DropdownMenu.Content align="end">
          {offer.locked && !hideView && (
            <DropdownMenu.Item onSelect={() => handleViewOffer(offer)}>
              <Flex align="center" gap="2">
                <Eye width={14} height={14} />
                <Text>View</Text>
              </Flex>
            </DropdownMenu.Item>
          )}
          {!offer.locked && !hideEdit && !isReadOnly && (
            <DropdownMenu.Item onSelect={() => handleEditOffer(offer)}>
              <Flex align="center" gap="2">
                <Edit width={14} height={14} />
                <Text>Edit</Text>
              </Flex>
            </DropdownMenu.Item>
          )}

          {canCopyLink && !hideCopyLink && (
            <DropdownMenu.Item onSelect={() => handleCopyLink(offer)}>
              <Flex align="center" gap="2">
                <Link width={14} height={14} />
                <Text>Copy link</Text>
              </Flex>
            </DropdownMenu.Item>
          )}

          {!isReadOnly && (
            <>
              {hasLeadingItems && <DropdownMenu.Separator />}
              {!hideDuplicate && (
                <DropdownMenu.Item
                  onSelect={() => duplicateOfferMutation.mutate(offer.id)}
                  disabled={duplicateOfferMutation.isPending}
                >
                  <Flex align="center" gap="2">
                    <Copy width={14} height={14} />
                    <Text>Duplicate</Text>
                  </Flex>
                </DropdownMenu.Item>
              )}
              {!offer.locked && (
                <DropdownMenu.Item
                  onSelect={() => lockOfferMutation.mutate(offer)}
                  disabled={lockOfferMutation.isPending}
                >
                  <Flex align="center" gap="2">
                    <Lock width={14} height={14} />
                    <Text>Lock &amp; send</Text>
                  </Flex>
                </DropdownMenu.Item>
              )}
              <DropdownMenu.Item
                onSelect={() => exportPdfMutation.mutate(offer.id)}
                disabled={exportPdfMutation.isPending}
              >
                <Flex align="center" gap="2">
                  <Download width={14} height={14} />
                  <Text>Export PDF</Text>
                </Flex>
              </DropdownMenu.Item>
              <DropdownMenu.Item onSelect={() => openResponseDialog(offer)}>
                <Flex align="center" gap="2">
                  <Edit width={14} height={14} />
                  <Text>Set response</Text>
                </Flex>
              </DropdownMenu.Item>
              <DropdownMenu.Separator />
              <DropdownMenu.Item onSelect={() => setDeleteOpen(offer)}>
                <Flex align="center" gap="2">
                  <Trash width={14} height={14} />
                  <Text>Delete</Text>
                </Flex>
              </DropdownMenu.Item>
            </>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    )
  }

  const renderOfferRowActions = (offer: JobOffer) => {
    const isEditable = !offer.locked && !isReadOnly
    const isLockedSent = offer.locked && offer.status !== 'draft'
    const canManage = !isReadOnly
    const hasAnyAction = isEditable || isLockedSent || offer.locked || canManage

    if (!hasAnyAction) return null

    return (
      <Flex
        className="offer-basis-card__offer-row-actions"
        justify="end"
        gap="1"
        align="center"
      >
        {isEditable && (
          <Tooltip content="Edit">
            <IconButton
              size="1"
              variant="soft"
              aria-label="Edit offer"
              onClick={() => handleEditOffer(offer)}
            >
              <Edit width={14} height={14} />
            </IconButton>
          </Tooltip>
        )}
        {isLockedSent && (
          <>
            <Tooltip content="Copy link">
              <IconButton
                size="1"
                variant="soft"
                aria-label="Copy offer link"
                onClick={() => handleCopyLink(offer)}
              >
                <Link width={14} height={14} />
              </IconButton>
            </Tooltip>
            {!isReadOnly && (
              <Tooltip content="Duplicate">
                <IconButton
                  size="1"
                  variant="soft"
                  aria-label="Duplicate offer"
                  onClick={() => duplicateOfferMutation.mutate(offer.id)}
                  disabled={duplicateOfferMutation.isPending}
                >
                  <Copy width={14} height={14} />
                </IconButton>
              </Tooltip>
            )}
          </>
        )}
        {!isEditable && !isLockedSent && offer.locked && (
          <Tooltip content="View">
            <IconButton
              size="1"
              variant="soft"
              aria-label="View offer"
              onClick={() => handleViewOffer(offer)}
            >
              <Eye width={14} height={14} />
            </IconButton>
          </Tooltip>
        )}
        {renderOfferDropdownMenu(offer, {
          hideEdit: isEditable,
          hideView: isEditable || (!isLockedSent && offer.locked),
          hideCopyLink: isLockedSent,
          hideDuplicate: isLockedSent && !isReadOnly,
        })}
      </Flex>
    )
  }

  const renderBasisSection = (basis: JobOfferBasisRow) => {
    const basisVersion = basisVersionById.get(basis.id) ?? 1
    const offerSubVersionById = buildOfferSubVersionById(basis.offers)
    const syncStatus = getBasisSyncStatus(basis.id)
    const showSyncInfo = syncStatus.label === 'Not synced'
    const isBasisLocked = basis.offers.some((offer) => offer.locked)
    const pdfOffer = getBasisPdfOffer(basis)
    const syncPending =
      syncBookingsMutation.isPending || createBookingsMutation.isPending
    const hasOffers = basis.offers.length > 0
    const isOlderBasis =
      maxLockedBasisVersion > 0 && basisVersion < maxLockedBasisVersion
    const isExpanded = !isOlderBasis || expandedOlderBasisIds.has(basis.id)
    const collapsedSummary = hasOffers
      ? `${basis.offers.length} offer${basis.offers.length === 1 ? '' : 's'}`
      : 'No offers yet'
    const toggleOlderBasis = () => toggleOlderBasisExpanded(basis.id)
    const stopHeaderToggle: React.MouseEventHandler = (event) => {
      event.stopPropagation()
    }

    return (
      <Card
        key={basis.id}
        mb="4"
        className={
          isOlderBasis && !isExpanded
            ? 'offer-basis-card offer-basis-card--collapsed'
            : 'offer-basis-card'
        }
        onClick={isOlderBasis && !isExpanded ? toggleOlderBasis : undefined}
        role={isOlderBasis && !isExpanded ? 'button' : undefined}
        tabIndex={isOlderBasis && !isExpanded ? 0 : undefined}
        onKeyDown={
          isOlderBasis && !isExpanded
            ? (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  toggleOlderBasis()
                }
              }
            : undefined
        }
      >
        <Flex direction="column" gap={isExpanded ? '3' : '1'}>
          <Flex direction="column" gap="2">
            <Flex
              justify="between"
              align="start"
              gap="2"
              wrap="wrap"
              className={
                isOlderBasis && isExpanded
                  ? 'offer-basis-card__header-toggle'
                  : undefined
              }
              onClick={
                isOlderBasis && isExpanded ? toggleOlderBasis : undefined
              }
            >
              <Flex direction="column" gap="1" style={{ minWidth: 0, flex: 1 }}>
                <Flex align="center" gap="2" wrap="wrap">
                  {isOlderBasis && (
                    <Box
                      aria-hidden
                      style={{
                        flexShrink: 0,
                        color: 'var(--gray-11)',
                        display: 'flex',
                      }}
                    >
                      {isExpanded ? (
                        <NavArrowDown width={16} height={16} />
                      ) : (
                        <NavArrowRight width={16} height={16} />
                      )}
                    </Box>
                  )}
                  <Heading size="3">
                    {formatBasisVersionLabel(basisVersion)}
                  </Heading>
                  {isBasisLocked ? (
                    <Badge variant="soft" color="orange">
                      <Flex align="center" gap="1">
                        <Lock width={12} height={12} />
                        Locked
                      </Flex>
                    </Badge>
                  ) : (
                    <Badge variant="soft" color="gray">
                      Unlocked
                    </Badge>
                  )}
                  <Badge
                    variant="soft"
                    color={syncStatus.color}
                    title={syncStatus.title}
                  >
                    {syncStatus.label}
                  </Badge>
                  {showSyncInfo && isExpanded && (
                    <Tooltip content={buildDiffTooltip(basis.id)}>
                      <IconButton
                        size="1"
                        variant="ghost"
                        aria-label="Show booking differences"
                        onClick={stopHeaderToggle}
                      >
                        <InfoCircle width={14} height={14} />
                      </IconButton>
                    </Tooltip>
                  )}
                </Flex>
                <Text size="1" color="gray">
                  Created {formatDate(basis.created_at)}
                </Text>
                {!isExpanded && (
                  <Text size="1" color="gray">
                    {collapsedSummary}
                  </Text>
                )}
              </Flex>

              {isExpanded && !isReadOnly && (
                <Flex
                  align="center"
                  gap="1"
                  wrap="wrap"
                  style={{ flexShrink: 0 }}
                  onClick={stopHeaderToggle}
                >
                  <Flex
                    align="center"
                    gap="1"
                    wrap="wrap"
                    className="offer-basis-card__actions"
                  >
                    <Tooltip
                      content={isBasisLocked ? 'View basis' : 'Edit basis'}
                    >
                      <IconButton
                        size="2"
                        variant="soft"
                        aria-label={isBasisLocked ? 'View basis' : 'Edit basis'}
                        onClick={() => {
                          setEditingBasisId(basis.id)
                          setBasisEditorOpen(true)
                        }}
                      >
                        {isBasisLocked ? (
                          <Eye width={16} height={16} />
                        ) : (
                          <Edit width={16} height={16} />
                        )}
                      </IconButton>
                    </Tooltip>
                    <Tooltip content="Sync bookings">
                      <IconButton
                        size="2"
                        variant="soft"
                        aria-label="Sync bookings"
                        onClick={() => handleBasisSync(basis)}
                        disabled={syncPending}
                      >
                        <Refresh width={16} height={16} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip content="Copy basis">
                      <IconButton
                        size="2"
                        variant="soft"
                        aria-label="Copy basis"
                        onClick={() => duplicateBasisMutation.mutate(basis.id)}
                        disabled={duplicateBasisMutation.isPending}
                      >
                        <Copy width={16} height={16} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip
                      content={
                        pdfOffer
                          ? 'Download PDF'
                          : 'Create an offer before downloading a PDF'
                      }
                    >
                      <IconButton
                        size="2"
                        variant="soft"
                        aria-label="Download PDF"
                        disabled={!pdfOffer || exportPdfMutation.isPending}
                        onClick={() => {
                          if (pdfOffer) exportPdfMutation.mutate(pdfOffer.id)
                        }}
                      >
                        <Download width={16} height={16} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip
                      content={
                        isBasisLocked
                          ? 'Cannot delete while a linked offer is locked'
                          : 'Delete basis'
                      }
                    >
                      <IconButton
                        size="2"
                        variant="soft"
                        color="red"
                        aria-label="Delete basis"
                        disabled={
                          isBasisLocked || deleteBasisMutation.isPending
                        }
                        onClick={() => setDeleteBasisOpen(basis)}
                      >
                        <Trash width={16} height={16} />
                      </IconButton>
                    </Tooltip>
                    {hasOffers && (
                      <DropdownMenu.Root>
                        <DropdownMenu.Trigger>
                          <IconButton
                            size="2"
                            variant="soft"
                            aria-label="Create offer"
                            title="Create offer"
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
                          <DropdownMenu.Item
                            onSelect={() =>
                              createTechnicalFromBasisMutation.mutate(basis)
                            }
                            disabled={
                              createTechnicalFromBasisMutation.isPending
                            }
                          >
                            <Flex align="center" gap="2">
                              <Wrench width={14} height={14} />
                              <Text>Create technical offer</Text>
                            </Flex>
                          </DropdownMenu.Item>
                          <DropdownMenu.Item
                            onSelect={() =>
                              createPrettyFromBasisMutation.mutate(basis.id)
                            }
                            disabled={createPrettyFromBasisMutation.isPending}
                          >
                            <Flex align="center" gap="2">
                              <Sparks width={14} height={14} />
                              <Text>Create pretty offer</Text>
                              <PrettyOfferBetaBadge />
                            </Flex>
                          </DropdownMenu.Item>
                        </DropdownMenu.Content>
                      </DropdownMenu.Root>
                    )}
                  </Flex>
                </Flex>
              )}
            </Flex>
          </Flex>

          {isExpanded && (
            <>
              <JobBookingRecap
                layout="inline"
                summary={
                  basisBookingSummaries.get(basis.id) ??
                  EMPTY_JOB_BOOKING_SUMMARY
                }
                loading={basisBookingSummaryLoading}
                emptyMessage="No equipment, vehicles, or crew on this basis yet"
              />

              {!isReadOnly && !hasOffers && (
                <Flex gap="3" direction={{ initial: 'column', sm: 'row' }}>
                  <Button
                    size="3"
                    variant="soft"
                    style={{ flex: 1, minHeight: 72 }}
                    aria-label="Create technical offer"
                    onClick={() =>
                      createTechnicalFromBasisMutation.mutate(basis)
                    }
                    disabled={createTechnicalFromBasisMutation.isPending}
                  >
                    <Flex direction="column" align="center" gap="2">
                      <Wrench width={22} height={22} />
                      <Text size="2" weight="medium">
                        Technical offer
                      </Text>
                    </Flex>
                  </Button>
                  <Button
                    size="3"
                    variant="soft"
                    color="purple"
                    style={{ flex: 1, minHeight: 72 }}
                    aria-label="Create pretty offer"
                    onClick={() =>
                      createPrettyFromBasisMutation.mutate(basis.id)
                    }
                    disabled={createPrettyFromBasisMutation.isPending}
                  >
                    <Flex direction="column" align="center" gap="2">
                      <Sparks width={22} height={22} />
                      <Flex align="center" gap="1">
                        <Text size="2" weight="medium">
                          Pretty offer
                        </Text>
                        <PrettyOfferBetaBadge />
                      </Flex>
                    </Flex>
                  </Button>
                </Flex>
              )}

              {hasOffers && (
                <Box style={{ overflowX: 'auto' }}>
                  <Table.Root variant="surface" style={{ minWidth: 560 }}>
                    <Table.Header>
                      <Table.Row>
                        <Table.ColumnHeaderCell>Offer</Table.ColumnHeaderCell>
                        <Table.ColumnHeaderCell>Status</Table.ColumnHeaderCell>
                        <Table.ColumnHeaderCell>Total</Table.ColumnHeaderCell>
                        <Table.ColumnHeaderCell width="120px" />
                      </Table.Row>
                    </Table.Header>
                    <Table.Body>
                      {basis.offers.map((offer) => {
                        const offerSubVersion =
                          offerSubVersionById.get(offer.id) ?? 1
                        const versionLabel = formatOfferVersionOnBasis(
                          basisVersion,
                          offerSubVersion,
                        )
                        const offerNumberLabel = formatOfferNumberDisplay(
                          offer.offernr,
                        )
                        const offerTitle = offer.title.trim() || 'Offer'

                        return (
                          <Table.Row
                            key={offer.id}
                            className="offer-basis-card__offer-row"
                          >
                            <Table.Cell>
                              <Flex
                                direction="column"
                                gap="1"
                                style={{ minWidth: 0 }}
                              >
                                <Text weight="medium" style={{ minWidth: 0 }}>
                                  {offerTitle}
                                </Text>
                                <Flex align="center" gap="2" wrap="wrap">
                                  <Badge
                                    variant="soft"
                                    size="1"
                                    color={
                                      offer.offer_type === 'pretty'
                                        ? 'purple'
                                        : 'blue'
                                    }
                                  >
                                    {getOfferTypeLabel(offer.offer_type)}
                                  </Badge>
                                  <Text size="1" color="gray">
                                    {versionLabel}
                                  </Text>
                                  {offerNumberLabel ? (
                                    <Text size="1" color="gray">
                                      {offerNumberLabel}
                                    </Text>
                                  ) : null}
                                  {offer.locked && (
                                    <Lock
                                      width={12}
                                      height={12}
                                      color="var(--orange-9)"
                                      aria-label="Locked"
                                    />
                                  )}
                                  {offer.copied_from_job_id && (
                                    <Tooltip content="Copied from another job. Duplicate this offer to start a new revision.">
                                      <Badge
                                        variant="soft"
                                        color="orange"
                                        size="1"
                                      >
                                        Copied
                                      </Badge>
                                    </Tooltip>
                                  )}
                                </Flex>
                              </Flex>
                            </Table.Cell>
                            <Table.Cell
                              style={{ width: 96, verticalAlign: 'middle' }}
                            >
                              <Flex direction="column" gap="1" align="start">
                                <Badge
                                  size="1"
                                  variant="soft"
                                  radius="full"
                                  color={getOfferStatusBadgeColor(offer)}
                                >
                                  {getOfferStatusLabel(offer)}
                                </Badge>
                                {offer.revision_requested_at && (
                                  <Button
                                    size="1"
                                    variant="ghost"
                                    onClick={() =>
                                      setRevisionMessageOffer(offer)
                                    }
                                  >
                                    Show message
                                  </Button>
                                )}
                              </Flex>
                            </Table.Cell>
                            <Table.Cell style={{ verticalAlign: 'middle' }}>
                              <Text size="2">
                                {offer.total_with_vat &&
                                offer.total_with_vat > 0
                                  ? formatCurrency(offer.total_with_vat)
                                  : '—'}
                              </Text>
                            </Table.Cell>
                            <Table.Cell
                              style={{
                                width: 120,
                                minWidth: 120,
                                verticalAlign: 'middle',
                              }}
                            >
                              {renderOfferRowActions(offer)}
                            </Table.Cell>
                          </Table.Row>
                        )
                      })}
                    </Table.Body>
                  </Table.Root>
                </Box>
              )}
            </>
          )}
        </Flex>
      </Card>
    )
  }

  return (
    <Box>
      <Flex mb="3" justify="between" align="center" wrap="wrap" gap="2">
        <Flex align="center" gap="2">
          <Heading size="3">Offers</Heading>
          <OffersStructureHelpDialog />
        </Flex>
        {!isReadOnly && (
          <Button
            size="2"
            variant="outline"
            onClick={() => createEmptyBasisMutation.mutate()}
            disabled={createEmptyBasisMutation.isPending}
          >
            <Plus width={16} height={16} /> New basis
          </Button>
        )}
      </Flex>

      {isLoading ? (
        <Text>Loading offers...</Text>
      ) : bases.length === 0 && !isReadOnly ? (
        <Box
          p="4"
          style={{
            border: '2px dashed var(--gray-a6)',
            borderRadius: 8,
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'all 100ms',
          }}
          onClick={() => createEmptyBasisMutation.mutate()}
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
              Create your first basis
            </Text>
          </Flex>
        </Box>
      ) : bases.length === 0 && isReadOnly ? (
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
        <Box>{bases.map(renderBasisSection)}</Box>
      )}

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
                  <strong>Type:</strong>{' '}
                  {getOfferTypeLabel(deleteOpen.offer_type)}
                </Text>
                <Text size="2">
                  <strong>Status:</strong> {deleteOpen.status}
                </Text>
                <Text size="2">
                  <strong>Version:</strong>{' '}
                  {formatOfferVersionOnBasis(
                    basisVersionById.get(deleteOpen.offer_basis_id) ?? 1,
                    buildOfferSubVersionById(
                      bases.find((b) => b.id === deleteOpen.offer_basis_id)
                        ?.offers ?? [],
                    ).get(deleteOpen.id) ?? 1,
                  )}
                </Text>
                {formatOfferNumberDisplay(deleteOpen.offernr) ? (
                  <Text size="2">
                    <strong>Offer #:</strong>{' '}
                    {formatOfferNumberDisplay(deleteOpen.offernr)}
                  </Text>
                ) : null}
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

      {deleteBasisOpen && (
        <Dialog.Root
          open={!!deleteBasisOpen}
          onOpenChange={(v) => !v && setDeleteBasisOpen(null)}
        >
          <Dialog.Content maxWidth="450px">
            <Dialog.Title>Delete offer basis?</Dialog.Title>
            <Separator my="3" />
            <Text size="2">
              This will permanently delete{' '}
              <strong>
                {formatBasisVersionLabel(
                  basisVersionById.get(deleteBasisOpen.id) ?? 1,
                )}
              </strong>{' '}
              and all linked offers. This action cannot be undone.
            </Text>
            <Flex gap="2" mt="4" justify="end">
              <Dialog.Close>
                <Button variant="soft" disabled={deleteBasisMutation.isPending}>
                  Cancel
                </Button>
              </Dialog.Close>
              <Button
                color="red"
                onClick={() => deleteBasisMutation.mutate(deleteBasisOpen.id)}
                disabled={deleteBasisMutation.isPending}
              >
                {deleteBasisMutation.isPending ? 'Deleting...' : 'Delete'}
              </Button>
            </Flex>
          </Dialog.Content>
        </Dialog.Root>
      )}

      {syncConfirm && (
        <Dialog.Root
          open={!!syncConfirm}
          onOpenChange={(v) => !v && setSyncConfirm(null)}
        >
          <Dialog.Content maxWidth="560px">
            <Dialog.Title>Sync bookings from this offer basis?</Dialog.Title>
            <Separator my="3" />
            <Callout.Root color="yellow">
              <Callout.Icon>
                <InfoCircle width={18} height={18} />
              </Callout.Icon>
              <Callout.Text>
                Syncing <strong>{syncConfirm.basisTitle}</strong> will{' '}
                <strong>remove or reduce</strong> existing bookings so they
                match the offer basis.
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
                  void startBasisBooking(syncConfirm.basisId, 'sync')
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

      {basisEditorOpen && (
        <OfferBasisEditor
          open={basisEditorOpen}
          onOpenChange={(open) => {
            setBasisEditorOpen(open)
            if (!open) setEditingBasisId(null)
          }}
          jobId={jobId}
          companyId={companyId}
          basisId={editingBasisId ?? undefined}
          onSaved={() => {
            invalidateOfferQueries()
            basisDetailsQuery.refetch()
            bookingsSnapshotQuery.refetch()
          }}
        />
      )}

      {technicalEditorOpen && (
        <TechnicalOfferEditor
          open={technicalEditorOpen}
          onOpenChange={(open) => {
            setTechnicalEditorOpen(open)
            if (!open) setEditingOfferId(null)
          }}
          jobId={jobId}
          companyId={companyId}
          offerId={editingOfferId}
          onSaved={(savedId) => {
            setEditingOfferId(savedId)
            invalidateOfferQueries()
          }}
        />
      )}

      {prettyEditorOpen && (
        <PrettyOfferEditor
          open={prettyEditorOpen}
          onOpenChange={(open) => {
            setPrettyEditorOpen(open)
            if (!open) {
              setEditingOfferId(null)
              setPrettyOfferBasisId(undefined)
            }
          }}
          jobId={jobId}
          companyId={companyId}
          offerId={editingOfferId}
          offerBasisId={prettyOfferBasisId}
          onSaved={() => {
            invalidateOfferQueries()
          }}
        />
      )}

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

      <ForceBookingDialog
        open={forceDialogOpen}
        onOpenChange={setForceDialogOpen}
        resourceLabel="Equipment booking"
        warningLines={forceSummaryLines}
        conflicts={forceConflicts}
        loading={
          syncBookingsMutation.isPending || createBookingsMutation.isPending
        }
        onConfirm={() => {
          const pending = pendingForceBookingRef.current
          if (!pending) return
          if (pending.action === 'sync') {
            syncBookingsMutation.mutate({
              basisId: pending.basisId,
              force: true,
            })
            return
          }
          createBookingsMutation.mutate({
            basisId: pending.basisId,
            force: true,
          })
        }}
      />
    </Box>
  )
}
