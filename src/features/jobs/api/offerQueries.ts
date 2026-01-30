// src/features/jobs/api/offerQueries.ts
import { queryOptions } from '@tanstack/react-query'
import { supabase } from '@shared/api/supabase'
import {
  calculateOfferTotals,
  generateSecureToken,
} from '../utils/offerCalculations'
import { exportOfferAsPDF } from '../utils/offerPdfExport'
import type {
  JobOffer,
  OfferAcceptance,
  OfferCrewItem,
  OfferDetail,
  OfferEquipmentGroup,
  OfferEquipmentItem,
  OfferPrettySection,
  OfferRejection,
  OfferRevisionRequest,
  OfferStatus,
  OfferTransportItem,
  OfferType,
  PrettySectionType,
} from '../types'

// Query functions for offer management

/**
 * Get all offers for a job
 */
export function jobOffersQuery(jobId: string) {
  return queryOptions<Array<JobOffer>>({
    queryKey: ['job-offers', jobId] as const,
    queryFn: async (): Promise<Array<JobOffer>> => {
      const { data, error } = await supabase
        .from('job_offers')
        .select('*')
        .eq('job_id', jobId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data || []) as Array<JobOffer>
    },
  })
}

/**
 * Get detailed offer with all items and groups
 */
export function offerDetailQuery(offerId: string) {
  return queryOptions<OfferDetail | null>({
    queryKey: ['offer-detail', offerId] as const,
    queryFn: async (): Promise<OfferDetail | null> => {
      // Fetch main offer
      const { data: offer, error: offerError } = await supabase
        .from('job_offers')
        .select(
          `
          *,
          job:jobs!job_offers_job_id_fkey (
            id,
            title,
            customer_id,
            customer_contact_id,
            project_lead_user_id,
            customer:customer_id (
              id,
              name,
              email,
              phone,
              address,
              logo_path
            ),
            customer_contact:contacts!jobs_customer_contact_id_fkey (
              id,
              name,
              phone,
              email,
              title
            ),
            project_lead:profiles!jobs_project_lead_user_id_fkey (
              user_id,
              display_name,
              email,
              phone
            )
          ),
          company:companies!job_offers_company_id_fkey (
            id,
            name,
            address,
            logo_light_path,
            logo_dark_path,
            accent_color
          )
        `,
        )
        .eq('id', offerId)
        .maybeSingle()

      if (offerError) throw offerError
      if (!offer) return null

      // Fetch equipment groups
      const { data: groups, error: groupsError } = await supabase
        .from('offer_equipment_groups')
        .select('*')
        .eq('offer_id', offerId)
        .order('sort_order', { ascending: true })

      if (groupsError) throw groupsError

      // Fetch equipment items for each group
      // Note: We fetch items separately to avoid PostgREST relationship ambiguity
      const groupsWithItems = await Promise.all(
        (groups || []).map(async (group: OfferEquipmentGroup) => {
          const { data: items, error: itemsError } = await supabase
            .from('offer_equipment_items')
            .select('*')
            .eq('offer_group_id', group.id)
            .order('sort_order', { ascending: true })

          if (itemsError) throw itemsError

          // Fetch item/group details separately
          const itemIds = (items || [])
            .map((item: any) => item.item_id)
            .filter((id): id is string => id !== null && id !== undefined)
          const groupIds = (items || [])
            .map((item: any) => item.group_id)
            .filter((id): id is string => id !== null && id !== undefined)

          const itemMap = new Map<
            string,
            {
              id: string
              name: string
              internally_owned: boolean
              external_owner_id: string | null
              external_owner_name: string | null
              brand?: { id: string; name: string } | null
              model?: string | null
            }
          >()
          const groupMap = new Map<
            string,
            {
              id: string
              name: string
              internally_owned: boolean
              external_owner_id: string | null
              external_owner_name: string | null
            }
          >()

          if (itemIds.length > 0) {
            const { data: itemDetails, error: itemsDetailError } =
              await supabase
                .from('items')
                .select(
                  `
                id,
                name,
                internally_owned,
                external_owner_id,
                model,
                external_owner:customers!items_external_owner_id_fkey ( id, name ),
                brand:item_brands ( id, name )
              `,
                )
                .in('id', itemIds)

            if (itemsDetailError) throw itemsDetailError

            if (itemDetails) {
              itemDetails.forEach((item: any) => {
                const brand = Array.isArray(item.brand)
                  ? item.brand[0]
                  : item.brand
                itemMap.set(item.id, {
                  id: item.id,
                  name: item.name,
                  internally_owned: !!item.internally_owned,
                  external_owner_id: item.external_owner_id ?? null,
                  external_owner_name: item.external_owner?.name ?? null,
                  brand: brand || null,
                  model: item.model || null,
                })
              })
            }
          }

          if (groupIds.length > 0) {
            const { data: groupDetails, error: groupDetailsError } =
              await supabase
                .from('item_groups')
                .select(
                  `
                id,
                name,
                internally_owned,
                external_owner_id,
                external_owner:customers!item_groups_external_owner_id_fkey ( id, name )
              `,
                )
                .in('id', groupIds)

            if (groupDetailsError) throw groupDetailsError

            if (groupDetails) {
              groupDetails.forEach((group: any) => {
                groupMap.set(group.id, {
                  id: group.id,
                  name: group.name,
                  internally_owned: !!group.internally_owned,
                  external_owner_id: group.external_owner_id ?? null,
                  external_owner_name: group.external_owner?.name ?? null,
                })
              })
            }
          }

          // Combine items with their details
          const itemsWithDetails = (items || []).map((item: any) => ({
            ...item,
            item: item.item_id ? itemMap.get(item.item_id) || null : null,
            group: item.group_id ? groupMap.get(item.group_id) || null : null,
          }))

          return {
            ...group,
            items: itemsWithDetails as Array<OfferEquipmentItem>,
          }
        }),
      )

      // Fetch crew items
      const { data: crewItems, error: crewError } = await supabase
        .from('offer_crew_items')
        .select('*')
        .eq('offer_id', offerId)
        .order('sort_order', { ascending: true })

      if (crewError) throw crewError

      // Fetch transport items
      // Note: We fetch vehicles separately to avoid PostgREST relationship ambiguity
      // when multiple relationships exist for vehicle_id
      const { data: transportItemsRaw, error: transportError } = await supabase
        .from('offer_transport_items')
        .select('*')
        .eq('offer_id', offerId)
        .order('sort_order', { ascending: true })

      if (transportError) throw transportError

      // Fetch vehicles separately if any transport items have vehicle_id
      const vehicleIds = (transportItemsRaw || [])
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

      // Combine transport items with vehicle data
      const transportItems = (transportItemsRaw || []).map((item: any) => ({
        ...item,
        vehicle: item.vehicle_id
          ? vehicleMap.get(item.vehicle_id) || null
          : null,
      }))

      // Fetch pretty sections (if this is a pretty offer)
      let prettySections: Array<OfferPrettySection> | undefined
      if (offer.offer_type === 'pretty') {
        const { data: sections, error: sectionsError } = await supabase
          .from('offer_pretty_sections')
          .select('*')
          .eq('offer_id', offerId)
          .order('sort_order', { ascending: true })

        if (sectionsError) throw sectionsError
        prettySections = (sections || []) as Array<OfferPrettySection>
      }

      const offerDetail: OfferDetail = {
        ...offer,
        bookings_synced_at: (offer as any).bookings_synced_at ?? null,
        groups: groupsWithItems,
        crew_items: (crewItems || []) as Array<OfferCrewItem>,
        transport_items: (transportItems || []) as Array<OfferTransportItem>,
        pretty_sections: prettySections,
      } as OfferDetail

      // Add customer, contact, project lead, and company info
      const job = (offer as any).job
      if (job) {
        const jobData = Array.isArray(job) ? job[0] : job
        offerDetail.job_title = jobData?.title ?? null

        const customer = Array.isArray(jobData?.customer)
          ? jobData.customer[0]
          : jobData?.customer
        if (customer) {
          offerDetail.customer = {
            id: customer.id,
            name: customer.name,
            email: customer.email,
            phone: customer.phone,
            address: customer.address,
            logo_path: customer.logo_path,
          }
        }

        const customerContact = Array.isArray(jobData?.customer_contact)
          ? jobData.customer_contact[0]
          : jobData?.customer_contact
        if (customerContact) {
          offerDetail.customer_contact = {
            id: customerContact.id,
            name: customerContact.name,
            phone: customerContact.phone,
            email: customerContact.email,
          }
        }

        const projectLead = Array.isArray(jobData?.project_lead)
          ? jobData.project_lead[0]
          : jobData?.project_lead
        if (projectLead) {
          offerDetail.project_lead = {
            user_id: projectLead.user_id,
            display_name: projectLead.display_name,
            email: projectLead.email,
            phone: projectLead.phone,
          }
        }
      }

      const offerCompany = (offer as any).company
      if (offerCompany) {
        const companyData = Array.isArray(offerCompany)
          ? offerCompany[0]
          : offerCompany
        if (companyData) {
          offerDetail.company = {
            id: companyData.id,
            name: companyData.name,
            address: companyData.address,
            logo_light_path: companyData.logo_light_path ?? null,
            logo_dark_path: companyData.logo_dark_path ?? null,
            accent_color: companyData.accent_color ?? null,
          }
        }
      }

      // Add company expansion rates for transport defaults
      const { data: expansion, error: expansionError } = await supabase
        .from('company_expansions')
        .select(
          'vehicle_daily_rate, vehicle_distance_rate, vehicle_distance_increment',
        )
        .eq('company_id', offer.company_id)
        .maybeSingle()

      if (!expansionError && expansion) {
        offerDetail.company_expansion = {
          vehicle_daily_rate: expansion.vehicle_daily_rate ?? null,
          vehicle_distance_rate: expansion.vehicle_distance_rate ?? null,
          vehicle_distance_increment:
            expansion.vehicle_distance_increment ?? null,
        }
      }

      return offerDetail
    },
  })
}

