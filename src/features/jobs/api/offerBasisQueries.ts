import { queryOptions } from '@tanstack/react-query'
import { supabase } from '@shared/api/supabase'
import { getEquipmentConflictsForOfferBooking } from '@features/conflicts/api/equipmentConflictCheck'
import {
  BookingOverlapError,
  forcedBookingFields,
} from '@features/conflicts/api/forceBooking'
import { calculateHoursPerDay } from '../components/dialogs/technical-offer-editor/utils'
import { calculateRentalFactor } from '../utils/offerCalculations'
import { impliedBookedGroupCount } from '../utils/groupBookingQuantity'
import type {
  LocalCrewItem,
  LocalEquipmentGroup,
  LocalTransportGroup,
} from '../components/dialogs/technical-offer-editor/types'
import type { RentalFactorConfig } from '../utils/offerCalculations'
import type {
  JobOffer,
  OfferBasis,
  OfferBasisDetail,
  OfferCrewItem,
  OfferDetail,
  OfferEquipmentGroup,
  OfferEquipmentItem,
  OfferTransportGroup,
  OfferTransportItem,
} from '../types'

export type OfferBasisLineItems = {
  groups: Array<OfferEquipmentGroup & { items: Array<OfferEquipmentItem> }>
  crew_items: Array<OfferCrewItem>
  transport_groups: Array<
    OfferTransportGroup & { items: Array<OfferTransportItem> }
  >
  transport_items: Array<OfferTransportItem>
}

export type JobOfferBasisRow = OfferBasis & {
  offers: Array<JobOffer>
}

function offerDaySpanBetween(start?: string | null, end?: string | null) {
  if (!start || !end) return 1
  const startDate = new Date(start)
  const endDate = new Date(end)
  const diffMs = endDate.getTime() - startDate.getTime()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
  return Math.max(1, diffDays)
}

function basisTitleFromJob(job: {
  title: string | null
  start_at: string | null
  end_at: string | null
}) {
  const jobTitle = (job.title ?? '').trim()
  return jobTitle ? `Offer for ${jobTitle}` : 'Offer basis'
}

async function resolveDefaultBasisPricing(
  jobId: string,
  companyId: string,
): Promise<{
  daysOfUse: number
  discountPercent: number
  vatPercent: 0 | 25
}> {
  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .select(
      `start_at, end_at,
      customer:customers!jobs_customer_id_fkey ( is_partner )`,
    )
    .eq('id', jobId)
    .single()

  if (jobError) throw jobError

  const customer = Array.isArray((job as any).customer)
    ? (job as any).customer[0]
    : (job as any).customer

  const { data: expansion } = await supabase
    .from('company_expansions')
    .select('customer_discount_percent, partner_discount_percent')
    .eq('company_id', companyId)
    .maybeSingle()

  let discountPercent = 0
  if (
    customer?.is_partner &&
    expansion?.partner_discount_percent !== null &&
    expansion?.partner_discount_percent !== undefined
  ) {
    discountPercent = Number(expansion.partner_discount_percent)
  } else if (
    !customer?.is_partner &&
    expansion?.customer_discount_percent !== null &&
    expansion?.customer_discount_percent !== undefined
  ) {
    discountPercent = Number(expansion.customer_discount_percent)
  }

  return {
    daysOfUse: offerDaySpanBetween(job.start_at, job.end_at),
    discountPercent,
    vatPercent: 25,
  }
}

async function syncOfferPricingFromBasis(
  basisId: string,
  pricing: {
    daysOfUse: number
    discountPercent: number
    vatPercent: number
  },
): Promise<void> {
  const { error: basisError } = await supabase
    .from('offer_bases')
    .update({
      days_of_use: pricing.daysOfUse,
      discount_percent: pricing.discountPercent,
      vat_percent: pricing.vatPercent,
    })
    .eq('id', basisId)

  if (basisError) throw basisError

  const { error: offersError } = await supabase
    .from('job_offers')
    .update({
      days_of_use: pricing.daysOfUse,
      discount_percent: pricing.discountPercent,
      vat_percent: pricing.vatPercent,
    })
    .eq('offer_basis_id', basisId)
    .eq('locked', false)

  if (offersError) throw offersError
}

/**
 * List offer bases for a job with nested job_offers.
 */
export function jobOfferBasesQuery(jobId: string) {
  return queryOptions<Array<JobOfferBasisRow>>({
    queryKey: ['job-offer-bases', jobId] as const,
    queryFn: async (): Promise<Array<JobOfferBasisRow>> => {
      const { data: bases, error: basesError } = await supabase
        .from('offer_bases')
        .select('*')
        .eq('job_id', jobId)
        .order('created_at', { ascending: false })

      if (basesError) throw basesError

      const { data: offers, error: offersError } = await supabase
        .from('job_offers')
        .select('*')
        .eq('job_id', jobId)
        .order('version_number', { ascending: false })

      if (offersError) throw offersError

      const offersByBasisId = new Map<string, Array<JobOffer>>()
      for (const offer of (offers || []) as Array<JobOffer>) {
        const list = offersByBasisId.get(offer.offer_basis_id) ?? []
        list.push(offer)
        offersByBasisId.set(offer.offer_basis_id, list)
      }

      const basisIds = new Set(
        ((bases || []) as Array<OfferBasis>).map((b) => b.id),
      )
      const rows: Array<JobOfferBasisRow> = (
        (bases || []) as Array<OfferBasis>
      ).map((basis) => ({
        ...basis,
        offers: offersByBasisId.get(basis.id) ?? [],
      }))

      // Offers whose basis row is missing still appear (e.g. partial import edge cases).
      for (const offer of (offers || []) as Array<JobOffer>) {
        if (basisIds.has(offer.offer_basis_id)) continue
        rows.push({
          id: offer.offer_basis_id || offer.id,
          job_id: offer.job_id,
          company_id: offer.company_id,
          title: offer.title || 'Offer',
          days_of_use: offer.days_of_use,
          discount_percent: offer.discount_percent,
          vat_percent: offer.vat_percent,
          bookings_synced_at: offer.bookings_synced_at,
          created_at: offer.created_at,
          updated_at: offer.updated_at,
          offers: [offer],
        })
      }

      return rows
    },
  })
}

/**
 * Load equipment, crew, and transport line items for an offer basis.
 */
