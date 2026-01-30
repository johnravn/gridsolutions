// src/features/jobs/components/dialogs/BookItemsDialog.tsx
import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Badge,
  Box,
  Button,
  Dialog,
  Flex,
  Select,
  Spinner,
  Table,
  Text,
  TextField,
} from '@radix-ui/themes'
import { Search } from 'iconoir-react'
import { supabase } from '@shared/api/supabase'
import { useToast } from '@shared/ui/toast/ToastProvider'
import { addThreeHours } from '@shared/lib/generalFunctions'
import { categoryNamesQuery } from '@features/inventory/api/queries'
import { jobDetailQuery, jobTimePeriodsQuery } from '@features/jobs/api/queries'
import TimePeriodPicker from '@features/calendar/components/reservations/TimePeriodPicker'
import DateTimePicker from '@shared/ui/components/DateTimePicker'
import type { UUID } from '../../types'

const ALL = '__ALL__'

function escapeForPostgrestOr(value: string) {
  return value.replace(/[(),]/g, ' ').replace(/\s+/g, ' ').trim()
}

// Picker result row (unified: item or group)
type PickerRow =
  | {
      kind: 'item'
      id: UUID
      name: string
      category_name: string | null
      brand_name: string | null
      on_hand: number | null
      current_price: number | null
      internally_owned: boolean
      external_owner_name: string | null
      active: boolean
      is_group: false
      unique?: boolean
    }
  | {
      kind: 'group'
      id: UUID
      name: string
      category_name: string | null
      // groups don't have brand/price/on_hand per se; keep nulls to align columns
      brand_name: null
      on_hand: null
      current_price: null
      internally_owned: boolean // groups can be internal or external
      external_owner_name: string | null
      active: boolean
      is_group: true
      unique: boolean | null
    }

// Selection basket row
type Row =
  | {
      kind: 'item'
      item_id: UUID
      name: string
      quantity: number
      on_hand: number | null
    }
  | {
      kind: 'group'
      group_id: UUID
      name: string
      quantity: number
      on_hand: number | null
    }

