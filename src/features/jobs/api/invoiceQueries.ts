// src/features/jobs/api/invoiceQueries.ts
import { queryOptions } from '@tanstack/react-query'
import { supabase } from '@shared/api/supabase'

import { flattenGroupLeafItems } from '@features/inventory/api/flattenGroupItems'
import { impliedBookedGroupCount } from '../utils/groupBookingQuantity'
import { defaultDescriptionForLine } from '../utils/invoiceLineDescription'

export type BookingInvoiceLine = {
  id: string
  type: 'equipment' | 'crew' | 'transport'
  description: string
  brandName?: string | null
  model?: string | null
  /** Job context for multi-job invoices and description tokens */
  jobId?: string
  jobTitle?: string | null
  jobnr?: number | null
  roleLabel?: string | null
  vehicleName?: string | null
  groupName?: string | null
  itemName?: string | null
  quantity: number
  unitPrice: number // Price ex VAT per unit
  totalPrice: number // Total ex VAT
  vatPercent: number
  /** Billing unit for crew/transport: 'day' or 'hour'. Equipment has no unit. */
  unit?: 'day' | 'hour'
  timePeriodId: string
  timePeriodTitle: string | null
  startAt: string
  endAt: string
}

export type BookingsForInvoice = {
  equipment: Array<BookingInvoiceLine>
  crew: Array<BookingInvoiceLine>
  transport: Array<BookingInvoiceLine>
  all: Array<BookingInvoiceLine>
  totalExVat: number
  totalVat: number
  totalWithVat: number
}

function sumBookingsForInvoice(
  lines: Array<BookingInvoiceLine>,
): BookingsForInvoice {
  const equipment = lines.filter((l) => l.type === 'equipment')
  const crew = lines.filter((l) => l.type === 'crew')
  const transport = lines.filter((l) => l.type === 'transport')
  const totalExVat = lines.reduce((sum, line) => sum + line.totalPrice, 0)
  const totalVat = lines.reduce(
    (sum, line) => sum + (line.totalPrice * line.vatPercent) / 100,
    0,
  )
  return {
    equipment,
    crew,
    transport,
    all: lines,
    totalExVat,
    totalVat,
    totalWithVat: totalExVat + totalVat,
  }
}

export function mergeBookingsForInvoice(
  parts: Array<BookingsForInvoice>,
): BookingsForInvoice {
  const all = parts.flatMap((p) => p.all)
  return sumBookingsForInvoice(all)
}