export async function fetchOfferBasisLineItems(
  basisId: string,
): Promise<OfferBasisLineItems> {
  const { data: groups, error: groupsError } = await supabase
    .from('offer_equipment_groups')
    .select('*')
    .eq('offer_basis_id', basisId)
    .order('sort_order', { ascending: true })

  if (groupsError) throw groupsError

  const groupRows = (groups || []) as Array<OfferEquipmentGroup>
  const groupIdsForItems = groupRows.map((g) => g.id).filter(Boolean)

  const itemsByGroupId = new Map<string, Array<any>>()
  const allItemIds: Array<string> = []
  const allGroupIds: Array<string> = []

  if (groupIdsForItems.length > 0) {
    const { data: items, error: itemsError } = await supabase
      .from('offer_equipment_items')
      .select('*')
      .in('offer_group_id', groupIdsForItems)
      .order('sort_order', { ascending: true })

    if (itemsError) throw itemsError

    for (const it of (items || []) as Array<any>) {
      const gid = it.offer_group_id as string
      const list = itemsByGroupId.get(gid) ?? []
      list.push(it)
      itemsByGroupId.set(gid, list)

      if (it.item_id) allItemIds.push(it.item_id)
      if (it.group_id) allGroupIds.push(it.group_id)
    }
  }

  const uniqItemIds = Array.from(new Set(allItemIds))
  const uniqGroupIds = Array.from(new Set(allGroupIds))

  const itemMap = new Map<
    string,
    {
      id: string
      name: string
      item_kind: 'stock' | 'subrental'
      brand?: { id: string; name: string } | null
      model?: string | null
    }
  >()
  const groupMap = new Map<
    string,
    {
      id: string
      name: string
      item_kind: 'stock' | 'subrental'
    }
  >()

  if (uniqItemIds.length > 0) {
    const { data: itemDetails, error: itemsDetailError } = await supabase
      .from('items')
      .select(
        `
                id,
                name,
                item_kind,
                model,
                brand:item_brands ( id, name )
              `,
      )
      .in('id', uniqItemIds)

    if (itemsDetailError) throw itemsDetailError

    for (const item of itemDetails || []) {
      const brand = Array.isArray((item as any).brand)
        ? (item as any).brand[0]
        : (item as any).brand
      itemMap.set((item as any).id, {
        id: (item as any).id,
        name: (item as any).name,
        item_kind: (item as any).item_kind ?? 'stock',
        brand: brand || null,
        model: (item as any).model || null,
      })
    }
  }

  if (uniqGroupIds.length > 0) {
    const { data: groupDetails, error: groupDetailsError } = await supabase
      .from('item_groups')
      .select(
        `
                id,
                name,
                item_kind
              `,
      )
      .in('id', uniqGroupIds)

    if (groupDetailsError) throw groupDetailsError

    for (const g of groupDetails || []) {
      groupMap.set((g as any).id, {
        id: (g as any).id,
        name: (g as any).name,
        item_kind: (g as any).item_kind ?? 'stock',
      })
    }
  }

  const groupsWithItems = groupRows.map((group) => {
    const items = itemsByGroupId.get(group.id) ?? []
    const itemsWithDetails = items.map((item: any) => ({
      ...item,
      item: item.item_id ? itemMap.get(item.item_id) || null : null,
      group: item.group_id ? groupMap.get(item.group_id) || null : null,
    }))

    return {
      ...group,
      items: itemsWithDetails as Array<OfferEquipmentItem>,
    }
  })

  const { data: crewItems, error: crewError } = await supabase
    .from('offer_crew_items')
    .select('*')
    .eq('offer_basis_id', basisId)
    .order('sort_order', { ascending: true })

  if (crewError) throw crewError

  const { data: transportGroupsRaw, error: transportGroupsError } =
    await supabase
      .from('offer_transport_groups')
      .select('*')
      .eq('offer_basis_id', basisId)
      .order('sort_order', { ascending: true })

  if (transportGroupsError) throw transportGroupsError

  const transportGroupRows = (transportGroupsRaw ||
    []) as Array<OfferTransportGroup>
  const transportGroupIds = transportGroupRows.map((g) => g.id).filter(Boolean)

  const transportItemsByGroupId = new Map<string, Array<any>>()
  const transportItemsRaw: Array<any> = []
  if (transportGroupIds.length > 0) {
    const { data: items, error: itemsError } = await supabase
      .from('offer_transport_items')
      .select('*')
      .in('transport_group_id', transportGroupIds)
      .order('sort_order', { ascending: true })

    if (itemsError) throw itemsError
    for (const it of (items || []) as Array<any>) {
      transportItemsRaw.push(it)
      const gid = it.transport_group_id as string
      const list = transportItemsByGroupId.get(gid) ?? []
      list.push(it)
      transportItemsByGroupId.set(gid, list)
    }
  }

  const vehicleIds = transportItemsRaw
    .map((item: any) => item.vehicle_id)
    .filter((id): id is string => id !== null && id !== undefined)

  const vehicleMap = new Map<
    string,
    { id: string; name: string; external_owner_id: string | null }
  >()
  if (vehicleIds.length > 0) {
    const { data: vehicles, error: vehiclesError } = await supabase
      .from('vehicles')
      .select('id, name, external_owner_id')
      .in('id', vehicleIds)

    if (vehiclesError) throw vehiclesError
    if (vehicles) {
      vehicles.forEach((v) => {
        vehicleMap.set(v.id, v)
      })
    }
  }

  const transportGroupsWithItems = transportGroupRows.map((group) => {
    const items = transportItemsByGroupId.get(group.id) ?? []
    return {
      ...group,
      items: items.map((item: any) => ({
        ...item,
        vehicle: item.vehicle_id
          ? vehicleMap.get(item.vehicle_id) || null
          : null,
      })) as Array<OfferTransportItem>,
    }
  })

  const transportItems = transportGroupsWithItems.flatMap((g) => g.items)

  return {
    groups: groupsWithItems,
    crew_items: (crewItems || []) as Array<OfferCrewItem>,
    transport_groups: transportGroupsWithItems,
    transport_items: transportItems,
  }
}

/**
 * Full offer basis detail with line items.
 */
export function offerBasisDetailQuery(basisId: string) {
  return queryOptions<OfferBasisDetail | null>({
    queryKey: ['offer-basis-detail', basisId] as const,
    queryFn: async (): Promise<OfferBasisDetail | null> => {
      const { data: basis, error: basisError } = await supabase
        .from('offer_bases')
        .select('*')
        .eq('id', basisId)
        .maybeSingle()

      if (basisError) throw basisError
      if (!basis) return null

      const lineItems = await fetchOfferBasisLineItems(basisId)

      return {
        ...(basis as OfferBasis),
        ...lineItems,
      }
    },
  })
}

/**
 * Create an empty offer basis row.
 */
export async function createEmptyOfferBasis({
  jobId,
  companyId,
  title,
}: {
  jobId: string
  companyId: string
  title?: string
}): Promise<string> {
  let resolvedTitle = title?.trim()

  if (!resolvedTitle) {
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('title, start_at, end_at')
      .eq('id', jobId)
      .single()

    if (jobError) throw jobError
    resolvedTitle = basisTitleFromJob(job)
  }

  const pricing = await resolveDefaultBasisPricing(jobId, companyId)

  const { data, error } = await supabase
    .from('offer_bases')
    .insert({
      job_id: jobId,
      company_id: companyId,
      title: resolvedTitle,
      days_of_use: pricing.daysOfUse,
      discount_percent: pricing.discountPercent,
      vat_percent: pricing.vatPercent,
    })
    .select('id')
    .single()

  if (error) throw error
  return data.id
}

/**
 * Populate an offer basis from existing job bookings (no job_offer created).
 * When `basisId` is provided, replaces line items on that basis; otherwise creates a new basis first.
 */