export default function BookItemsDialog({
  open,
  onOpenChange,
  jobId,
  companyId,
  timePeriodId: initialTimePeriodId,
  externalOnlyInitial = false,
  externalOwnerId,
  onSaved,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  jobId: UUID
  companyId: UUID
  timePeriodId?: UUID | null
  externalOnlyInitial?: boolean
  externalOwnerId?: string // When set, only show items from this owner
  onSaved?: () => void
}) {
  const qc = useQueryClient()
  const [search, setSearch] = React.useState('')
  const [rows, setRows] = React.useState<Array<Row>>([])
  const [quantityDrafts, setQuantityDrafts] = React.useState<
    Record<string, string>
  >({})
  const [selectedTimePeriodId, setSelectedTimePeriodId] = React.useState<
    string | null
  >(initialTimePeriodId ?? null)
  const [message, setMessage] = React.useState<{
    type: 'error' | 'warning' | 'info'
    text: string
  } | null>(null)
  const lastItemNameMapRef = React.useRef<Map<string, string>>(new Map())
  const { success, error, info } = useToast()

  // State for custom time pickers when no equipment period exists
  const [customStartTime, setCustomStartTime] = React.useState<string | null>(
    null,
  )
  const [customEndTime, setCustomEndTime] = React.useState<string | null>(null)
  const [timesTouched, setTimesTouched] = React.useState(false)
  const [autoSetEndTime, setAutoSetEndTime] = React.useState(true)

  // Fetch job details to get duration times
  const { data: job } = useQuery({
    ...jobDetailQuery({ jobId }),
    enabled: open,
  })

  // Fetch time periods to find default
  const { data: timePeriods = [] } = useQuery({
    ...jobTimePeriodsQuery({ jobId }),
    enabled: open,
  })

  // "External only" filter (items whose external_owner_id is set)
  const [externalOnly, setExternalOnly] = React.useState(externalOnlyInitial)

  // Initialize custom times from job duration when dialog opens and no equipment period exists
  React.useEffect(() => {
    if (!open) {
      // Reset state when dialog closes
      setCustomStartTime(null)
      setCustomEndTime(null)
      setTimesTouched(false)
      setAutoSetEndTime(true)
      return
    }

    // Only initialize if no equipment period is selected and job has times
    if (!selectedTimePeriodId && job && job.start_at && job.end_at) {
      // Check for equipment periods - different logic for external vs internal
      if (externalOnly) {
        // For external items, we don't pre-select a period since each owner gets their own
        // Just set default times
        setCustomStartTime(job.start_at)
        setCustomEndTime(job.end_at)
        setTimesTouched(false)
        setAutoSetEndTime(false) // Don't auto-set when loading from job
      } else {
        // For internal items, check for exact "Equipment period" match
        const equipmentPeriod = timePeriods.find(
          (tp) =>
            tp.category === 'equipment' && tp.title === 'Equipment period',
        )

        // If no equipment period exists, set default times from job duration
        if (!equipmentPeriod) {
          setCustomStartTime(job.start_at)
          setCustomEndTime(job.end_at)
          setTimesTouched(false)
          setAutoSetEndTime(false) // Don't auto-set when loading from job
        }
      }
    }
  }, [open, job, timePeriods, selectedTimePeriodId, externalOnly])

  // Auto-set end time when start time changes
  React.useEffect(() => {
    if (!customStartTime || !autoSetEndTime) return
    setCustomEndTime(addThreeHours(customStartTime))
  }, [customStartTime, autoSetEndTime])

  // Set default time period when dialog opens - only use equipment periods
  React.useEffect(() => {
    if (!open || initialTimePeriodId || selectedTimePeriodId) return

    // For external-only mode, don't auto-select a period (each owner gets their own)
    if (externalOnly) return

    // Find "Equipment period" (must be equipment category) for internal items
    const equipmentPeriod = timePeriods.find(
      (tp) => tp.category === 'equipment' && tp.title === 'Equipment period', // Exact match for internal
    )

    if (equipmentPeriod) {
      setSelectedTimePeriodId(equipmentPeriod.id)
      // Clear custom times if equipment period exists
      setCustomStartTime(null)
      setCustomEndTime(null)
      setTimesTouched(false)
    }
  }, [
    open,
    timePeriods,
    initialTimePeriodId,
    selectedTimePeriodId,
    externalOnly,
  ])

  // Update local state when prop changes, but only if it's an equipment period
  React.useEffect(() => {
    if (initialTimePeriodId) {
      const period = timePeriods.find((tp) => tp.id === initialTimePeriodId)
      // Only use initialTimePeriodId if it's an equipment period
      if (period && period.category === 'equipment') {
        setSelectedTimePeriodId(initialTimePeriodId)
      } else if (period && period.category !== 'equipment') {
        // If a non-equipment period is provided, reset to null
        setSelectedTimePeriodId(null)
      }
    }
  }, [initialTimePeriodId, timePeriods])

  // Clear message and reset filters when dialog closes
  React.useEffect(() => {
    if (!open) {
      setMessage(null)
      setExternalOnly(externalOnlyInitial)
      setSearch('')
      setCategoryFilter(null)
    }
  }, [open, externalOnlyInitial])

  // Reset externalOnly when prop changes (e.g., when opening from different views)
  React.useEffect(() => {
    if (open) {
      setExternalOnly(externalOnlyInitial)
    }
  }, [open, externalOnlyInitial])

  // Category filter
  const [categoryFilter, setCategoryFilter] = React.useState<string | null>(
    null,
  )

  const { data: categories = [] } = useQuery({
    ...categoryNamesQuery({ companyId }),
    enabled: open,
  })

  const { data: picker = [], isFetching } = useQuery({
    queryKey: [
      'book-items',
      companyId,
      search,
      externalOnly,
      categoryFilter,
      externalOwnerId,
    ],
    enabled: open,
    queryFn: async (): Promise<Array<PickerRow>> => {
      // Fetch both items and groups from inventory_index
      let q = supabase
        .from('inventory_index')
        .select('*')
        .eq('company_id', companyId)
        .eq('active', true)
        .or('deleted.is.null,deleted.eq.false')
        .limit(100)

      if (externalOwnerId) {
        // When externalOwnerId is provided, only show items/groups from that specific owner
        q = q.eq('external_owner_id', externalOwnerId)
        q = q.or('is_group.eq.true,allow_individual_booking.eq.true')
      } else if (externalOnly) {
        // When external only is enabled, show externally owned items and groups
        // Filter: internally_owned=false AND (is_group=true OR allow_individual_booking=true)
        // Since we filter by internally_owned=false first, the OR will only match external groups
        // or external items that allow individual booking
        q = q.eq('internally_owned', false)
        q = q.or('is_group.eq.true,allow_individual_booking.eq.true')
      } else {
        // For items, filter by allow_individual_booking
        // For groups, always include them
        // Combined: (is_group=true) OR (allow_individual_booking=true)
        q = q.or('is_group.eq.true,allow_individual_booking.eq.true')
      }

      if (search) {
        const term = escapeForPostgrestOr(search)
        q = q.or(
          `name.ilike.%${term}%,category_name.ilike.%${term}%,brand_name.ilike.%${term}%,model.ilike.%${term}%,nicknames.ilike.%${term}%`,
        )
      }
      if (categoryFilter) q = q.eq('category_name', categoryFilter)

      const { data, error: fetchError } = await q
      if (fetchError) throw fetchError

      // Map to PickerRow - separate items from groups
      return data.map((r: any): PickerRow => {
        if (r.is_group) {
          return {
            kind: 'group',
            id: r.id,
            name: r.name,
            category_name: r.category_name ?? null,
            brand_name: null,
            on_hand: r.on_hand ?? null,
            current_price: r.current_price ?? null,
            internally_owned: !!r.internally_owned,
            external_owner_name: r.external_owner_name ?? null,
            active: !!r.active,
            is_group: true,
            unique: r.unique ?? null,
          }
        } else {
          return {
            kind: 'item',
            id: r.id,
            name: r.name,
            category_name: r.category_name ?? null,
            brand_name: r.brand_name ?? null,
            on_hand: r.on_hand ?? null,
            current_price: r.current_price ?? null,
            internally_owned: !!r.internally_owned,
            external_owner_name: r.external_owner_name ?? null,
            active: !!r.active,
            is_group: false,
          }
        }
      })
    },
  })

  const groupedPicker = React.useMemo(() => {
    const groups = new Map<string, Array<PickerRow>>()
    for (const row of picker) {
      const key = row.category_name?.trim() || 'Uncategorized'
      const existing = groups.get(key) ?? []
      existing.push(row)
      groups.set(key, existing)
    }
    return Array.from(groups.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([category, rows]) => ({ category, rows }))
  }, [picker])

  // const add = (it: PickerItem) => {
  //   setRows((r) => {
  //     const i = r.findIndex((x) => x.item_id === it.id)
  //     if (i >= 0) {
  //       const clone = [...r]
  //       clone[i].quantity += 1
  //       return clone
  //     }
  //     return [...r, { item_id: it.id, name: it.name, quantity: 1 }]
  //   })
  // }
  function addRow(p: PickerRow) {
    // Check availability
    const onHand = p.on_hand ?? 0

    // Pre-validate before updating state
    const currentRow =
      p.kind === 'item'
        ? rows.find((x) => x.kind === 'item' && x.item_id === p.id)
        : rows.find((x) => x.kind === 'group' && x.group_id === p.id)

    if (onHand > 0) {
      const nextQty = currentRow ? currentRow.quantity + 1 : 1
      if (nextQty > onHand) {
        setMessage({
          type: 'warning',
          text: `Only ${onHand} ${p.name} available. Booking ${nextQty}.`,
        })
      } else {
        setMessage(null)
      }
    }

    setRows((r) => {
      if (p.kind === 'item') {
        const i = r.findIndex((x) => x.kind === 'item' && x.item_id === p.id)
        if (i >= 0) {
          const clone = [...r]
          clone[i] = { ...clone[i], quantity: clone[i].quantity + 1 } as Row
          return clone
        }
        return [
          ...r,
          {
            kind: 'item',
            item_id: p.id,
            name: p.name,
            quantity: 1,
            on_hand: onHand,
          },
        ]
      } else {
        const i = r.findIndex((x) => x.kind === 'group' && x.group_id === p.id)
        if (i >= 0) {
          const clone = [...r]
          clone[i] = { ...clone[i], quantity: clone[i].quantity + 1 } as Row
          return clone
        }
        return [
          ...r,
          {
            kind: 'group',
            group_id: p.id,
            name: p.name,
            quantity: 1,
            on_hand: onHand,
          },
        ]
      }
    })
  }

  function updateQty(target: Row, qty: number, maxAvailable: number | null) {
    // Warn against available quantity
    if (maxAvailable !== null && maxAvailable > 0 && qty > maxAvailable) {
      setMessage({
        type: 'warning',
        text: `Only ${maxAvailable} available. Booking ${qty}.`,
      })
    } else {
      // Clear any previous messages on success
      setMessage(null)
    }

    setRows((prevRows) =>
      prevRows.map((x) =>
        rowKey(x) === rowKey(target) ? ({ ...x, quantity: qty } as Row) : x,
      ),
    )
  }
  function removeRow(target: Row) {
    setRows((prevRows) => prevRows.filter((x) => rowKey(x) !== rowKey(target)))
  }
  function clearQuantityDraft(key: string) {
    setQuantityDrafts((prev) => {
      if (!(key in prev)) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  const save = useMutation({
    mutationFn: async () => {
      if (rows.length === 0) return

      // If no time period selected but custom times are set, we'll create one
      if (!selectedTimePeriodId && !customStartTime && !customEndTime) {
        throw new Error('Please select a time period or set custom times')
      }

      const itemRows: Array<Extract<Row, { kind: 'item' }>> = rows.filter(
        (r): r is Extract<Row, { kind: 'item' }> => r.kind === 'item',
      )
      const groupRows: Array<Extract<Row, { kind: 'group' }>> = rows.filter(
        (r): r is Extract<Row, { kind: 'group' }> => r.kind === 'group',
      )

      // Get job data - use already fetched job if available, otherwise fetch
      let jobData: { start_at: string | null; end_at: string | null } | null =
        job || null
      if (!jobData) {
        const { data, error: jobErr } = await supabase
          .from('jobs')
          .select('start_at, end_at')
          .eq('id', jobId)
          .single()
        if (jobErr) throw jobErr
        jobData = data as { start_at: string | null; end_at: string | null }
      }

      // Fetch all time periods for this job
      const { data: existingTimePeriods, error: tpErr } = await supabase
        .from('time_periods')
        .select('id, title')
        .eq('job_id', jobId)
      if (tpErr) throw tpErr

      // Map of item_id -> external_owner info
      const itemOwnerMap = new Map<
        string,
        { owner_id: string | null; owner_name: string | null }
      >()

      // Fetch item details to get external_owner_id and owner names
      if (itemRows.length > 0) {
        const itemIds = itemRows.map((r) => r.item_id)
        const { data: itemDetails, error: itemErr } = await supabase
          .from('items')
          .select(
            'id, external_owner_id, external_owner:external_owner_id(id, name)',
          )
          .in('id', itemIds)
        if (itemErr) throw itemErr

        for (const item of itemDetails) {
          let ownerName: string | null = null
          if (item.external_owner_id) {
            const ownerData = Array.isArray(item.external_owner)
              ? item.external_owner[0]
              : item.external_owner
            // Handle case where owner might be deleted (returns null)
            if (ownerData && typeof ownerData === 'object') {
              ownerName = ownerData?.name ?? null
            }
          }
          itemOwnerMap.set(item.id, {
            owner_id: item.external_owner_id,
            owner_name: ownerName,
          })
        }
      }

      // Create time periods for external owners if needed
      const ownerTimePeriodMap = new Map<string, string>() // owner_id -> time_period_id

      for (const ownerInfo of itemOwnerMap.values()) {
        if (!ownerInfo.owner_id || !ownerInfo.owner_name) continue
        if (ownerTimePeriodMap.has(ownerInfo.owner_id)) continue // Already processed

        const expectedTitle = `${ownerInfo.owner_name} Equipment period`
        let tp = existingTimePeriods.find((t) => t.title === expectedTitle)

        if (!tp) {
          // Create the time period with equipment category
          // Use job duration times or custom times if available
          const startTime =
            customStartTime && timesTouched
              ? customStartTime
              : jobData.start_at || customStartTime || new Date().toISOString()
          const endTime =
            customEndTime && timesTouched
              ? customEndTime
              : jobData.end_at || customEndTime || new Date().toISOString()

          const { data: newTp, error: createErr } = await supabase
            .from('time_periods')
            .insert({
              job_id: jobId,
              company_id: companyId,
              title: expectedTitle,
              start_at: startTime,
              end_at: endTime,
              category: 'equipment',
            } as any)
            .select('id, title')
            .single()
          if (createErr) throw createErr
          tp = newTp
          existingTimePeriods.push(newTp)
        }

        ownerTimePeriodMap.set(ownerInfo.owner_id, tp.id)
      }

      // Create or find "Equipment period" for internal items and groups
      const equipmentPeriodTitle = 'Equipment period'
      let internalEquipmentPeriod = existingTimePeriods.find(
        (t) => t.title === equipmentPeriodTitle,
      )

      // Check if we have any internal items or groups that need this period
      const hasInternalItems =
        itemRows.some((r) => {
          const ownerInfo = itemOwnerMap.get(r.item_id)
          return !ownerInfo?.owner_id || !ownerInfo.owner_name
        }) || groupRows.length > 0

      // If no time period selected but we have custom times, create equipment period
      if (
        !selectedTimePeriodId &&
        customStartTime &&
        customEndTime &&
        hasInternalItems
      ) {
        // Determine times: use custom times if touched, otherwise use job duration times
        // If times weren't touched, they should match job duration (default)
        const startTime = timesTouched
          ? customStartTime
          : jobData.start_at || customStartTime || new Date().toISOString()
        const endTime = timesTouched
          ? customEndTime
          : jobData.end_at || customEndTime || new Date().toISOString()

        // Create the equipment period with determined times
        const { data: newTp, error: createErr } = await supabase
          .from('time_periods')
          .insert({
            job_id: jobId,
            company_id: companyId,
            title: equipmentPeriodTitle,
            start_at: startTime,
            end_at: endTime,
            category: 'equipment',
          } as any)
          .select('id, title')
          .single()
        if (createErr) throw createErr
        internalEquipmentPeriod = newTp
        existingTimePeriods.push(newTp)
        // Store the new period ID to use in rest of function
        // Note: We can't use setState here as it's async, so we'll use the variable
      } else if (!internalEquipmentPeriod && hasInternalItems) {
        // Create the equipment period for internal items (existing logic)
        const { data: newTp, error: createErr } = await supabase
          .from('time_periods')
          .insert({
            job_id: jobId,
            company_id: companyId,
            title: equipmentPeriodTitle,
            start_at: jobData.start_at || new Date().toISOString(),
            end_at: jobData.end_at || new Date().toISOString(),
            category: 'equipment',
          } as any)
          .select('id, title')
          .single()
        if (createErr) throw createErr
        internalEquipmentPeriod = newTp
        existingTimePeriods.push(newTp)
      }

      // Collect all time period IDs we'll be using
      const allTimePeriodIds = new Set<string>()
      if (internalEquipmentPeriod) {
        allTimePeriodIds.add(internalEquipmentPeriod.id)
      }
      for (const tpId of ownerTimePeriodMap.values()) {
        allTimePeriodIds.add(tpId)
      }
      // Also include selectedTimePeriodId in case it's used for edge cases
      if (selectedTimePeriodId) {
        allTimePeriodIds.add(selectedTimePeriodId)
      }

      // 1) Fetch existing reserved_items for all relevant time periods
      const { data: existingReservations, error: fetchErr } = await supabase
        .from('reserved_items')
        .select(
          'id, item_id, quantity, source_kind, source_group_id, time_period_id',
        )
        .in('time_period_id', Array.from(allTimePeriodIds))

      if (fetchErr) throw fetchErr

      // Create a lookup map for existing reservations
      // Key format: "item_id:source_kind:source_group_id:time_period_id"
      const existingMap = new Map<string, { id: string; quantity: number }>()
      for (const res of existingReservations) {
        const key = `${res.item_id}:${res.source_kind}:${res.source_group_id || 'null'}:${res.time_period_id}`
        existingMap.set(key, { id: res.id, quantity: res.quantity })
      }

      // 2) build payload for items - use owner-specific time periods for external items
      // Use "Equipment period" for internal items
      const itemPayload = itemRows.map((r) => {
        const ownerInfo = itemOwnerMap.get(r.item_id)
        // Only treat as external if owner_id exists AND owner_name exists (owner not deleted)
        const isExternal = ownerInfo?.owner_id && ownerInfo.owner_name !== null
        const tpId = isExternal
          ? (ownerTimePeriodMap.get(ownerInfo.owner_id!) ??
            selectedTimePeriodId)
          : (internalEquipmentPeriod?.id ?? selectedTimePeriodId)

        return {
          time_period_id: tpId,
          item_id: r.item_id,
          quantity: r.quantity,
          source_kind: 'direct' as const,
          source_group_id: null,
        }
      })
      const groupPayload: Array<any> = []
      if (groupRows.length > 0) {
        // fetch group members in one round trip
        const { data: groupMembers, error: gmErr } = await supabase
          .from('group_items')
          .select('group_id, item_id, quantity')
          .in(
            'group_id',
            groupRows.map((g) => g.group_id),
          )
        if (gmErr) throw gmErr

        const byGroup = new Map<
          string,
          Array<{ item_id: string; quantity: number }>
        >()
        for (const m of groupMembers) {
          const arr = byGroup.get(m.group_id) ?? []
          arr.push({ item_id: m.item_id, quantity: m.quantity })
          byGroup.set(m.group_id, arr)
        }

        for (const g of groupRows) {
          const groupItems = byGroup.get(g.group_id) ?? []
          for (const m of groupItems) {
            groupPayload.push({
              time_period_id:
                internalEquipmentPeriod?.id ?? selectedTimePeriodId, // Groups are always internal, use Equipment period
              item_id: m.item_id,
              quantity: m.quantity * g.quantity, // scale
              source_kind: 'group' as const,
              source_group_id: g.group_id,
            })
          }
        }
      }

      const payload = [...itemPayload, ...groupPayload]
      if (payload.length === 0) return

      // Build item name map early for better error messaging
      const allItemIds = new Set<string>()
      for (const item of payload) {
        allItemIds.add(item.item_id)
      }

      const itemNameMap = new Map<string, string>()
      const itemOnHandMap = new Map<string, number>()

      if (allItemIds.size > 0) {
        const { data: itemDetails, error: itemDetailsErr } = await supabase
          .from('inventory_index')
          .select('id, name, on_hand')
          .eq('company_id', companyId)
          .eq('is_group', false)
          .in('id', Array.from(allItemIds))

        if (itemDetailsErr) throw itemDetailsErr

        for (const item of itemDetails || []) {
          if (item.id && typeof item.id === 'string') {
            itemOnHandMap.set(item.id, item.on_hand ?? 0)
            itemNameMap.set(item.id, item.name || 'Item')
          }
        }
      }

      lastItemNameMapRef.current = itemNameMap

      // 3) Split into updates and inserts
      const toUpdate: Array<{ id: string; quantity: number }> = []
      const toInsert: Array<any> = []

      for (const item of payload) {
        const key = `${item.item_id}:${item.source_kind}:${item.source_group_id || 'null'}:${item.time_period_id}`
        const existing = existingMap.get(key)

        if (existing) {
          // Update existing reservation by adding quantities
          toUpdate.push({
            id: existing.id,
            quantity: existing.quantity + item.quantity,
          })
        } else {
          // Insert new reservation
          toInsert.push(item)
        }
      }

      // 4) Execute updates
      for (const update of toUpdate) {
        const { error: updateErr } = await supabase
          .from('reserved_items')
          .update({ quantity: update.quantity })
          .eq('id', update.id)
        if (updateErr) throw updateErr
      }

      // Check availability before saving
      // Get time period details for the periods we're booking
      const { data: bookingTimePeriods, error: tpDetailsErr } = await supabase
        .from('time_periods')
        .select('id, start_at, end_at')
        .in('id', Array.from(allTimePeriodIds))
        .eq('deleted', false)

      if (tpDetailsErr) throw tpDetailsErr

      if (!bookingTimePeriods || bookingTimePeriods.length === 0) {
        throw new Error('Time periods not found')
      }

      // Find all time periods that overlap with our booking periods
      // Start by including the booking periods themselves
      const overlappingTimePeriodIds = new Set<string>(
        bookingTimePeriods.map((tp) => tp.id),
      )

      // Get all equipment time periods for the company to check for overlaps
      const { data: allEquipmentPeriods, error: allTpErr } = await supabase
        .from('time_periods')
        .select('id, start_at, end_at')
        .eq('company_id', companyId)
        .eq('category', 'equipment')
        .eq('deleted', false)

      if (allTpErr) throw allTpErr

      // Helper function to check if two time periods overlap
      const periodsOverlap = (
        start1: string,
        end1: string,
        start2: string,
        end2: string,
      ): boolean => {
        return (
          new Date(start1) < new Date(end2) && new Date(start2) < new Date(end1)
        )
      }

      // Find overlapping time periods (excluding the booking periods themselves since we already added them)
      for (const bookingPeriod of bookingTimePeriods) {
        for (const otherPeriod of allEquipmentPeriods || []) {
          // Skip if it's one of our booking periods (already included)
          if (overlappingTimePeriodIds.has(otherPeriod.id)) continue

          if (
            periodsOverlap(
              bookingPeriod.start_at,
              bookingPeriod.end_at,
              otherPeriod.start_at,
              otherPeriod.end_at,
            )
          ) {
            overlappingTimePeriodIds.add(otherPeriod.id)
          }
        }
      }

      // Get reservations only from overlapping time periods
      const { data: overlappingReservations, error: overlapResErr } =
        await supabase
          .from('reserved_items')
          .select('item_id, quantity, time_period_id, status')
          .in('item_id', Array.from(allItemIds))
          .in('time_period_id', Array.from(overlappingTimePeriodIds))

      if (overlapResErr) throw overlapResErr

      // Calculate total reserved per item (only from overlapping time periods)
      // Note: This includes updated quantities from the booking periods (after updates executed above)
      const existingReservedMap = new Map<string, number>()
      const plannedReservedMap = new Map<string, number>()
      for (const res of overlappingReservations || []) {
        if (res.status === 'canceled') continue
        const current = existingReservedMap.get(res.item_id) ?? 0
        existingReservedMap.set(res.item_id, current + res.quantity)
        if (res.status === 'planned') {
          const plannedCurrent = plannedReservedMap.get(res.item_id) ?? 0
          plannedReservedMap.set(res.item_id, plannedCurrent + res.quantity)
        }
      }

      // Calculate new bookings per item (only for inserts, not updates)
      // Updates are already reflected in existingReservedMap above
      const newBookingMap = new Map<string, number>()
      for (const item of toInsert) {
        const current = newBookingMap.get(item.item_id) ?? 0
        newBookingMap.set(item.item_id, current + item.quantity)
      }

      // Track potential conflicts as warnings (do not block booking)
      const bookingWarnings: Array<string> = []
      for (const itemId of allItemIds) {
        const onHand = itemOnHandMap.get(itemId) ?? 0
        if (onHand > 0) {
          // Only check availability for items with on_hand set
          // existingQty includes updated quantities from booking periods
          // newQty only includes quantities from new inserts
          const existingQty = existingReservedMap.get(itemId) ?? 0
          const newQty = newBookingMap.get(itemId) ?? 0
          const finalTotal = existingQty + newQty

          if (finalTotal > onHand) {
            const itemName = itemNameMap.get(itemId) ?? 'Item'
            const existingPart =
              existingQty > 0 ? ` (${existingQty} already booked)` : ''
            bookingWarnings.push(
              `${itemName}: Booking ${newQty}${existingPart}, but only ${onHand} available`,
            )
          }
        }

        const plannedQty = plannedReservedMap.get(itemId) ?? 0
        if (plannedQty > 0 && (newBookingMap.get(itemId) ?? 0) > 0) {
          const itemName = itemNameMap.get(itemId) ?? 'Item'
          bookingWarnings.push(
            `${itemName}: ${plannedQty} already planned in overlapping period`,
          )
        }
      }

      // 5) Execute inserts
      if (toInsert.length > 0) {
        const { error: insErr } = await supabase
          .from('reserved_items')
          .insert(toInsert)
        if (insErr) throw insErr
      }

      return { warnings: bookingWarnings }
    },
    onSuccess: async (result) => {
      lastItemNameMapRef.current = new Map()
      await qc.invalidateQueries({ queryKey: ['jobs.equipment', jobId] })
      await qc.invalidateQueries({ queryKey: ['jobs', jobId, 'time_periods'] })
      await qc.invalidateQueries({ queryKey: ['jobs-detail', jobId] })
      // If we created a new equipment period, it will be auto-selected on next open
      // Reset custom times state
      setCustomStartTime(null)
      setCustomEndTime(null)
      setTimesTouched(false)
      onOpenChange(false)
      onSaved?.()
      setRows([])
      success('Success', 'Items are reserved')
      if (result?.warnings?.length) {
        info('Booking warnings', result.warnings.join('\n'), 6000)
      }
    },
    onError: (e: any) => {
      const uuidRegex =
        /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}/g
      const rawMessage = e?.hint || e?.message || 'Please try again.'
      const itemNameMap = lastItemNameMapRef.current
      const friendlyMessage =
        itemNameMap.size > 0
          ? rawMessage.replace(uuidRegex, (match) => {
              const name = itemNameMap.get(match)
              return name ? `${name} (${match})` : match
            })
          : rawMessage

      // For other errors, show toast
      error('Failed to update', friendlyMessage)
    },
  })

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content
        maxWidth="90%"
        style={{ height: '80vh', display: 'flex', flexDirection: 'column' }}
      >
        <Dialog.Title>Book equipment</Dialog.Title>

        {/* Top section: Time Period Picker + Messages */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '65fr 35fr',
            gap: 16,
            marginTop: 8,
            alignItems: 'stretch',
          }}
        >
          {/* LEFT: Time Period Picker or Custom Time Pickers */}
          <div>
            {selectedTimePeriodId ? (
              <TimePeriodPicker
                jobId={jobId}
                value={selectedTimePeriodId}
                onChange={(id) => {
                  setSelectedTimePeriodId(id)
                  // Clear custom times when selecting a period
                  if (id) {
                    setCustomStartTime(null)
                    setCustomEndTime(null)
                    setTimesTouched(false)
                  }
                }}
                categoryFilter="equipment"
                defaultCategory="equipment"
              />
            ) : (
              <Box
                p="3"
                style={{
                  border: '1px dashed var(--gray-a6)',
                  borderRadius: 10,
                  background: 'var(--gray-a2)',
                }}
              >
                <Flex direction="column" gap="3">
                  <Text size="2" weight="bold" color="gray">
                    {externalOnly
                      ? 'Set time period for external equipment'
                      : 'Set equipment time period'}
                  </Text>
                  <Text size="1" color="gray">
                    {externalOnly
                      ? 'Each external owner will get their own time period with these times.'
                      : job && job.start_at && job.end_at
                        ? 'Default times match job duration. Adjust if needed.'
                        : 'Set start and end times for equipment booking.'}
                  </Text>
                  <Flex gap="2" wrap="wrap" align="center">
                    <Box style={{ flex: 1, minWidth: 200 }}>
                      <Text size="1" color="gray" mb="1" as="div">
                        Start time
                      </Text>
                      <DateTimePicker
                        value={customStartTime || ''}
                        onChange={(iso) => {
                          setCustomStartTime(iso)
                          setTimesTouched(true)
                          setAutoSetEndTime(true)
                        }}
                      />
                    </Box>
                    <Box style={{ flex: 1, minWidth: 200 }}>
                      <Text size="1" color="gray" mb="1" as="div">
                        End time
                      </Text>
                      <DateTimePicker
                        value={customEndTime || ''}
                        onChange={(iso) => {
                          setCustomEndTime(iso)
                          setTimesTouched(true)
                          setAutoSetEndTime(false)
                        }}
                      />
                    </Box>
                  </Flex>
                  {!externalOnly && (
                    <Button
                      size="1"
                      variant="soft"
                      onClick={() => {
                        // Switch to time period picker view
                        const equipmentPeriod = timePeriods.find(
                          (tp) =>
                            tp.category === 'equipment' &&
                            tp.title === 'Equipment period',
                        )
                        if (equipmentPeriod) {
                          setSelectedTimePeriodId(equipmentPeriod.id)
                        }
                      }}
                    >
                      Use existing time period
                    </Button>
                  )}
                </Flex>
              </Box>
            )}
          </div>

          {/* RIGHT: Message Area */}
          <div
            style={{
              transition: '100ms',
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 12,
              background: message
                ? message.type === 'error'
                  ? 'var(--red-a3)'
                  : message.type === 'warning'
                    ? 'var(--amber-a3)'
                    : 'var(--blue-a3)'
                : 'var(--gray-a2)',
              border: message
                ? message.type === 'error'
                  ? '1px solid var(--red-a6)'
                  : message.type === 'warning'
                    ? '1px solid var(--amber-a6)'
                    : '1px solid var(--blue-a6)'
                : '1px solid var(--gray-a4)',
            }}
          >
            {message ? (
              <Text
                size="2"
                weight="medium"
                color={
                  message.type === 'error'
                    ? 'red'
                    : message.type === 'warning'
                      ? 'amber'
                      : 'blue'
                }
                style={{
                  textAlign: 'center',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {message.text}
              </Text>
            ) : (
              <Text size="2" color="gray" style={{ textAlign: 'center' }}>
                Messages will appear here
              </Text>
            )}
          </div>
        </div>

        <div
          style={{
            marginTop: 8,
            display: 'grid',
            gridTemplateColumns: '65fr 35fr',
            gap: 16,
            flex: 1,
            minHeight: 0,
          }}
        >
          {/* LEFT: search & results */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              overflowY: 'auto',
            }}
          >
            <Flex gap="2" align="center" wrap="wrap" mb="2">
              {/* category filter */}
              <Select.Root
                value={categoryFilter ?? ALL}
                onValueChange={(v) => setCategoryFilter(v === ALL ? null : v)}
              >
                <Select.Trigger placeholder="Filter category…" />
                <Select.Content style={{ zIndex: 10000 }}>
                  <Select.Item value={ALL}>All</Select.Item>
                  {categories.map((name: string) => (
                    <Select.Item key={name} value={name}>
                      {name}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select.Root>

              {/* External only toggle */}
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  checked={externalOnly}
                  onChange={(e) => setExternalOnly(e.target.checked)}
                />
                <Text as="span">External only</Text>
              </label>
            </Flex>
            <TextField.Root
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name…"
            >
              <TextField.Slot side="left">
                <Search />
              </TextField.Slot>
            </TextField.Root>
            {isFetching ? (
              <Flex align="center" gap="1">
                <Text>Thinking</Text>
                <Spinner />
              </Flex>
            ) : groupedPicker.length === 0 ? (
              <Text color="gray">No results</Text>
            ) : (
              <div
                style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
              >
                {groupedPicker.map((group) => (
                  <Box
                    key={group.category}
                    p="2"
                    style={{
                      border: '1px solid var(--gray-a6)',
                      borderRadius: 8,
                      background: 'var(--gray-a1)',
                    }}
                  >
                    <Text size="2" weight="medium" mb="2">
                      {group.category}
                    </Text>
                    <Table.Root variant="surface">
                      <Table.Header>
                        <Table.Row>
                          <Table.ColumnHeaderCell>Name</Table.ColumnHeaderCell>
                          <Table.ColumnHeaderCell>
                            Category
                          </Table.ColumnHeaderCell>
                          <Table.ColumnHeaderCell>Brand</Table.ColumnHeaderCell>
                          <Table.ColumnHeaderCell>
                            On hand
                          </Table.ColumnHeaderCell>
                          <Table.ColumnHeaderCell>Price</Table.ColumnHeaderCell>
                          <Table.ColumnHeaderCell>Owner</Table.ColumnHeaderCell>
                          <Table.ColumnHeaderCell />
                        </Table.Row>
                      </Table.Header>
                      <Table.Body>
                        {group.rows.map((r) => (
                          <Table.Row key={`${r.kind}:${r.id}`}>
                            {/* Name + badges */}
                            <Table.Cell>
                              <Flex align="center" gap="2">
                                <Text size="2" weight="medium">
                                  {r.name}
                                </Text>
                                {r.is_group && (
                                  <Badge size="1" variant="soft" color="pink">
                                    Group
                                  </Badge>
                                )}
                                {r.is_group && r.unique === true && (
                                  <Badge size="1" variant="soft">
                                    Unique
                                  </Badge>
                                )}
                                {r.active === false && (
                                  <Badge size="1" variant="soft" color="red">
                                    Inactive
                                  </Badge>
                                )}
                              </Flex>
                            </Table.Cell>

                            {/* Category */}
                            <Table.Cell>
                              <Text size="2" color="gray">
                                {r.category_name ?? ''}
                              </Text>
                            </Table.Cell>

                            {/* Brand */}
                            <Table.Cell>
                              <Text size="2" color="gray">
                                {r.brand_name ?? ''}
                              </Text>
                            </Table.Cell>

                            {/* On hand */}
                            <Table.Cell>{r.on_hand ?? ''}</Table.Cell>

                            {/* Price */}
                            <Table.Cell>
                              {r.current_price != null
                                ? formatNOK(r.current_price)
                                : ''}
                            </Table.Cell>

                            {/* Owner */}
                            <Table.Cell>
                              {r.internally_owned ? (
                                <Badge size="1" variant="soft" color="indigo">
                                  Internal
                                </Badge>
                              ) : (
                                <Badge size="1" variant="soft" color="amber">
                                  {r.external_owner_name ?? 'External'}
                                </Badge>
                              )}
                            </Table.Cell>

                            {/* Add */}
                            <Table.Cell align="right">
                              <Button
                                size="1"
                                variant="classic"
                                onClick={() => addRow(r)}
                              >
                                Add
                              </Button>
                            </Table.Cell>
                          </Table.Row>
                        ))}
                      </Table.Body>
                    </Table.Root>
                  </Box>
                ))}
              </div>
            )}
          </div>

          {/* RIGHT: selection */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              overflowY: 'auto',
            }}
          >
            {/* <div
              style={{
                padding: 8,
                border: '1px solid var(--gray-a6)',
                borderRadius: 8,
              }}
            >
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  checked={overrideTimes}
                  onChange={(e) => setOverrideTimes(e.target.checked)}
                />
                <span>Custom time window for these lines</span>
              </label>
              {overrideTimes && (
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <TextField.Root
                    type="datetime-local"
                    value={ovStart}
                    onChange={(e) => setOvStart(e.target.value)}
                  />
                  <TextField.Root
                    type="datetime-local"
                    value={ovEnd}
                    onChange={(e) => setOvEnd(e.target.value)}
                  />
                </div>
              )}
            </div> */}

            <Text size="2" color="gray">
              Selected
            </Text>
            {rows.length === 0 ? (
              <Text color="gray">Nothing selected yet.</Text>
            ) : (
              <Table.Root variant="surface">
                <Table.Header>
                  <Table.Row>
                    <Table.ColumnHeaderCell>Item</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell style={{ width: 110 }}>
                      Qty
                    </Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell />
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {rows.map((r) => (
                    <Table.Row key={rowKey(r)}>
                      <Table.Cell>
                        <Flex align="center" gap="2">
                          <Text>{r.name}</Text>
                          {r.kind === 'group' && (
                            <Badge size="1" variant="soft" color="pink">
                              Group
                            </Badge>
                          )}
                        </Flex>
                      </Table.Cell>
                      <Table.Cell>
                        <TextField.Root
                          type="number"
                          min="1"
                          max={r.on_hand ?? undefined}
                          value={
                            quantityDrafts[rowKey(r)] ?? String(r.quantity)
                          }
                          onChange={(e) => {
                            const nextValue = e.target.value
                            const key = rowKey(r)
                            setQuantityDrafts((prev) => ({
                              ...prev,
                              [key]: nextValue,
                            }))

                            if (nextValue === '') return
                            const parsed = Number(nextValue)
                            if (Number.isNaN(parsed)) return

                            updateQty(r, Math.max(1, parsed), r.on_hand)
                            clearQuantityDraft(key)
                          }}
                          onBlur={() => {
                            const key = rowKey(r)
                            if (quantityDrafts[key] === '') {
                              clearQuantityDraft(key)
                            }
                          }}
                        />
                      </Table.Cell>
                      <Table.Cell align="right">
                        <Button
                          size="1"
                          variant="soft"
                          color="red"
                          onClick={() => removeRow(r)}
                        >
                          Remove
                        </Button>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Root>
            )}
          </div>
        </div>

        <Flex justify="end" gap="2" mt="3">
          <Dialog.Close>
            <Button variant="soft">Cancel</Button>
          </Dialog.Close>
          <Button
            variant="classic"
            onClick={() => save.mutate()}
            disabled={
              save.isPending ||
              rows.length === 0 ||
              (!selectedTimePeriodId && !customStartTime && !customEndTime)
            }
          >
            {save.isPending ? 'Booking…' : 'Book items'}
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  )
}

function rowKey(r: Row) {
  return r.kind === 'item' ? `item:${r.item_id}` : `group:${r.group_id}`
}

function formatNOK(n: number) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'NOK',
  }).format(Number(n))
}