/**
 * Public access to offer via access token
 */
export function publicOfferQuery(accessToken: string) {
  return queryOptions<OfferDetail | null>({
    queryKey: ['public-offer', accessToken] as const,
    queryFn: async (): Promise<OfferDetail | null> => {
      const { data, error } = await (supabase as any).rpc('public_offer_get', {
        p_access_token: accessToken,
      })
      if (error) throw error
      return (data ?? null) as OfferDetail | null
    },
  })
}

/**
 * Create a new offer
 */
export async function createOffer(payload: {
  jobId: string
  companyId: string
  offerType: OfferType
  title: string
  daysOfUse: number
  discountPercent: number
  vatPercent: number
  showPricePerLine?: boolean
  basedOnOfferId?: string | null
}): Promise<string> {
  // Generate access token
  const accessToken = generateSecureToken()

  // Get next version number for this job
  const { data: existingOffers } = await supabase
    .from('job_offers')
    .select('version_number')
    .eq('job_id', payload.jobId)
    .order('version_number', { ascending: false })
    .limit(1)

  const versionNumber =
    existingOffers && existingOffers.length > 0
      ? existingOffers[0].version_number + 1
      : 1

  const { data, error } = await supabase
    .from('job_offers')
    .insert({
      job_id: payload.jobId,
      company_id: payload.companyId,
      offer_type: payload.offerType,
      version_number: versionNumber,
      status: 'draft',
      access_token: accessToken,
      title: payload.title,
      days_of_use: payload.daysOfUse,
      discount_percent: payload.discountPercent,
      vat_percent: payload.vatPercent,
      show_price_per_line: payload.showPricePerLine ?? true,
      based_on_offer_id: payload.basedOnOfferId || null,
      locked: false,
      equipment_subtotal: 0,
      crew_subtotal: 0,
      transport_subtotal: 0,
      total_before_discount: 0,
      total_after_discount: 0,
      total_with_vat: 0,
    })
    .select('id')
    .single()

  if (error) throw error
  return data.id
}