export async function createOfferBasisFromBookings({
  jobId,
  companyId,
  basisId: existingBasisId,
}: {
  jobId: string
  companyId: string
  basisId?: string
}): Promise<string> {
  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .select(
      `title, start_at, end_at,
      customer:customers!jobs_customer_id_fkey (
        crew_pricing_level_id,
        crew_pricing_level:crew_pricing_level_id ( crew_rate_per_day, crew_rate_per_hour )
      )`,
    )
    .eq('id', jobId)
    .single()

  if (jobError) throw jobError

  const customer = Array.isArray((job as any)?.customer)
    ? (job as any).customer[0]
    : (job as any)?.customer
  const level = Array.isArray(customer?.crew_pricing_level)
    ? customer?.crew_pricing_level[0]
    : customer?.crew_pricing_level

  const title = basisTitleFromJob(job)
  const daysOfUse = offerDaySpanBetween(job.start_at, job.end_at)

  let basisId = existingBasisId
  if (basisId) {
    await assertOfferBasisEditable(basisId)
    await deleteOfferBasisLineItems(basisId)
    const { error: daysError } = await supabase
      .from('offer_bases')
      .update({ days_of_use: daysOfUse })
      .eq('id', basisId)
    if (daysError) throw daysError
  } else {
    basisId = await createEmptyOfferBasis({
      jobId,
      companyId,
      title,
    })
  }

  const { data: companyExpansion } = await supabase
    .from('company_expansions')
    .select(
      'crew_rate_per_day, vehicle_daily_rate, vehicle_distance_rate, vehicle_distance_increment, rental_factor_config',
    )
    .eq('company_id', companyId)
    .maybeSingle()

  let rentalFactorConfig: RentalFactorConfig | null = null
  try {
    const raw = (companyExpansion as any)?.rental_factor_config
    if (typeof raw === 'string' && raw.trim()) {
      rentalFactorConfig = JSON.parse(raw) as RentalFactorConfig
    } else if (raw && typeof raw === 'object') {
      rentalFactorConfig = raw as RentalFactorConfig
    }
  } catch {
    rentalFactorConfig = null
  }
  const equipmentRentalFactor = calculateRentalFactor(
    daysOfUse,
    rentalFactorConfig,
  )
  const roundMoney = (value: number) => Math.round(value * 100) / 100

  const { data: timePeriods, error: timePeriodError } = await supabase
    .from('time_periods')
    .select(
      'id, title, start_at, end_at, category, needed_count, role_category',
    )
    .eq('job_id', jobId)
    .eq('deleted', false)
    .order('start_at', { ascending: true })

  if (timePeriodError) throw timePeriodError

  if (!timePeriods || timePeriods.length === 0) {
    return basisId
  }

  const timePeriodIds = timePeriods.map((period) => period.id)
  const timePeriodMap = new Map(
    timePeriods.map((period, index) => [
      period.id,
      { ...period, sort_order: index },
    ]),
  )

  const { data: equipmentBookings, error: equipmentError } = await supabase
    .from('reserved_items')
    .select(
      'id, time_period_id, item_id, quantity, source_kind, source_group_id',
    )
    .in('time_period_id', timePeriodIds)

  if (equipmentError) throw equipmentError

  const equipmentDirectBookings =
    equipmentBookings?.filter((booking) => booking.source_kind !== 'group') ??
    []
  const equipmentGroupBookings =
    equipmentBookings?.filter(
      (booking) => booking.source_kind === 'group' && booking.source_group_id,
    ) ?? []

  const equipmentItemIds =
    equipmentDirectBookings
      .map((booking) => booking.item_id)
      .filter((id): id is string => !!id) ?? []

  const itemInternalMap = new Map<string, boolean>()
  if (equipmentItemIds.length > 0) {
    const { data: items, error: itemsError } = await supabase
      .from('items')
      .select('id, item_kind')
      .in('id', equipmentItemIds)

    if (itemsError) throw itemsError

    if (items) {
      for (const item of items) {
        itemInternalMap.set(item.id, item.item_kind === 'stock')
      }
    }
  }

  const itemPriceMap = new Map<string, number>()
  const itemCategoryMap = new Map<string, string | null>()
  if (equipmentItemIds.length > 0) {
    const { data: itemsWithPrice, error: itemsWithPriceError } = await supabase
      .from('items_with_price')
      .select('id, current_price, category_name')
      .in('id', equipmentItemIds)

    if (itemsWithPriceError) throw itemsWithPriceError

    if (itemsWithPrice) {
      for (const item of itemsWithPrice) {
        if (!item.id) continue
        itemPriceMap.set(item.id, item.current_price ?? 0)
        itemCategoryMap.set(item.id, item.category_name ?? null)
      }
    }
  }

  const groupIds =
    equipmentGroupBookings
      .map((booking) => booking.source_group_id)
      .filter((id): id is string => !!id) ?? []

  const groupInfoMap = new Map<
    string,
    {
      category_name: string | null
      current_price: number
      item_kind: 'stock' | 'subrental'
    }
  >()

  if (groupIds.length > 0) {
    const { data: groupInfo, error: groupInfoError } = await supabase
      .from('inventory_index')
      .select('id, category_name, current_price, item_kind, is_group')
      .in('id', groupIds)

    if (groupInfoError) throw groupInfoError

    for (const row of groupInfo || []) {
      if (!row.id || !row.is_group) continue
      groupInfoMap.set(row.id, {
        category_name: row.category_name ?? null,
        current_price: row.current_price ?? 0,
        item_kind: row.item_kind ?? 'stock',
      })
    }
  }

  const groupItemsMap = new Map<
    string,
    Array<{ item_id: string; quantity: number }>
  >()
  if (groupIds.length > 0) {
    const { data: groupItems, error: groupItemsError } = await supabase
      .from('group_items')
      .select('group_id, item_id, quantity')
      .in('group_id', groupIds)

    if (groupItemsError) throw groupItemsError

    for (const row of groupItems || []) {
      if (!row.item_id) continue
      const list = groupItemsMap.get(row.group_id) ?? []
      list.push({ item_id: row.item_id, quantity: row.quantity ?? 1 })
      groupItemsMap.set(row.group_id, list)
    }
  }

  const groupBookingQuantities = new Map<string, Map<string, number>>()
  for (const booking of equipmentGroupBookings) {
    if (!booking.source_group_id || !booking.item_id) continue
    const byItem =
      groupBookingQuantities.get(booking.source_group_id) ?? new Map()
    const currentQty = byItem.get(booking.item_id) ?? 0
    byItem.set(booking.item_id, currentQty + (booking.quantity ?? 0))
    groupBookingQuantities.set(booking.source_group_id, byItem)
  }

  const groupQuantityMap = new Map<string, number>()
  for (const groupId of groupIds) {
    const groupItems = groupItemsMap.get(groupId) ?? []
    if (groupItems.length === 0) continue
    const byItem = groupBookingQuantities.get(groupId) ?? new Map()
    const bookedLines = Array.from(byItem.entries()).map(
      ([item_id, quantity]) => ({ item_id, quantity }),
    )
    groupQuantityMap.set(
      groupId,
      impliedBookedGroupCount(groupItems, bookedLines),
    )
  }

  const equipmentByCategory = new Map<
    string,
    { items: Map<string, number>; groups: Map<string, number> }
  >()

  const ensureCategory = (categoryName: string) => {
    if (!equipmentByCategory.has(categoryName)) {
      equipmentByCategory.set(categoryName, {
        items: new Map(),
        groups: new Map(),
      })
    }
    return equipmentByCategory.get(categoryName)!
  }

  for (const booking of equipmentDirectBookings || []) {
    if (!booking.item_id) continue
    const categoryName = itemCategoryMap.get(booking.item_id) ?? 'Uncategorized'
    const quantity = booking.quantity ?? 1
    const category = ensureCategory(categoryName)
    const currentQty = category.items.get(booking.item_id) ?? 0
    category.items.set(booking.item_id, currentQty + quantity)
  }

  for (const groupId of groupIds) {
    const info = groupInfoMap.get(groupId)
    if (!info) continue
    const categoryName = info.category_name ?? 'Uncategorized'
    const quantity = groupQuantityMap.get(groupId) ?? 1
    const category = ensureCategory(categoryName)
    const currentQty = category.groups.get(groupId) ?? 0
    category.groups.set(groupId, currentQty + quantity)
  }

  const sortedCategoryNames = Array.from(equipmentByCategory.keys()).sort(
    (a, b) => a.localeCompare(b),
  )

  for (const [index, categoryName] of sortedCategoryNames.entries()) {
    const category = equipmentByCategory.get(categoryName)
    if (!category) continue

    const { data: group, error: groupError } = await supabase
      .from('offer_equipment_groups')
      .insert({
        offer_basis_id: basisId,
        group_name: categoryName,
        sort_order: index,
      })
      .select('id')
      .single()

    if (groupError) throw groupError

    const itemLines = Array.from(category.items.entries()).map(
      ([itemId, quantity], itemIndex) => {
        const unitPrice = itemPriceMap.get(itemId) ?? 0
        return {
          offer_group_id: group.id,
          item_id: itemId,
          group_id: null,
          quantity,
          unit_price: unitPrice,
          total_price: roundMoney(unitPrice * quantity * equipmentRentalFactor),
          is_internal: itemInternalMap.get(itemId) ?? true,
          sort_order: itemIndex,
        }
      },
    )

    const groupLines = Array.from(category.groups.entries()).map(
      ([groupId, quantity], groupIndex) => {
        const info = groupInfoMap.get(groupId)
        const unitPrice = info?.current_price ?? 0
        return {
          offer_group_id: group.id,
          item_id: null,
          group_id: groupId,
          quantity,
          unit_price: unitPrice,
          total_price: roundMoney(unitPrice * quantity * equipmentRentalFactor),
          is_internal: info?.item_kind === 'stock',
          sort_order: itemLines.length + groupIndex,
        }
      },
    )

    const itemsToInsert = [...itemLines, ...groupLines]

    if (itemsToInsert.length > 0) {
      const { error: itemsError } = await supabase
        .from('offer_equipment_items')
        .insert(itemsToInsert)

      if (itemsError) throw itemsError
    }
  }

  const crewDailyRate =
    level?.crew_rate_per_day != null
      ? Number(level.crew_rate_per_day)
      : (companyExpansion?.crew_rate_per_day ?? 0)
  const crewPeriods = timePeriods.filter((period) => period.category === 'crew')
  for (const [index, period] of crewPeriods.entries()) {
    const crewCount = Math.max(0, period.needed_count ?? 0)
    if (crewCount === 0) continue

    const startDate =
      period.start_at || job?.start_at || new Date().toISOString()
    const endDate = period.end_at || job?.end_at || new Date().toISOString()
    const dailyRate = crewDailyRate
    const totalPrice =
      dailyRate * crewCount * offerDaySpanBetween(startDate, endDate)

    const { error: crewInsertError } = await supabase
      .from('offer_crew_items')
      .insert({
        offer_basis_id: basisId,
        role_title: period.title?.trim() || 'Crew',
        role_category: period.role_category ?? null,
        crew_count: crewCount,
        start_date: startDate,
        end_date: endDate,
        daily_rate: dailyRate,
        total_price: totalPrice,
        sort_order: index,
      })

    if (crewInsertError) throw crewInsertError
  }

  const { data: transportBookings, error: transportError } = await supabase
    .from('reserved_vehicles')
    .select('id, time_period_id, vehicle_id')
    .in('time_period_id', timePeriodIds)

  if (transportError) throw transportError

  const vehicleIds =
    transportBookings
      ?.map((booking) => booking.vehicle_id)
      .filter((id): id is string => !!id) ?? []

  const vehicleMap = new Map<
    string,
    {
      name: string
      vehicle_category: OfferTransportItem['vehicle_category']
      internally_owned: boolean
    }
  >()
  if (vehicleIds.length > 0) {
    const { data: vehicles, error: vehiclesError } = await supabase
      .from('vehicles')
      .select('id, name, vehicle_category, internally_owned')
      .in('id', vehicleIds)

    if (vehiclesError) throw vehiclesError

    if (vehicles) {
      for (const vehicle of vehicles) {
        vehicleMap.set(vehicle.id, {
          name: vehicle.name,
          vehicle_category: vehicle.vehicle_category ?? null,
          internally_owned: !!vehicle.internally_owned,
        })
      }
    }
  }

  const transportBookingRows = transportBookings ?? []
  let transportSortOrder = 0
  if (transportBookingRows.length > 0) {
    const { data: defaultTransportGroup, error: defaultTransportGroupError } =
      await supabase
        .from('offer_transport_groups')
        .insert({
          offer_basis_id: basisId,
          group_name: 'Transport',
          sort_order: 0,
        })
        .select('id')
        .single()

    if (defaultTransportGroupError) throw defaultTransportGroupError
    const transportGroupId = defaultTransportGroup.id

    for (const booking of transportBookingRows) {
      const period = timePeriodMap.get(booking.time_period_id)
      if (!period) continue
      const vehicle = booking.vehicle_id
        ? vehicleMap.get(booking.vehicle_id)
        : null

      const startDate =
        period.start_at || job?.start_at || new Date().toISOString()
      const endDate = period.end_at || job?.end_at || new Date().toISOString()
      const dailyRate = companyExpansion?.vehicle_daily_rate ?? 0
      const distanceIncrement = Math.max(
        1,
        companyExpansion?.vehicle_distance_increment ?? 150,
      )
      const distanceKm = distanceIncrement
      const distanceRate = companyExpansion?.vehicle_distance_rate ?? 0
      const distanceIncrements = Math.ceil(distanceKm / distanceIncrement)
      const distanceCost =
        distanceRate > 0 && distanceIncrements > 0
          ? distanceRate * distanceIncrements
          : 0
      const totalPrice =
        dailyRate * offerDaySpanBetween(startDate, endDate) + distanceCost

      const { error: transportInsertError } = await supabase
        .from('offer_transport_items')
        .insert({
          offer_basis_id: basisId,
          transport_group_id: transportGroupId,
          vehicle_name: vehicle?.name || 'Vehicle',
          vehicle_id: booking.vehicle_id ?? null,
          vehicle_category: vehicle?.vehicle_category ?? null,
          distance_km: distanceKm,
          start_date: startDate,
          end_date: endDate,
          daily_rate: dailyRate,
          total_price: totalPrice,
          is_internal: vehicle?.internally_owned ?? true,
          sort_order: transportSortOrder,
        })

      if (transportInsertError) throw transportInsertError
      transportSortOrder += 1
    }
  }

  return basisId
}