async function fetchJobBookingsForInvoice({
  jobId,
  companyId,
  defaultVatPercent = 25,
  idPrefix = '',
  jobTitle = null,
  jobnr = null,
}: {
  jobId: string
  companyId: string
  defaultVatPercent?: number
  idPrefix?: string
  jobTitle?: string | null
  jobnr?: number | null
}): Promise<BookingsForInvoice> {
  const lineId = (rawId: string) => (idPrefix ? `${idPrefix}${rawId}` : rawId)

  // Fetch job with customer and crew_pricing_level for crew rates
  const { data: jobData } = await supabase
    .from('jobs')
    .select(
      `title, jobnr, customer_id,
          customer:customers!jobs_customer_id_fkey (
            crew_pricing_level_id,
            crew_pricing_level:crew_pricing_level_id (
              crew_rate_per_day,
              crew_rate_per_hour,
              default_crew_billing_unit
            )
          )`,
    )
    .eq('id', jobId)
    .maybeSingle()

  const resolvedTitle = jobTitle ?? jobData?.title ?? null
  const resolvedJobnr = jobnr ?? jobData?.jobnr ?? null
  const ctx = { jobId, jobTitle: resolvedTitle, jobnr: resolvedJobnr }

  const customer = Array.isArray((jobData as any)?.customer)
    ? (jobData as any)?.customer?.[0]
    : (jobData as any)?.customer
  const crewLevel = Array.isArray(customer?.crew_pricing_level)
    ? customer?.crew_pricing_level?.[0]
    : customer?.crew_pricing_level

  // Fetch company expansion for rates (crew standard + vehicle)
  const { data: companyExpansion } = await supabase
    .from('company_expansions')
    .select(
      'crew_rate_per_day, crew_rate_per_hour, default_crew_billing_unit, vehicle_daily_rate',
    )
    .eq('company_id', companyId)
    .maybeSingle()

  const crewBillingUnit: 'day' | 'hour' =
    (crewLevel?.default_crew_billing_unit ??
      (companyExpansion as { default_crew_billing_unit?: string })
        ?.default_crew_billing_unit ??
      'hour') === 'hour'
      ? 'hour'
      : 'day'
  const crewRatePerDay =
    crewLevel?.crew_rate_per_day ?? companyExpansion?.crew_rate_per_day ?? 0
  const crewRatePerHour =
    crewLevel?.crew_rate_per_hour ?? companyExpansion?.crew_rate_per_hour ?? 0

  const vehicleDailyRate = companyExpansion?.vehicle_daily_rate ?? 0

  // Fetch all time periods for this job
  const { data: timePeriods, error: tpError } = await supabase
    .from('time_periods')
    .select('id, title, start_at, end_at, category')
    .eq('job_id', jobId)
    .eq('deleted', false)

  if (tpError) throw tpError

  if (!timePeriods || timePeriods.length === 0) {
    return {
      equipment: [],
      crew: [],
      transport: [],
      all: [],
      totalExVat: 0,
      totalVat: 0,
      totalWithVat: 0,
    }
  }

  const timePeriodIds = timePeriods.map((tp) => tp.id)
  const timePeriodMap = new Map(timePeriods.map((tp) => [tp.id, tp]))

  // Helper to calculate days between two dates
  const calculateDays = (start: string, end: string): number => {
    const startDate = new Date(start)
    const endDate = new Date(end)
    const diffMs = endDate.getTime() - startDate.getTime()
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
    return Math.max(1, diffDays) // At least 1 day
  }

  const calculateHours = (start: string, end: string): number => {
    const startDate = new Date(start)
    const endDate = new Date(end)
    const diffMs = endDate.getTime() - startDate.getTime()
    return Math.round((diffMs / (1000 * 60 * 60)) * 10) / 10
  }

  // Fetch equipment bookings
  const { data: equipmentBookings, error: eqError } = await supabase
    .from('reserved_items')
    .select(
      `
          id, time_period_id, item_id, quantity, source_kind, source_group_id,
          item:item_id (
            id, name, model,
            brand:brand_id ( name )
          )
        `,
    )
    .in('time_period_id', timePeriodIds)

  if (eqError) throw eqError

  const equipmentDirectBookings =
    equipmentBookings?.filter((b) => b.source_kind !== 'group') ?? []
  const equipmentGroupBookings =
    equipmentBookings?.filter(
      (b) => b.source_kind === 'group' && b.source_group_id,
    ) ?? []

  // Fetch prices separately from item_current_price view (direct items only;
  // group bookings use bundle price from inventory_index).
  const itemIds =
    equipmentDirectBookings
      .map((b) => b.item_id)
      .filter((id): id is string => !!id) ?? []
  const pricesMap = new Map<string, number | null>()
  if (itemIds.length > 0) {
    const { data: prices, error: pricesError } = await supabase
      .from('item_current_price')
      .select('item_id, current_price')
      .in('item_id', itemIds)

    if (pricesError) throw pricesError

    if (prices) {
      for (const price of prices) {
        if (!price.item_id) continue
        pricesMap.set(price.item_id, price.current_price)
      }
    }
  }

  const groupIdsFromBookings = [
    ...new Set(
      equipmentGroupBookings
        .map((b) => b.source_group_id)
        .filter((id): id is string => !!id),
    ),
  ]

  const groupInfoMap = new Map<
    string,
    { name: string; current_price: number }
  >()
  if (groupIdsFromBookings.length > 0) {
    const { data: groupInfo, error: groupInfoError } = await supabase
      .from('inventory_index')
      .select('id, name, current_price, is_group')
      .in('id', groupIdsFromBookings)

    if (groupInfoError) throw groupInfoError

    for (const row of groupInfo || []) {
      if (!row.id || !row.is_group) continue
      groupInfoMap.set(row.id, {
        name: (row.name ?? 'Group').trim() || 'Group',
        current_price: row.current_price ?? 0,
      })
    }
  }

  const groupItemsMap =
    groupIdsFromBookings.length > 0
      ? await flattenGroupLeafItems(groupIdsFromBookings)
      : new Map<string, Array<{ item_id: string; quantity: number }>>()

  type GroupBucket = {
    time_period_id: string
    source_group_id: string
    byItem: Map<string, number>
  }
  const groupBuckets = new Map<string, GroupBucket>()
  for (const booking of equipmentGroupBookings) {
    const gid = booking.source_group_id
    if (!gid || !booking.item_id) continue
    const key = `${booking.time_period_id}:${gid}`
    let bucket = groupBuckets.get(key)
    if (!bucket) {
      bucket = {
        time_period_id: booking.time_period_id,
        source_group_id: gid,
        byItem: new Map(),
      }
      groupBuckets.set(key, bucket)
    }
    const cur = bucket.byItem.get(booking.item_id) ?? 0
    bucket.byItem.set(booking.item_id, cur + (booking.quantity ?? 0))
  }

  // Process equipment: direct item rows + one line per booked group per time period
  const equipmentLines: Array<BookingInvoiceLine> = []

  for (const booking of equipmentDirectBookings) {
    const item = Array.isArray(booking.item) ? booking.item[0] : booking.item
    const timePeriod = timePeriodMap.get(booking.time_period_id)
    if (!item || !timePeriod) continue
    const brand = Array.isArray(item.brand) ? item.brand[0] : item.brand
    const brandName = brand?.name ?? null
    const model = item.model ?? null

    const unitPrice = pricesMap.get(booking.item_id) ?? 0
    const quantity = booking.quantity
    const totalPrice = unitPrice * quantity

    equipmentLines.push({
      id: lineId(booking.id),
      type: 'equipment',
      description: '',
      brandName,
      model,
      itemName: item.name ?? null,
      ...ctx,
      quantity,
      unitPrice,
      totalPrice,
      vatPercent: defaultVatPercent,
      timePeriodId: booking.time_period_id,
      timePeriodTitle: timePeriod.title,
      startAt: timePeriod.start_at,
      endAt: timePeriod.end_at,
    })
  }

  const groupBucketList = Array.from(groupBuckets.values())
  groupBucketList.sort((a, b) => {
    const ta = timePeriodMap.get(a.time_period_id)?.start_at ?? ''
    const tb = timePeriodMap.get(b.time_period_id)?.start_at ?? ''
    const byTime = ta.localeCompare(tb)
    if (byTime !== 0) return byTime
    const na = groupInfoMap.get(a.source_group_id)?.name ?? ''
    const nb = groupInfoMap.get(b.source_group_id)?.name ?? ''
    return na.localeCompare(nb)
  })

  for (const bucket of groupBucketList) {
    const info = groupInfoMap.get(bucket.source_group_id)
    if (!info) continue

    const templateItems = groupItemsMap.get(bucket.source_group_id) ?? []
    if (templateItems.length === 0) continue

    const bookedLines = Array.from(bucket.byItem.entries()).map(
      ([item_id, quantity]) => ({ item_id, quantity }),
    )
    const quantity = impliedBookedGroupCount(templateItems, bookedLines)
    const unitPrice = info.current_price
    const totalPrice = unitPrice * quantity

    const timePeriod = timePeriodMap.get(bucket.time_period_id)
    if (!timePeriod) continue

    equipmentLines.push({
      id: lineId(`group:${bucket.time_period_id}:${bucket.source_group_id}`),
      type: 'equipment',
      description: '',
      brandName: null,
      model: null,
      groupName: info.name,
      ...ctx,
      quantity,
      unitPrice,
      totalPrice,
      vatPercent: defaultVatPercent,
      timePeriodId: bucket.time_period_id,
      timePeriodTitle: timePeriod.title,
      startAt: timePeriod.start_at,
      endAt: timePeriod.end_at,
    })
  }

  for (const line of equipmentLines) {
    line.description = defaultDescriptionForLine(line)
  }

  // Fetch crew roles
  const crewTimePeriodIds = timePeriods
    .filter((tp) => tp.category === 'crew')
    .map((tp) => tp.id)
  const { data: crewRoles, error: crewError } =
    crewTimePeriodIds.length > 0
      ? await supabase
          .from('time_periods')
          .select('id, title, role_category, needed_count, start_at, end_at')
          .in('id', crewTimePeriodIds)
      : { data: [], error: null }

  if (crewError) throw crewError

  // Fetch transport bookings
  const { data: transportBookings, error: transError } = await supabase
    .from('reserved_vehicles')
    .select(
      `
          id, time_period_id, vehicle_id,
          vehicle:vehicle_id (
            id, name
          ),
          time_period:time_period_id (
            id, start_at, end_at
          )
        `,
    )
    .in('time_period_id', timePeriodIds)

  if (transError) throw transError

  // Process crew roles (one line per role, using role title/category - not assigned crew)
  const crewLines: Array<BookingInvoiceLine> = []
  if (crewRoles) {
    for (const role of crewRoles) {
      const timePeriod = timePeriodMap.get(role.id)
      if (!timePeriod) continue

      const startAt = role.start_at
      const endAt = role.end_at
      const neededCount = Math.max(1, role.needed_count ?? 1)
      const roleLabel =
        role.title?.trim() || role.role_category?.trim() || 'technician'

      let quantity: number
      let unitPrice: number
      const unit: 'day' | 'hour' = crewBillingUnit

      if (crewBillingUnit === 'hour') {
        quantity = neededCount * Math.max(0.1, calculateHours(startAt, endAt))
        unitPrice = crewRatePerHour
      } else {
        quantity = neededCount * calculateDays(startAt, endAt)
        unitPrice = crewRatePerDay
      }
      const totalPrice = unitPrice * quantity

      const crewLine: BookingInvoiceLine = {
        id: lineId(role.id),
        type: 'crew',
        description: '',
        brandName: null,
        model: null,
        roleLabel,
        ...ctx,
        quantity,
        unitPrice,
        totalPrice,
        vatPercent: defaultVatPercent,
        unit,
        timePeriodId: role.id,
        timePeriodTitle: timePeriod.title,
        startAt,
        endAt,
      }
      crewLine.description = defaultDescriptionForLine(crewLine)
      crewLines.push(crewLine)
    }
  }

  // Process transport bookings
  const transportLines: Array<BookingInvoiceLine> = []
  if (transportBookings) {
    for (const booking of transportBookings) {
      const vehicle = Array.isArray(booking.vehicle)
        ? booking.vehicle[0]
        : booking.vehicle
      const timePeriod = Array.isArray(booking.time_period)
        ? booking.time_period[0]
        : booking.time_period

      if (!vehicle || !timePeriod) continue

      const startAt = timePeriod.start_at
      const endAt = timePeriod.end_at
      const days = calculateDays(startAt, endAt)

      // Calculate transport cost: daily rate * days
      // Note: Distance-based calculation would require additional data
      const unitPrice = vehicleDailyRate
      const quantity = days
      const totalPrice = unitPrice * quantity

      const transportLine: BookingInvoiceLine = {
        id: lineId(booking.id),
        type: 'transport',
        description: '',
        brandName: null,
        model: null,
        vehicleName: vehicle.name || 'Vehicle',
        ...ctx,
        quantity,
        unitPrice,
        totalPrice,
        vatPercent: defaultVatPercent,
        unit: 'day',
        timePeriodId: booking.time_period_id,
        timePeriodTitle: timePeriod.title || null,
        startAt,
        endAt,
      }
      transportLine.description = defaultDescriptionForLine(transportLine)
      transportLines.push(transportLine)
    }
  }

  // Combine all lines
  const allLines = [...equipmentLines, ...crewLines, ...transportLines]
  return sumBookingsForInvoice(allLines)
}