/**
 * Create a technical offer based on existing bookings.
 */
export async function createTechnicalOfferFromBookings({
  jobId,
  companyId,
}: {
  jobId: string
  companyId: string
}): Promise<string> {
  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .select('title, start_at, end_at')
    .eq('id', jobId)
    .single()

  if (jobError) throw jobError

  const jobTitle = job?.title?.trim()
  const title = jobTitle
    ? `Offer for ${jobTitle} (bookings)`
    : 'Offer based on bookings'

  const calculateDays = (start?: string | null, end?: string | null) => {
    if (!start || !end) return 1
    const startDate = new Date(start)
    const endDate = new Date(end)
    const diffMs = endDate.getTime() - startDate.getTime()
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
    return Math.max(1, diffDays)
  }

  const daysOfUse = calculateDays(job?.start_at ?? null, job?.end_at ?? null)

  const offerId = await createOffer({
    jobId,
    companyId,
    offerType: 'technical',
    title,
    daysOfUse,
    discountPercent: 0,
    vatPercent: 25,
    showPricePerLine: true,
  })

  const { data: companyExpansion } = await supabase
    .from('company_expansions')
    .select(
      'crew_rate_per_day, vehicle_daily_rate, vehicle_distance_rate, vehicle_distance_increment',
    )
    .eq('company_id', companyId)
    .maybeSingle()

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
    await recalculateOfferTotals(offerId)
    return offerId
  }

  const timePeriodIds = timePeriods.map((period) => period.id)
  const timePeriodMap = new Map(
    timePeriods.map((period, index) => [
      period.id,
      { ...period, sort_order: index },
    ]),
  )

  // Equipment bookings
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
      .select('id, internally_owned')
      .in('id', equipmentItemIds)

    if (itemsError) throw itemsError

    if (items) {
      for (const item of items) {
        itemInternalMap.set(item.id, !!item.internally_owned)
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
      internally_owned: boolean
    }
  >()

  if (groupIds.length > 0) {
    const { data: groupInfo, error: groupInfoError } = await supabase
      .from('inventory_index')
      .select('id, category_name, current_price, internally_owned, is_group')
      .in('id', groupIds)

    if (groupInfoError) throw groupInfoError

    for (const row of groupInfo || []) {
      if (!row.id || !row.is_group) continue
      groupInfoMap.set(row.id, {
        category_name: row.category_name ?? null,
        current_price: row.current_price ?? 0,
        internally_owned: !!row.internally_owned,
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
    let minRatio = Number.POSITIVE_INFINITY
    for (const groupItem of groupItems) {
      if (!groupItem.item_id || groupItem.quantity <= 0) continue
      const bookedQty =
        groupBookingQuantities.get(groupId)?.get(groupItem.item_id) ?? 0
      const ratio = bookedQty / groupItem.quantity
      minRatio = Math.min(minRatio, ratio)
    }
    const computedQty =
      Number.isFinite(minRatio) && minRatio > 0 ? Math.floor(minRatio) : 1
    groupQuantityMap.set(groupId, Math.max(1, computedQty))
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
        offer_id: offerId,
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
          total_price: unitPrice * quantity,
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
          total_price: unitPrice * quantity,
          is_internal: info?.internally_owned ?? true,
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

  // Crew roles (time periods with needed_count)
  const crewPeriods = timePeriods.filter((period) => period.category === 'crew')
  for (const [index, period] of crewPeriods.entries()) {
    const crewCount = Math.max(0, period.needed_count ?? 0)
    if (crewCount === 0) continue

    const startDate =
      period.start_at || job?.start_at || new Date().toISOString()
    const endDate = period.end_at || job?.end_at || new Date().toISOString()
    const dailyRate = companyExpansion?.crew_rate_per_day ?? 0
    const totalPrice = dailyRate * crewCount * calculateDays(startDate, endDate)

    const { error: crewInsertError } = await supabase
      .from('offer_crew_items')
      .insert({
        offer_id: offerId,
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

  // Transport bookings
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

  let transportSortOrder = 0
  for (const booking of transportBookings || []) {
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
      dailyRate * calculateDays(startDate, endDate) + distanceCost

    const { error: transportInsertError } = await supabase
      .from('offer_transport_items')
      .insert({
        offer_id: offerId,
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

  await recalculateOfferTotals(offerId)
  return offerId
}

/**
 * Update offer totals based on items
 */
export async function recalculateOfferTotals(offerId: string): Promise<void> {
  // Retry logic: sometimes after inserting items, there's a brief delay
  // before they're available in queries
  let offer: OfferDetail | null = null
  let lastError: Error | null = null

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      offer = await offerDetailQuery(offerId).queryFn()
      if (offer) break
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      // If it's not the last attempt, wait a bit before retrying
      if (attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 100 * (attempt + 1)))
      }
    }
  }

  if (!offer) {
    const errorMsg = lastError?.message || 'Offer not found'
    throw new Error(`Failed to fetch offer for recalculation: ${errorMsg}`)
  }

  const equipmentItems =
    offer.groups?.flatMap((g) =>
      (g.items || []).map((item: OfferEquipmentItem) => ({
        ...item,
        total_price: item.unit_price * item.quantity,
      })),
    ) || []

  const crewItems = offer.crew_items || []
  const transportItems = offer.transport_items || []

  // Fetch company expansion to get vehicle rates
  let vehicleDistanceRate: number | null = null
  let vehicleDistanceIncrement: number | null = null
  if (offer.company_id) {
    const { data: expansion } = await supabase
      .from('company_expansions')
      .select('vehicle_distance_rate, vehicle_distance_increment')
      .eq('company_id', offer.company_id)
      .maybeSingle()
    if (expansion) {
      vehicleDistanceRate = expansion.vehicle_distance_rate
      vehicleDistanceIncrement = expansion.vehicle_distance_increment ?? 150
    }
  }

  const totals = calculateOfferTotals(
    equipmentItems,
    crewItems,
    transportItems,
    offer.days_of_use,
    offer.discount_percent,
    offer.vat_percent,
    vehicleDistanceRate,
    vehicleDistanceIncrement,
  )

  // Update offer with new totals
  const { error } = await supabase
    .from('job_offers')
    .update({
      equipment_subtotal: totals.equipmentSubtotal,
      crew_subtotal: totals.crewSubtotal,
      transport_subtotal: totals.transportSubtotal,
      total_before_discount: totals.totalBeforeDiscount,
      total_after_discount: totals.totalAfterDiscount,
      total_with_vat: totals.totalWithVAT,
    })
    .eq('id', offerId)

  if (error) throw error
}

/**
 * Lock an offer (prevents further editing)
 */
export async function lockOffer(offerId: string): Promise<void> {
  const { data: offer, error: offerError } = await supabase
    .from('job_offers')
    .select('id, job_id, version_number')
    .eq('id', offerId)
    .single()

  if (offerError) throw offerError

  const { error } = await supabase
    .from('job_offers')
    .update({
      locked: true,
      status: 'sent',
      sent_at: new Date().toISOString(),
    })
    .eq('id', offerId)

  if (error) throw error

  const { error: supersedeError } = await supabase
    .from('job_offers')
    .update({
      status: 'superseded',
      locked: true,
    })
    .eq('job_id', offer.job_id)
    .lt('version_number', offer.version_number)
    .in('status', ['draft', 'sent', 'viewed'])

  if (supersedeError) throw supersedeError
}

/**
 * Accept an offer (public access)
 */
export async function acceptOffer(
  accessToken: string,
  acceptance: OfferAcceptance,
): Promise<void> {
  const { error } = await (supabase as any).rpc('public_offer_accept', {
    p_access_token: accessToken,
    p_first_name: acceptance.first_name,
    p_last_name: acceptance.last_name,
    p_phone: acceptance.phone,
  })
  if (error) throw error
}

/**
 * Reject an offer (public access)
 */
export async function rejectOffer(
  accessToken: string,
  rejection: OfferRejection,
): Promise<void> {
  const { error } = await (supabase as any).rpc('public_offer_reject', {
    p_access_token: accessToken,
    p_first_name: rejection.first_name,
    p_last_name: rejection.last_name,
    p_phone: rejection.phone,
    p_comment: rejection.comment || '',
  })
  if (error) throw error
}

/**
 * Request revision of an offer (public access)
 */
export async function requestOfferRevision(
  accessToken: string,
  revisionRequest: OfferRevisionRequest,
): Promise<void> {
  const { error } = await (supabase as any).rpc('public_offer_request_revision', {
    p_access_token: accessToken,
    p_first_name: revisionRequest.first_name,
    p_last_name: revisionRequest.last_name,
    p_phone: revisionRequest.phone,
    p_comment: revisionRequest.comment || '',
  })
  if (error) throw error
}

/**
 * Mark offer as viewed
 */
export async function markOfferViewed(accessToken: string): Promise<void> {
  const { error } = await (supabase as any).rpc('public_offer_mark_viewed', {
    p_access_token: accessToken,
  })
  if (error) console.error('Failed to mark offer as viewed:', error)
}

/**
 * Duplicate an offer (for revisions)
 */
export async function duplicateOffer(offerId: string): Promise<string> {
  const offer = await offerDetailQuery(offerId).queryFn()

  if (!offer) throw new Error('Offer not found')

  // Create new offer
  const newOfferId = await createOffer({
    jobId: offer.job_id,
    companyId: offer.company_id,
    offerType: offer.offer_type,
    title: offer.title,
    daysOfUse: offer.days_of_use,
    discountPercent: offer.discount_percent,
    vatPercent: offer.vat_percent,
    showPricePerLine: offer.show_price_per_line,
    basedOnOfferId: offer.based_on_offer_id,
  })

  // Copy equipment groups and items
  if (offer.groups) {
    for (const group of offer.groups) {
      const { data: newGroup, error: groupError } = await supabase
        .from('offer_equipment_groups')
        .insert({
          offer_id: newOfferId,
          group_name: group.group_name,
          sort_order: group.sort_order,
        })
        .select('id')
        .single()

      if (groupError) throw groupError

      if (group.items && group.items.length > 0) {
        const itemsToInsert = group.items.map((item) => ({
          offer_group_id: newGroup.id,
          item_id: item.item_id,
          group_id: item.group_id ?? null,
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

  // Copy crew items
  if (offer.crew_items && offer.crew_items.length > 0) {
    const crewItemsToInsert = offer.crew_items.map((item) => ({
      offer_id: newOfferId,
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

  // Copy transport items
  if (offer.transport_items && offer.transport_items.length > 0) {
    const transportItemsToInsert = offer.transport_items.map((item) => ({
      offer_id: newOfferId,
      vehicle_name: item.vehicle_name,
      vehicle_id: item.vehicle_id,
      vehicle_category: item.vehicle_category,
      distance_km: item.distance_km,
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

  // Copy pretty sections
  if (offer.pretty_sections && offer.pretty_sections.length > 0) {
    const sectionsToInsert = offer.pretty_sections.map((section) => ({
      offer_id: newOfferId,
      section_type: section.section_type,
      title: section.title,
      content: section.content,
      image_url: section.image_url,
      sort_order: section.sort_order,
    }))

    const { error: sectionsError } = await supabase
      .from('offer_pretty_sections')
      .insert(sectionsToInsert)

    if (sectionsError) throw sectionsError
  }

  // Recalculate totals (non-blocking - if it fails, offer is still duplicated)
  try {
    await recalculateOfferTotals(newOfferId)
  } catch (recalcError) {
    // Log but don't fail the duplication - totals can be recalculated later
    console.warn(
      'Failed to recalculate offer totals after duplication:',
      recalcError,
    )
  }

  return newOfferId
}

/**
 * Delete an offer
 */
export async function deleteOffer(offerId: string): Promise<void> {
  const { error } = await supabase.from('job_offers').delete().eq('id', offerId)

  if (error) throw error
}

/**
 * Update offer status
 */
export async function updateOfferStatus(
  offerId: string,
  status: OfferStatus,
): Promise<void> {
  const updateData: any = { status }

  if (status === 'sent') {
    updateData.sent_at = new Date().toISOString()
  }

  const { error } = await supabase
    .from('job_offers')
    .update(updateData)
    .eq('id', offerId)

  if (error) throw error
}

async function markJobOfferBookingsSynced(offerId: string): Promise<void> {
  const { error } = await (supabase as any).rpc('mark_job_offer_bookings_synced', {
    p_offer_id: offerId,
  })
  if (error) throw error
}

/**
 * Create bookings from an accepted offer
 * This creates time_periods, reserved_items, reserved_crew, and reserved_vehicles
 * based on the offer's equipment, crew, and transport items.
 */
export async function createBookingsFromOffer(
  offerId: string,
  userId: string,
): Promise<void> {
  // Fetch the offer with all details
  const offer = await offerDetailQuery(offerId).queryFn()
  if (!offer) throw new Error('Offer not found')

  // Get job info for default dates
  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .select('id, start_at, end_at, company_id')
    .eq('id', offer.job_id)
    .single()

  if (jobError) throw jobError
  if (!job) throw new Error('Job not found')

  const companyId = job.company_id
  const defaultStart = job.start_at || new Date().toISOString()
  const defaultEnd = job.end_at || new Date().toISOString()

  // Helper to create or find time period
  const getOrCreateTimePeriod = async (
    title: string,
    category: 'equipment' | 'crew' | 'transport',
    startAt: string,
    endAt: string,
  ): Promise<string> => {
    // Check if time period already exists
    const { data: existing } = await supabase
      .from('time_periods')
      .select('id, deleted')
      .eq('job_id', offer.job_id)
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

    // Create new time period
    const { data: newPeriod, error: periodError } = await supabase
      .from('time_periods')
      .insert({
        job_id: offer.job_id,
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

  // 1. Create equipment bookings
  if (offer.groups && offer.groups.length > 0) {
    // Group equipment by external owner for time periods
    const equipmentByOwner = new Map<
      string | null,
      {
        ownerName: string
        items: Array<
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
        >
      }
    >()

    const groupIds = new Set<string>()

    for (const group of offer.groups) {
      for (const item of group.items) {
        if (item.group_id) {
          groupIds.add(item.group_id)
        }

        const ownerId = item.group_id
          ? item.group?.external_owner_id || null
          : item.item?.external_owner_id || null
        const ownerName = ownerId
          ? `External Owner ${ownerId}` // We'll fetch actual owner name
          : 'Internal Equipment'

        if (!equipmentByOwner.has(ownerId)) {
          equipmentByOwner.set(ownerId, {
            ownerName,
            items: [],
          })
        }

        if (item.group_id) {
          equipmentByOwner.get(ownerId)!.items.push({
            kind: 'group',
            group_id: item.group_id,
            quantity: item.quantity,
            is_internal: item.is_internal,
          })
        } else if (item.item_id) {
          equipmentByOwner.get(ownerId)!.items.push({
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

    // Fetch external owner names
    const externalOwnerIds = Array.from(equipmentByOwner.keys()).filter(
      (id): id is string => id !== null,
    )
    if (externalOwnerIds.length > 0) {
      const { data: owners } = await supabase
        .from('customers')
        .select('id, name')
        .in('id', externalOwnerIds)

      if (owners) {
        for (const owner of owners) {
          const data = equipmentByOwner.get(owner.id)
          if (data) {
            data.ownerName = owner.name || `Customer ${owner.id}`
          }
        }
      }
    }

    // Create time periods and reserved items for each owner
    for (const [ownerId, data] of equipmentByOwner.entries()) {
      const timePeriodId = await getOrCreateTimePeriod(
        `${data.ownerName} Equipment period`,
        'equipment',
        defaultStart,
        defaultEnd,
      )

      // Create reserved items
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
      }> = []

      for (const entry of data.items) {
        if (entry.kind === 'item') {
          reservedItems.push({
            time_period_id: timePeriodId,
            item_id: entry.item_id,
            quantity: entry.quantity,
            source_kind: 'direct',
            source_group_id: null,
            forced: false,
            start_at: null,
            end_at: null,
            external_status: entry.is_internal ? null : 'planned',
            external_note: null,
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
            forced: false,
            start_at: null,
            end_at: null,
            external_status: entry.is_internal ? null : 'planned',
            external_note: null,
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
  }

  // 2. Create crew bookings - one time period per role title
  if (offer.crew_items && offer.crew_items.length > 0) {
    type CrewAggregate = {
      title: string
      start_at: string
      end_at: string
      needed_count: number
      role_category?: string | null
    }

    const crewAggregates = new Map<string, CrewAggregate>()

    for (const crewItem of offer.crew_items) {
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
        .eq('job_id', offer.job_id)
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
            job_id: offer.job_id,
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

  // 3. Create transport bookings and vehicle proposals
  if (offer.transport_items && offer.transport_items.length > 0) {
    type VehicleCandidate = {
      id: string
      name: string
      internally_owned: boolean
      external_owner_id: string | null
      vehicle_category: string | null
    }

    const { data: vehicleRows, error: vehiclesFetchError } = await supabase
      .from('vehicles')
      .select(
        'id, name, internally_owned, external_owner_id, vehicle_category, deleted',
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
        vehicle_category: row.vehicle_category ?? null,
      }))

    const usedVehicleIds = new Set<string>()

    for (const transportItem of offer.transport_items) {
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
        .eq('job_id', offer.job_id)
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
            job_id: offer.job_id,
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
          // Fallback to transport item metadata when vehicle is not in index
          chosenVehicle = {
            id: existingVehicleId,
            name: transportItem.vehicle_name || 'Vehicle',
            internally_owned: transportItem.is_internal,
            external_owner_id: transportItem.is_internal
              ? null
              : (transportItem.vehicle?.external_owner_id ?? null),
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

  // Mark that bookings are now synced from this offer (best-effort).
  try {
    await markJobOfferBookingsSynced(offerId)
  } catch (e) {
    console.warn('Failed to mark offer as synced to bookings:', e)
  }
}

async function getEquipmentConflictWarningsFromOffer(
  offer: OfferDetail,
  companyId: string,
  defaultStart: string,
  defaultEnd: string,
): Promise<Array<string>> {
  if (!offer.groups || offer.groups.length === 0) return []

  const groupIds = new Set<string>()
  const groupEntries: Array<{ group_id: string; quantity: number }> = []
  const itemQuantityMap = new Map<string, number>()

  for (const group of offer.groups) {
    for (const item of group.items) {
      if (item.group_id) {
        groupIds.add(item.group_id)
        groupEntries.push({ group_id: item.group_id, quantity: item.quantity })
        continue
      }
      if (item.item_id) {
        const current = itemQuantityMap.get(item.item_id) ?? 0
        itemQuantityMap.set(item.item_id, current + item.quantity)
      }
    }
  }

  if (groupIds.size > 0) {
    const { data: groupItems, error: groupItemsError } = await supabase
      .from('group_items')
      .select('group_id, item_id, quantity')
      .in('group_id', Array.from(groupIds))

    if (groupItemsError) throw groupItemsError

    const groupItemsMap = new Map<
      string,
      Array<{ item_id: string; quantity: number }>
    >()
    for (const row of groupItems || []) {
      if (!row.item_id) continue
      const list = groupItemsMap.get(row.group_id) ?? []
      list.push({
        item_id: row.item_id,
        quantity: row.quantity ?? 1,
      })
      groupItemsMap.set(row.group_id, list)
    }

    for (const entry of groupEntries) {
      const members = groupItemsMap.get(entry.group_id) ?? []
      for (const member of members) {
        const current = itemQuantityMap.get(member.item_id) ?? 0
        itemQuantityMap.set(
          member.item_id,
          current + member.quantity * entry.quantity,
        )
      }
    }
  }

  if (itemQuantityMap.size === 0) return []

  const allItemIds = Array.from(itemQuantityMap.keys())
  const { data: inventoryRows, error: inventoryErr } = await supabase
    .from('inventory_index')
    .select('id, name, on_hand')
    .eq('company_id', companyId)
    .eq('is_group', false)
    .in('id', allItemIds)

  if (inventoryErr) throw inventoryErr

  const itemNameMap = new Map<string, string>()
  const itemOnHandMap = new Map<string, number>()
  for (const row of inventoryRows || []) {
    if (!row.id) continue
    itemNameMap.set(row.id, row.name || 'Item')
    itemOnHandMap.set(row.id, row.on_hand ?? 0)
  }

  const { data: equipmentPeriods, error: periodsErr } = await supabase
    .from('time_periods')
    .select('id, start_at, end_at, job_id')
    .eq('company_id', companyId)
    .eq('category', 'equipment')
    .eq('deleted', false)

  if (periodsErr) throw periodsErr

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

  const overlappingPeriodIds = (equipmentPeriods || [])
    .filter(
      (period) =>
        period.job_id !== offer.job_id &&
        periodsOverlap(
          defaultStart,
          defaultEnd,
          period.start_at,
          period.end_at,
        ),
    )
    .map((period) => period.id)

  if (overlappingPeriodIds.length === 0) return []

  const { data: reservations, error: reservationsErr } = await supabase
    .from('reserved_items')
    .select('item_id, quantity, status, time_period_id')
    .in('item_id', allItemIds)
    .in('time_period_id', overlappingPeriodIds)

  if (reservationsErr) throw reservationsErr

  const existingReservedMap = new Map<string, number>()
  const plannedReservedMap = new Map<string, number>()
  for (const res of reservations || []) {
    if (res.status === 'canceled') continue
    const current = existingReservedMap.get(res.item_id) ?? 0
    existingReservedMap.set(res.item_id, current + res.quantity)
    if (res.status === 'planned') {
      const plannedCurrent = plannedReservedMap.get(res.item_id) ?? 0
      plannedReservedMap.set(res.item_id, plannedCurrent + res.quantity)
    }
  }

  const warnings: Array<string> = []
  for (const [itemId, newQty] of itemQuantityMap.entries()) {
    const itemName = itemNameMap.get(itemId) ?? 'Item'
    const plannedQty = plannedReservedMap.get(itemId) ?? 0
    if (plannedQty > 0) {
      warnings.push(
        `${itemName}: ${plannedQty} already planned in overlapping period`,
      )
    }

    const onHand = itemOnHandMap.get(itemId) ?? 0
    if (onHand > 0) {
      const existingQty = existingReservedMap.get(itemId) ?? 0
      const finalTotal = existingQty + newQty
      if (finalTotal > onHand) {
        warnings.push(
          `${itemName}: total booked ${finalTotal} exceeds ${onHand} on hand`,
        )
      }
    }
  }

  return warnings
}

/**
 * Sync bookings to match the offer.
 * Clears existing equipment/crew/transport bookings for the job
 * and recreates them from the offer.
 */
export async function syncBookingsFromOffer(
  offerId: string,
  userId: string,
): Promise<Array<string>> {
  const offer = await offerDetailQuery(offerId).queryFn()
  if (!offer) throw new Error('Offer not found')

  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .select('id, start_at, end_at, company_id')
    .eq('id', offer.job_id)
    .single()

  if (jobError) throw jobError
  if (!job) throw new Error('Job not found')

  const defaultStart = job.start_at || new Date().toISOString()
  const defaultEnd = job.end_at || new Date().toISOString()
  const warnings = await getEquipmentConflictWarningsFromOffer(
    offer,
    job.company_id,
    defaultStart,
    defaultEnd,
  )

  const { data: timePeriods, error: timePeriodsError } = await supabase
    .from('time_periods')
    .select('id')
    .eq('job_id', offer.job_id)
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

  await createBookingsFromOffer(offerId, userId)
  return warnings
}

/**
 * Export offer as PDF
 */
export async function exportOfferPDF(offerId: string): Promise<void> {
  const offer = await offerDetailQuery(offerId).queryFn()
  if (!offer) throw new Error('Offer not found')
  await exportOfferAsPDF(offer)
}