/**
 * True when any child job_offer linked to this basis is locked.
 */
export async function isOfferBasisLocked(basisId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('job_offers')
    .select('id')
    .eq('offer_basis_id', basisId)
    .eq('locked', true)
    .limit(1)

  if (error) throw error
  return (data?.length ?? 0) > 0
}

/**
 * Throws when the basis cannot be edited (linked offer is locked).
 */
export async function assertOfferBasisEditable(basisId: string): Promise<void> {
  if (await isOfferBasisLocked(basisId)) {
    throw new Error('Offer basis is locked and cannot be edited')
  }
}

export type SaveOfferBasisPayload = {
  basisId: string
  title?: string
  daysOfUse: number
  discountPercent: number
  vatPercent: number
  equipmentGroups: Array<LocalEquipmentGroup>
  crewItems: Array<LocalCrewItem>
  transportGroups: Array<LocalTransportGroup>
}

async function deleteOfferBasisLineItems(basisId: string): Promise<void> {
  const { data: groups, error: groupsError } = await supabase
    .from('offer_equipment_groups')
    .select('id')
    .eq('offer_basis_id', basisId)

  if (groupsError) throw groupsError

  const groupIds = (groups || []).map((g) => g.id)
  if (groupIds.length > 0) {
    const { error: itemsError } = await supabase
      .from('offer_equipment_items')
      .delete()
      .in('offer_group_id', groupIds)
    if (itemsError) throw itemsError
  }

  const { error: equipmentGroupsError } = await supabase
    .from('offer_equipment_groups')
    .delete()
    .eq('offer_basis_id', basisId)
  if (equipmentGroupsError) throw equipmentGroupsError

  const { error: crewError } = await supabase
    .from('offer_crew_items')
    .delete()
    .eq('offer_basis_id', basisId)
  if (crewError) throw crewError

  const { error: transportGroupsError } = await supabase
    .from('offer_transport_groups')
    .delete()
    .eq('offer_basis_id', basisId)
  if (transportGroupsError) throw transportGroupsError
}