/**
 * Fetch all bookings for a job with pricing information for invoice creation
 */
export function jobBookingsForInvoiceQuery({
  jobId,
  companyId,
  defaultVatPercent = 25,
}: {
  jobId: string
  companyId: string
  defaultVatPercent?: number
}) {
  return queryOptions<BookingsForInvoice>({
    queryKey: ['jobs', jobId, 'invoice', 'bookings', defaultVatPercent],
    queryFn: () =>
      fetchJobBookingsForInvoice({ jobId, companyId, defaultVatPercent }),
  })
}

/**
 * Aggregate bookings for multiple jobs into one invoice preview payload.
 */
export function jobsBookingsForInvoiceQuery({
  jobIds,
  companyId,
  defaultVatPercent = 25,
}: {
  jobIds: Array<string>
  companyId: string
  defaultVatPercent?: number
}) {
  const sortedIds = [...jobIds].sort()
  return queryOptions<BookingsForInvoice>({
    queryKey: [
      'jobs',
      'multi-invoice',
      'bookings',
      companyId,
      sortedIds.join(','),
      defaultVatPercent,
    ],
    queryFn: async (): Promise<BookingsForInvoice> => {
      if (sortedIds.length === 0) {
        return sumBookingsForInvoice([])
      }

      const { data: jobsMeta } = await supabase
        .from('jobs')
        .select('id, title, jobnr, start_at')
        .in('id', sortedIds)
        .order('start_at', { ascending: true })

      const metaById = new Map(
        (jobsMeta ?? []).map((j) => [
          j.id,
          { title: j.title, jobnr: j.jobnr, start_at: j.start_at },
        ]),
      )

      const orderedIds = [...sortedIds].sort((a, b) => {
        const sa = metaById.get(a)?.start_at ?? ''
        const sb = metaById.get(b)?.start_at ?? ''
        return sa.localeCompare(sb)
      })

      const parts: Array<BookingsForInvoice> = []
      for (const id of orderedIds) {
        const meta = metaById.get(id)
        parts.push(
          await fetchJobBookingsForInvoice({
            jobId: id,
            companyId,
            defaultVatPercent,
            idPrefix: `${id}:`,
            jobTitle: meta?.title ?? null,
            jobnr: meta?.jobnr ?? null,
          }),
        )
      }
      return mergeBookingsForInvoice(parts)
    },
  })
}