/**
 * Persist equipment, crew, and transport line items for an offer basis.
 * Does not update job_offers or recalculate offer totals.
 */
export async function saveOfferBasis({
  basisId,
  title,
  daysOfUse,
  discountPercent,
  vatPercent,
  equipmentGroups,
  crewItems,
  transportGroups,
}: SaveOfferBasisPayload): Promise<void> {
  await assertOfferBasisEditable(basisId)

  const normalizedVat = vatPercent === 0 ? 0 : 25
  const normalizedDiscount = Math.max(0, Math.min(100, discountPercent))
  const normalizedDays = Math.max(1, daysOfUse)

  const { data: basis, error: basisError } = await supabase
    .from('offer_bases')
    .select('company_id')
    .eq('id', basisId)
    .single()

  if (basisError) throw basisError

  if (title !== undefined) {
    const trimmedTitle = title.trim()
    if (!trimmedTitle) {
      throw new Error('Title is required')
    }

    const { error: titleError } = await supabase
      .from('offer_bases')
      .update({ title: trimmedTitle })
      .eq('id', basisId)

    if (titleError) throw titleError
  }

  await syncOfferPricingFromBasis(basisId, {
    daysOfUse: normalizedDays,
    discountPercent: normalizedDiscount,
    vatPercent: normalizedVat,
  })

  const { data: companyExpansion } = await supabase
    .from('company_expansions')
    .select(
      'vehicle_daily_rate, vehicle_distance_rate, vehicle_distance_increment, rental_factor_config',
    )
    .eq('company_id', basis.company_id)
    .maybeSingle()

  let rentalFactorConfig: RentalFactorConfig | null = null
  try {
    const raw = (companyExpansion as { rental_factor_config?: unknown } | null)
      ?.rental_factor_config
    if (typeof raw === 'string' && raw.trim()) {
      rentalFactorConfig = JSON.parse(raw) as RentalFactorConfig
    } else if (raw && typeof raw === 'object') {
      rentalFactorConfig = raw as RentalFactorConfig
    }
  } catch {
    rentalFactorConfig = null
  }

  await deleteOfferBasisLineItems(basisId)

  const equipmentRentalFactor = calculateRentalFactor(
    normalizedDays,
    rentalFactorConfig,
  )
  const roundMoney = (value: number) => Math.round(value * 100) / 100

  for (const group of equipmentGroups) {
    const isExistingGroup = !group.id.startsWith('temp-')

    let groupId: string
    if (isExistingGroup) {
      const { data: upsertedGroup, error: groupErr } = await supabase
        .from('offer_equipment_groups')
        .upsert({
          id: group.id,
          offer_basis_id: basisId,
          group_name: group.group_name,
          sort_order: group.sort_order,
        })
        .select('id')
        .single()

      if (groupErr) throw groupErr
      groupId = upsertedGroup.id
    } else {
      const { data: newGroup, error: groupErr } = await supabase
        .from('offer_equipment_groups')
        .insert({
          offer_basis_id: basisId,
          group_name: group.group_name,
          sort_order: group.sort_order,
        })
        .select('id')
        .single()

      if (groupErr) throw groupErr
      groupId = newGroup.id
    }

    for (const item of group.items) {
      const isExistingItem = !item.id.startsWith('temp-')
      const itemPayload = {
        offer_group_id: groupId,
        item_id: item.item_id,
        group_id: item.group_id ?? null,
        custom_line_description: item.custom_line_description?.trim() || null,
        custom_line_brand: item.custom_line_brand?.trim() || null,
        custom_line_model: item.custom_line_model?.trim() || null,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: roundMoney(
          item.unit_price * item.quantity * equipmentRentalFactor,
        ),
        is_internal: item.is_internal,
        sort_order: item.sort_order,
      }

      if (isExistingItem) {
        const { error: itemErr } = await supabase
          .from('offer_equipment_items')
          .upsert({ id: item.id, ...itemPayload })

        if (itemErr) throw itemErr
      } else {
        const { error: itemErr } = await supabase
          .from('offer_equipment_items')
          .insert(itemPayload)

        if (itemErr) throw itemErr
      }
    }
  }

  for (const item of crewItems) {
    const isExistingItem = !item.id.startsWith('temp-')
    const days = Math.ceil(
      (new Date(item.end_date).getTime() -
        new Date(item.start_date).getTime()) /
        (1000 * 60 * 60 * 24),
    )
    const safeDays = Math.max(1, days)
    let totalPrice = item.daily_rate * item.crew_count * safeDays
    if (item.billing_type === 'hourly' && item.hourly_rate !== null) {
      const hoursPerDay =
        item.hours_per_day ??
        calculateHoursPerDay(item.start_date, item.end_date) ??
        0
      totalPrice = item.hourly_rate * hoursPerDay * item.crew_count * safeDays
    }

    const crewPayload = {
      offer_basis_id: basisId,
      role_title: item.role_title,
      role_category: item.role_category ?? null,
      crew_count: item.crew_count,
      start_date: item.start_date,
      end_date: item.end_date,
      daily_rate: item.daily_rate,
      hourly_rate: item.billing_type === 'hourly' ? item.hourly_rate : null,
      hours_per_day: item.billing_type === 'hourly' ? item.hours_per_day : null,
      billing_type: item.billing_type,
      total_price: totalPrice,
      sort_order: item.sort_order,
    }

    if (isExistingItem) {
      const { error: itemErr } = await supabase
        .from('offer_crew_items')
        .upsert({ id: item.id, ...crewPayload })

      if (itemErr) throw itemErr
    } else {
      const { error: itemErr } = await supabase
        .from('offer_crew_items')
        .insert(crewPayload)

      if (itemErr) throw itemErr
    }
  }

  const distanceIncrementSave = Math.max(
    1,
    companyExpansion?.vehicle_distance_increment ?? 150,
  )

  for (const group of transportGroups) {
    const isExistingGroup = !group.id.startsWith('temp-')

    let groupId: string
    if (isExistingGroup) {
      const { data: upsertedGroup, error: groupErr } = await supabase
        .from('offer_transport_groups')
        .upsert({
          id: group.id,
          offer_basis_id: basisId,
          group_name: group.group_name,
          sort_order: group.sort_order,
        })
        .select('id')
        .single()

      if (groupErr) throw groupErr
      groupId = upsertedGroup.id
    } else {
      const { data: newGroup, error: groupErr } = await supabase
        .from('offer_transport_groups')
        .insert({
          offer_basis_id: basisId,
          group_name: group.group_name,
          sort_order: group.sort_order,
        })
        .select('id')
        .single()

      if (groupErr) throw groupErr
      groupId = newGroup.id
    }

    for (const item of group.items) {
      const isExistingItem = !item.id.startsWith('temp-')
      const days = Math.ceil(
        (new Date(item.end_date).getTime() -
          new Date(item.start_date).getTime()) /
          (1000 * 60 * 60 * 24),
      )
      const derivedDays = Math.max(1, days)
      const daysUsed = item.days_used ?? derivedDays
      const effectiveDailyRate =
        item.daily_rate ?? companyExpansion?.vehicle_daily_rate ?? 0
      const effectiveDistanceRate =
        item.distance_rate ?? companyExpansion?.vehicle_distance_rate ?? null
      const distanceIncrements = item.distance_km
        ? Math.ceil(item.distance_km / distanceIncrementSave)
        : 0
      const distanceCost =
        effectiveDistanceRate && distanceIncrements > 0
          ? effectiveDistanceRate * distanceIncrements
          : 0
      const dailyCost = effectiveDailyRate * Math.max(0, daysUsed)
      const totalPrice = dailyCost + distanceCost

      const transportPayload = {
        offer_basis_id: basisId,
        transport_group_id: groupId,
        vehicle_name: item.vehicle_name,
        vehicle_id: item.vehicle_id ?? undefined,
        vehicle_category: item.vehicle_category,
        distance_km: item.distance_km,
        distance_rate: item.distance_rate ?? null,
        start_date: item.start_date,
        end_date: item.end_date,
        days_used: item.days_used ?? null,
        daily_rate_count: item.daily_rate_count ?? null,
        daily_rate: effectiveDailyRate,
        total_price: totalPrice,
        is_internal: item.is_internal,
        sort_order: item.sort_order,
      }

      if (isExistingItem) {
        const { error: itemErr } = await supabase
          .from('offer_transport_items')
          .upsert({ id: item.id, ...transportPayload })

        if (itemErr) throw itemErr
      } else {
        const insertPayload = { ...transportPayload }
        if (item.vehicle_id === null) {
          delete (insertPayload as { vehicle_id?: string | null }).vehicle_id
        }

        const { error: itemErr } = await supabase
          .from('offer_transport_items')
          .insert(insertPayload)

        if (itemErr) throw itemErr
      }
    }
  }
}

/**
 * Duplicate an offer basis and all child line items.
 */
export async function duplicateOfferBasis(
  sourceBasisId: string,
): Promise<string> {
  const basis = await (
    offerBasisDetailQuery(sourceBasisId)
      .queryFn as () => Promise<OfferBasisDetail | null>
  )()

  if (!basis) throw new Error('Offer basis not found')

  const { data: newBasis, error: basisError } = await supabase
    .from('offer_bases')
    .insert({
      job_id: basis.job_id,
      company_id: basis.company_id,
      title: `${basis.title} (copy)`,
      days_of_use: basis.days_of_use,
      discount_percent: basis.discount_percent,
      vat_percent: basis.vat_percent,
    })
    .select('id')
    .single()

  if (basisError) throw basisError
  const newBasisId = newBasis.id

  if (basis.groups) {
    for (const group of basis.groups) {
      const { data: newGroup, error: groupError } = await supabase
        .from('offer_equipment_groups')
        .insert({
          offer_basis_id: newBasisId,
          group_name: group.group_name,
          sort_order: group.sort_order,
        })
        .select('id')
        .single()

      if (groupError) throw groupError

      if (group.items && group.items.length > 0) {
        const itemsToInsert = group.items.map((item: OfferEquipmentItem) => ({
          offer_group_id: newGroup.id,
          item_id: item.item_id,
          group_id: item.group_id ?? null,
          custom_line_description: item.custom_line_description ?? null,
          custom_line_brand: item.custom_line_brand ?? null,
          custom_line_model: item.custom_line_model ?? null,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.total_price,
          is_internal: item.is_internal,
          sort_order: item.sort_order,
        }))

        const { error: itemsError } = await supabase
          .from('offer_equipment_items')
          .insert(itemsToInsert)

        if (itemsError) throw itemsError
      }
    }
  }

  if (basis.crew_items && basis.crew_items.length > 0) {
    const crewItemsToInsert = basis.crew_items.map((item: OfferCrewItem) => ({
      offer_basis_id: newBasisId,
      role_title: item.role_title,
      role_category: item.role_category ?? null,
      crew_count: item.crew_count,
      start_date: item.start_date,
      end_date: item.end_date,
      daily_rate: item.daily_rate,
      total_price: item.total_price,
      sort_order: item.sort_order,
    }))

    const { error: crewError } = await supabase
      .from('offer_crew_items')
      .insert(crewItemsToInsert)

    if (crewError) throw crewError
  }

  const transportGroups = basis.transport_groups ?? []
  const flatTransportItems = basis.transport_items ?? []

  if (transportGroups.length > 0) {
    for (const group of transportGroups) {
      const { data: newGroup, error: newGroupError } = await supabase
        .from('offer_transport_groups')
        .insert({
          offer_basis_id: newBasisId,
          group_name: group.group_name,
          sort_order: group.sort_order,
        })
        .select('id')
        .single()

      if (newGroupError) throw newGroupError

      const items = group.items ?? []
      if (items.length === 0) continue

      const transportItemsToInsert = items.map((item: OfferTransportItem) => ({
        offer_basis_id: newBasisId,
        transport_group_id: newGroup.id,
        vehicle_name: item.vehicle_name,
        vehicle_id: item.vehicle_id,
        vehicle_category: item.vehicle_category,
        distance_km: item.distance_km,
        distance_rate: item.distance_rate ?? null,
        start_date: item.start_date,
        end_date: item.end_date,
        daily_rate: item.daily_rate,
        total_price: item.total_price,
        is_internal: item.is_internal,
        sort_order: item.sort_order,
      }))

      const { error: transportError } = await supabase
        .from('offer_transport_items')
        .insert(transportItemsToInsert)

      if (transportError) throw transportError
    }
  } else if (flatTransportItems.length > 0) {
    const { data: fallbackGroup, error: fallbackGroupError } = await supabase
      .from('offer_transport_groups')
      .insert({
        offer_basis_id: newBasisId,
        group_name: 'Transport',
        sort_order: 0,
      })
      .select('id')
      .single()

    if (fallbackGroupError) throw fallbackGroupError

    const transportItemsToInsert = flatTransportItems.map(
      (item: OfferTransportItem) => ({
        offer_basis_id: newBasisId,
        transport_group_id: fallbackGroup.id,
        vehicle_name: item.vehicle_name,
        vehicle_id: item.vehicle_id,
        vehicle_category: item.vehicle_category,
        distance_km: item.distance_km,
        distance_rate: item.distance_rate ?? null,
        start_date: item.start_date,
        end_date: item.end_date,
        daily_rate: item.daily_rate,
        total_price: item.total_price,
        is_internal: item.is_internal,
        sort_order: item.sort_order,
      }),
    )

    const { error: transportError } = await supabase
      .from('offer_transport_items')
      .insert(transportItemsToInsert)

    if (transportError) throw transportError
  }

  return newBasisId
}

/**
 * Delete an offer basis and all linked offers and line items.
 */
export async function deleteOfferBasis(basisId: string): Promise<void> {
  if (await isOfferBasisLocked(basisId)) {
    throw new Error('Cannot delete basis while a linked offer is locked')
  }

  const { error: offersError } = await supabase
    .from('job_offers')
    .delete()
    .eq('offer_basis_id', basisId)

  if (offersError) throw offersError

  await deleteOfferBasisLineItems(basisId)

  const { error: basisError } = await supabase
    .from('offer_bases')
    .delete()
    .eq('id', basisId)

  if (basisError) throw basisError
}

export async function markOfferBasisBookingsSynced(
  basisId: string,
): Promise<void> {
  const { error } = await (supabase as any).rpc(
    'mark_offer_basis_bookings_synced',
    {
      p_offer_basis_id: basisId,
    },
  )
  if (error) throw error
}

/**
 * Create bookings from an offer basis line items.
 */
export async function createBookingsFromOfferBasis(
  basisId: string,
  userId: string,
  options?: { force?: boolean; skipConflictCheck?: boolean },
): Promise<void> {
  const basis = await (
    offerBasisDetailQuery(basisId)
      .queryFn as () => Promise<OfferBasisDetail | null>
  )()
  if (!basis) throw new Error('Offer basis not found')

  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .select('id, start_at, end_at, company_id')
    .eq('id', basis.job_id)
    .single()

  if (jobError) throw jobError
  if (!job) throw new Error('Job not found')

  const companyId = job.company_id
  const defaultStart = job.start_at || new Date().toISOString()
  const defaultEnd = job.end_at || new Date().toISOString()

  if (!options?.skipConflictCheck && !options?.force) {
    const preview = await getEquipmentConflictsForOfferBooking({
      offer: basis as unknown as OfferDetail,
      companyId,
      jobId: basis.job_id,
      startAt: defaultStart,
      endAt: defaultEnd,
    })
    if (preview.summaryLines.length > 0 || preview.conflicts.length > 0) {
      throw new BookingOverlapError(preview.summaryLines, preview.conflicts)
    }
  }

  const forcedFields = options?.force ? forcedBookingFields(userId) : {}

  const getOrCreateTimePeriod = async (
    title: string,
    category: 'equipment' | 'crew' | 'transport',
    startAt: string,
    endAt: string,
  ): Promise<string> => {
    const { data: existing } = await supabase
      .from('time_periods')
      .select('id, deleted')
      .eq('job_id', basis.job_id)
      .eq('title', title)
      .eq('category', category)
      .eq('start_at', startAt)
      .eq('end_at', endAt)
      .maybeSingle()

    if (existing) {
      if (existing.deleted) {
        const { error: reviveError } = await supabase
          .from('time_periods')
          .update({ deleted: false, reserved_by_user_id: userId })
          .eq('id', existing.id)

        if (reviveError) throw reviveError
      }
      return existing.id
    }

    const { data: newPeriod, error: periodError } = await supabase
      .from('time_periods')
      .insert({
        job_id: basis.job_id,
        company_id: companyId,
        title,
        category,
        start_at: startAt,
        end_at: endAt,
        reserved_by_user_id: userId,
        deleted: false,
      })
      .select('id')
      .single()

    if (periodError) throw periodError
    return newPeriod.id
  }

  if (basis.groups && basis.groups.length > 0) {
    type EquipmentEntry =
      | {
          kind: 'item'
          item_id: string
          quantity: number
          is_internal: boolean
        }
      | {
          kind: 'group'
          group_id: string
          quantity: number
          is_internal: boolean
        }

    const equipmentEntries: Array<EquipmentEntry> = []
    const groupIds = new Set<string>()

    for (const group of basis.groups) {
      for (const item of group.items) {
        if (item.group_id) {
          groupIds.add(item.group_id)
          equipmentEntries.push({
            kind: 'group',
            group_id: item.group_id,
            quantity: item.quantity,
            is_internal: item.is_internal,
          })
        } else if (item.item_id) {
          equipmentEntries.push({
            kind: 'item',
            item_id: item.item_id,
            quantity: item.quantity,
            is_internal: item.is_internal,
          })
        }
      }
    }

    const groupItemsMap = new Map<
      string,
      Array<{ item_id: string; quantity: number }>
    >()
    if (groupIds.size > 0) {
      const { data: groupItems, error: groupItemsError } = await supabase
        .from('group_items')
        .select('group_id, item_id, quantity')
        .in('group_id', Array.from(groupIds))

      if (groupItemsError) throw groupItemsError

      for (const row of groupItems || []) {
        if (!row.item_id) continue
        const list = groupItemsMap.get(row.group_id) ?? []
        list.push({
          item_id: row.item_id,
          quantity: row.quantity ?? 1,
        })
        groupItemsMap.set(row.group_id, list)
      }
    }

    const timePeriodId = await getOrCreateTimePeriod(
      'Equipment period',
      'equipment',
      defaultStart,
      defaultEnd,
    )

    const reservedItems: Array<{
      time_period_id: string
      item_id: string
      quantity: number
      source_kind: 'direct' | 'group'
      source_group_id: string | null
      forced: boolean
      start_at: null
      end_at: null
      external_status: 'planned' | null
      external_note: null
      subcontractor_id: null
    }> = []

    for (const entry of equipmentEntries) {
      if (entry.kind === 'item') {
        reservedItems.push({
          time_period_id: timePeriodId,
          item_id: entry.item_id,
          quantity: entry.quantity,
          source_kind: 'direct',
          source_group_id: null,
          forced: !!options?.force,
          start_at: null,
          end_at: null,
          external_status: entry.is_internal ? null : 'planned',
          external_note: null,
          subcontractor_id: null,
          ...forcedFields,
        })
        continue
      }

      const groupItems = groupItemsMap.get(entry.group_id) ?? []
      for (const groupItem of groupItems) {
        reservedItems.push({
          time_period_id: timePeriodId,
          item_id: groupItem.item_id,
          quantity: groupItem.quantity * entry.quantity,
          source_kind: 'group',
          source_group_id: entry.group_id,
          forced: !!options?.force,
          start_at: null,
          end_at: null,
          external_status: entry.is_internal ? null : 'planned',
          external_note: null,
          subcontractor_id: null,
          ...forcedFields,
        })
      }
    }

    if (reservedItems.length > 0) {
      const { error: itemsError } = await supabase
        .from('reserved_items')
        .insert(reservedItems)

      if (itemsError) throw itemsError
    }
  }

  if (basis.crew_items && basis.crew_items.length > 0) {
    type CrewAggregate = {
      title: string
      start_at: string
      end_at: string
      needed_count: number
      role_category?: string | null
    }

    const crewAggregates = new Map<string, CrewAggregate>()

    for (const crewItem of basis.crew_items) {
      const roleTitle = crewItem.role_title?.trim() || 'Crew role'
      const startAt = crewItem.start_date || defaultStart
      const endAt = crewItem.end_date || defaultEnd
      const key = `${roleTitle}__${startAt}__${endAt}`

      const existing = crewAggregates.get(key)
      if (existing) {
        existing.needed_count += crewItem.crew_count
        if (!existing.role_category && crewItem.role_category) {
          existing.role_category = crewItem.role_category
        }
      } else {
        crewAggregates.set(key, {
          title: roleTitle,
          start_at: startAt,
          end_at: endAt,
          needed_count: crewItem.crew_count,
          role_category: crewItem.role_category ?? null,
        })
      }
    }

    for (const aggregate of crewAggregates.values()) {
      const { data: existingPeriod, error: crewLookupError } = await supabase
        .from('time_periods')
        .select('id, deleted')
        .eq('job_id', basis.job_id)
        .eq('category', 'crew')
        .eq('title', aggregate.title)
        .eq('start_at', aggregate.start_at)
        .eq('end_at', aggregate.end_at)
        .maybeSingle()

      if (crewLookupError) throw crewLookupError

      if (existingPeriod) {
        const { error: updateError } = await supabase
          .from('time_periods')
          .update({
            needed_count: aggregate.needed_count,
            deleted: false,
            reserved_by_user_id: userId,
            company_id: companyId,
            role_category: aggregate.role_category ?? null,
          })
          .eq('id', existingPeriod.id)

        if (updateError) throw updateError
      } else {
        const { error: insertError } = await supabase
          .from('time_periods')
          .insert({
            job_id: basis.job_id,
            company_id: companyId,
            title: aggregate.title,
            category: 'crew',
            start_at: aggregate.start_at,
            end_at: aggregate.end_at,
            needed_count: aggregate.needed_count,
            reserved_by_user_id: userId,
            deleted: false,
            role_category: aggregate.role_category ?? null,
          })

        if (insertError) throw insertError
      }
    }
  }

  if (basis.transport_items && basis.transport_items.length > 0) {
    type VehicleCandidate = {
      id: string
      name: string
      internally_owned: boolean
      external_owner_id: string | null
      owner_user_id: string | null
      vehicle_category: string | null
    }

    const { data: vehicleRows, error: vehiclesFetchError } = await supabase
      .from('vehicles')
      .select(
        'id, name, internally_owned, external_owner_id, owner_user_id, vehicle_category, deleted',
      )
      .eq('company_id', companyId)
      .or('deleted.is.null,deleted.eq.false')

    if (vehiclesFetchError) throw vehiclesFetchError

    const availableVehicles: Array<VehicleCandidate> = (vehicleRows || [])
      .filter((row: any) => !row.deleted)
      .map((row: any) => ({
        id: row.id as string,
        name: row.name as string,
        internally_owned: !!row.internally_owned,
        external_owner_id: row.external_owner_id ?? null,
        owner_user_id: row.owner_user_id ?? null,
        vehicle_category: row.vehicle_category ?? null,
      }))

    const usedVehicleIds = new Set<string>()

    for (const transportItem of basis.transport_items) {
      const startAt = transportItem.start_date || defaultStart
      const endAt = transportItem.end_date || defaultEnd
      const category = transportItem.vehicle_category ?? null
      const defaultTitleSegment =
        transportItem.vehicle_name?.trim() ||
        category?.replace(/_/g, ' ') ||
        'Vehicle'
      const timePeriodTitle = `Transport - ${defaultTitleSegment} (${startAt})`

      const { data: existingPeriod, error: periodLookupError } = await supabase
        .from('time_periods')
        .select('id, notes, deleted')
        .eq('job_id', basis.job_id)
        .eq('category', 'transport')
        .eq('title', timePeriodTitle)
        .eq('start_at', startAt)
        .eq('end_at', endAt)
        .maybeSingle()

      if (periodLookupError) throw periodLookupError

      let timePeriodId: string

      if (existingPeriod) {
        timePeriodId = existingPeriod.id
        if (existingPeriod.deleted) {
          const { error: reviveError } = await supabase
            .from('time_periods')
            .update({ deleted: false, reserved_by_user_id: userId })
            .eq('id', existingPeriod.id)

          if (reviveError) throw reviveError
        }
      } else {
        const { data: createdPeriod, error: createPeriodError } = await supabase
          .from('time_periods')
          .insert({
            job_id: basis.job_id,
            company_id: companyId,
            title: timePeriodTitle,
            category: 'transport',
            start_at: startAt,
            end_at: endAt,
            reserved_by_user_id: userId,
            deleted: false,
          })
          .select('id')
          .single()

        if (createPeriodError) throw createPeriodError
        timePeriodId = createdPeriod.id
      }

      const existingVehicleId = transportItem.vehicle_id
      let chosenVehicle: VehicleCandidate | undefined

      if (existingVehicleId) {
        chosenVehicle = availableVehicles.find(
          (vehicle) => vehicle.id === existingVehicleId,
        )
        if (!chosenVehicle) {
          chosenVehicle = {
            id: existingVehicleId,
            name: transportItem.vehicle_name || 'Vehicle',
            internally_owned: transportItem.is_internal,
            external_owner_id: transportItem.is_internal
              ? null
              : (transportItem.vehicle?.external_owner_id ?? null),
            owner_user_id: null,
            vehicle_category: category,
          }
        }
      } else if (category) {
        const matches = availableVehicles.filter(
          (vehicle) => vehicle.vehicle_category === category,
        )

        const internalMatch = matches.find(
          (vehicle) =>
            vehicle.internally_owned && !usedVehicleIds.has(vehicle.id),
        )
        const externalMatch = matches.find(
          (vehicle) =>
            !vehicle.internally_owned && !usedVehicleIds.has(vehicle.id),
        )

        chosenVehicle = internalMatch ?? externalMatch ?? undefined
      }

      if (chosenVehicle) {
        usedVehicleIds.add(chosenVehicle.id)

        const { data: existingReservation, error: reservationLookupError } =
          await supabase
            .from('reserved_vehicles')
            .select('id')
            .eq('time_period_id', timePeriodId)
            .eq('vehicle_id', chosenVehicle.id)
            .maybeSingle()

        if (reservationLookupError) throw reservationLookupError

        if (!existingReservation) {
          const { error: insertReservationError } = await supabase
            .from('reserved_vehicles')
            .insert({
              time_period_id: timePeriodId,
              vehicle_id: chosenVehicle.id,
              start_at: null,
              end_at: null,
              external_status: chosenVehicle.internally_owned
                ? null
                : ('planned' as const),
              external_note: null,
            })

          if (insertReservationError) throw insertReservationError
        }

        const { error: clearNotesError } = await supabase
          .from('time_periods')
          .update({ notes: null })
          .eq('id', timePeriodId)

        if (clearNotesError) throw clearNotesError
      } else {
        const message = category
          ? `No available vehicles found for ${category.replace(/_/g, ' ')}`
          : 'No available vehicles found for the requested transport'

        const { error: noteError } = await supabase
          .from('time_periods')
          .update({ notes: message })
          .eq('id', timePeriodId)

        if (noteError) throw noteError
      }
    }
  }

  try {
    await markOfferBasisBookingsSynced(basisId)
  } catch (e) {
    console.warn('Failed to mark offer basis as synced to bookings:', e)
  }
}

export async function syncBookingsFromOfferBasis(
  basisId: string,
  userId: string,
  options?: { force?: boolean },
): Promise<Array<string>> {
  const basis = await (
    offerBasisDetailQuery(basisId)
      .queryFn as () => Promise<OfferBasisDetail | null>
  )()
  if (!basis) throw new Error('Offer basis not found')

  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .select('id, start_at, end_at, company_id')
    .eq('id', basis.job_id)
    .single()

  if (jobError) throw jobError
  if (!job) throw new Error('Job not found')

  const defaultStart = job.start_at || new Date().toISOString()
  const defaultEnd = job.end_at || new Date().toISOString()
  const preview = await getEquipmentConflictsForOfferBooking({
    offer: basis as unknown as OfferDetail,
    companyId: job.company_id,
    jobId: basis.job_id,
    startAt: defaultStart,
    endAt: defaultEnd,
  })

  if (
    !options?.force &&
    (preview.summaryLines.length > 0 || preview.conflicts.length > 0)
  ) {
    throw new BookingOverlapError(preview.summaryLines, preview.conflicts)
  }

  const { data: timePeriods, error: timePeriodsError } = await supabase
    .from('time_periods')
    .select('id')
    .eq('job_id', basis.job_id)
    .in('category', ['equipment', 'crew', 'transport'])

  if (timePeriodsError) throw timePeriodsError

  const timePeriodIds = (timePeriods || []).map((period) => period.id)

  if (timePeriodIds.length > 0) {
    const { error: itemsError } = await supabase
      .from('reserved_items')
      .delete()
      .in('time_period_id', timePeriodIds)
    if (itemsError) throw itemsError

    const { error: crewError } = await supabase
      .from('reserved_crew')
      .delete()
      .in('time_period_id', timePeriodIds)
    if (crewError) throw crewError

    const { error: vehiclesError } = await supabase
      .from('reserved_vehicles')
      .delete()
      .in('time_period_id', timePeriodIds)
    if (vehiclesError) throw vehiclesError

    const { error: periodsError } = await supabase
      .from('time_periods')
      .delete()
      .in('id', timePeriodIds)
    if (periodsError) throw periodsError
  }

  await createBookingsFromOfferBasis(basisId, userId, {
    force: options?.force,
    skipConflictCheck: true,
  })
  return options?.force ? preview.summaryLines : []
}
