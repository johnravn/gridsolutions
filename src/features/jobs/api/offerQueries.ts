// src/features/jobs/api/offerQueries.ts
import { queryOptions } from '@tanstack/react-query'
import { supabase } from '@shared/api/supabase'
import {
  calculateOfferTotals,
  generateSecureToken,
} from '../utils/offerCalculations'
import { exportOfferAsPDF } from '../utils/offerPdfExport'
import {
  copyPrettyOfferChildren,
  fetchPrettyOfferDetail,
  recalculatePrettyOfferTotals,
} from './prettyOfferQueries'
import {
  createBookingsFromOfferBasis,
  createEmptyOfferBasis,
  createOfferBasisFromBookings,
  duplicateOfferBasis,
  isOfferBasisLocked,
  syncBookingsFromOfferBasis,
} from './offerBasisQueries'
import type { RentalFactorConfig } from '../utils/offerCalculations'
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
  OfferTransportGroup,
  OfferTransportItem,
  OfferType,
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

      const basisId = (offer as JobOffer).offer_basis_id

      const { data: basisRow, error: basisError } = await supabase
        .from('offer_bases')
        .select('bookings_synced_at')
        .eq('id', basisId)
        .maybeSingle()

      if (basisError) throw basisError

      // Fetch equipment groups
      const { data: groups, error: groupsError } = await supabase
        .from('offer_equipment_groups')
        .select('*')
        .eq('offer_basis_id', basisId)
        .order('sort_order', { ascending: true })

      if (groupsError) throw groupsError

      const groupRows = (groups || []) as Array<OfferEquipmentGroup>
      const groupIdsForItems = groupRows.map((g) => g.id).filter(Boolean)

      // Fetch equipment items for all groups in a single query (avoids N+1).
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

      // Fetch crew items
      const { data: crewItems, error: crewError } = await supabase
        .from('offer_crew_items')
        .select('*')
        .eq('offer_basis_id', basisId)
        .order('sort_order', { ascending: true })

      if (crewError) throw crewError

      // Fetch transport groups and items (grouped + ordered)
      const { data: transportGroupsRaw, error: transportGroupsError } =
        await supabase
          .from('offer_transport_groups')
          .select('*')
          .eq('offer_basis_id', basisId)
          .order('sort_order', { ascending: true })

      if (transportGroupsError) throw transportGroupsError

      const transportGroupRows = (transportGroupsRaw ||
        []) as Array<OfferTransportGroup>
      const transportGroupIds = transportGroupRows
        .map((g) => g.id)
        .filter(Boolean)

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

      // Fetch vehicles separately if any transport items have vehicle_id
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

      // Backward compatibility: also expose a flattened ordered list.
      const transportItems = transportGroupsWithItems.flatMap((g) => g.items)

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
        bookings_synced_at: basisRow?.bookings_synced_at ?? null,
        offer_basis_id: basisId,
        groups: groupsWithItems,
        crew_items: (crewItems || []) as Array<OfferCrewItem>,
        transport_items: transportItems || [],
        transport_groups: transportGroupsWithItems,
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
          'vehicle_daily_rate, vehicle_distance_rate, vehicle_distance_increment, rental_factor_config',
        )
        .eq('company_id', offer.company_id)
        .maybeSingle()

      if (!expansionError && expansion) {
        offerDetail.company_expansion = {
          vehicle_daily_rate: expansion.vehicle_daily_rate ?? null,
          vehicle_distance_rate: expansion.vehicle_distance_rate ?? null,
          vehicle_distance_increment:
            expansion.vehicle_distance_increment ?? null,
          rental_factor_config: (expansion as any).rental_factor_config ?? null,
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
  offerBasisId: string
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
      offer_basis_id: payload.offerBasisId,
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

function offerDaySpanBetween(start?: string | null, end?: string | null) {
  if (!start || !end) return 1
  const startDate = new Date(start)
  const endDate = new Date(end)
  const diffMs = endDate.getTime() - startDate.getTime()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
  return Math.max(1, diffDays)
}

function technicalOfferTitleAndDaysFromJob(job: {
  title: string | null
  start_at: string | null
  end_at: string | null
}) {
  const jobTitle = (job.title ?? '').trim()
  const title = jobTitle ? `Offer for ${jobTitle}` : 'Offer'

  const daysOfUse = offerDaySpanBetween(
    job.start_at ?? null,
    job.end_at ?? null,
  )
  return { title, daysOfUse }
}

/**
 * Create an empty draft technical offer (row only). Editor opens immediately after.
 */
export async function createEmptyDraftTechnicalOffer({
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

  const { title, daysOfUse } = technicalOfferTitleAndDaysFromJob(job)

  const basisId = await createEmptyOfferBasis({ jobId, companyId, title })

  return createOffer({
    jobId,
    companyId,
    offerBasisId: basisId,
    offerType: 'technical',
    title,
    daysOfUse,
    discountPercent: 0,
    vatPercent: 25,
    showPricePerLine: true,
  })
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

  const basisId = await createOfferBasisFromBookings({ jobId, companyId })
  const { title, daysOfUse } = technicalOfferTitleAndDaysFromJob(job)

  const offerId = await createOffer({
    jobId,
    companyId,
    offerBasisId: basisId,
    offerType: 'technical',
    title,
    daysOfUse,
    discountPercent: 0,
    vatPercent: 25,
    showPricePerLine: true,
  })

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
      offer = await (offerDetailQuery(offerId).queryFn as any)()
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

  const { data: basisRow, error: basisError } = await supabase
    .from('offer_bases')
    .select('days_of_use, discount_percent, vat_percent')
    .eq('id', offer.offer_basis_id)
    .single()

  if (basisError) throw basisError

  const basisPricing = {
    days_of_use: basisRow.days_of_use,
    discount_percent: basisRow.discount_percent,
    vat_percent: basisRow.vat_percent,
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

  // Fetch company expansion to get vehicle rates (including daily rate for transport subtotal)
  let vehicleDistanceRate: number | null = null
  let vehicleDistanceIncrement: number | null = null
  let vehicleDailyRate: number | null = null
  let rentalFactorConfig: RentalFactorConfig | null = null
  if (offer.company_id) {
    const { data: expansion } = await supabase
      .from('company_expansions')
      .select(
        'vehicle_daily_rate, vehicle_distance_rate, vehicle_distance_increment, rental_factor_config',
      )
      .eq('company_id', offer.company_id)
      .maybeSingle()
    if (expansion) {
      vehicleDailyRate = expansion.vehicle_daily_rate ?? null
      vehicleDistanceRate = expansion.vehicle_distance_rate
      vehicleDistanceIncrement = expansion.vehicle_distance_increment ?? 150
      try {
        const raw = (expansion as any).rental_factor_config
        if (typeof raw === 'string' && raw.trim()) {
          rentalFactorConfig = JSON.parse(raw) as RentalFactorConfig
        } else if (raw && typeof raw === 'object') {
          // JSONB sometimes comes through as object
          rentalFactorConfig = raw as RentalFactorConfig
        }
      } catch {
        rentalFactorConfig = null
      }
    }
  }

  const totals = calculateOfferTotals(
    equipmentItems,
    crewItems,
    transportItems,
    basisPricing.days_of_use,
    basisPricing.discount_percent,
    basisPricing.vat_percent,
    rentalFactorConfig,
    vehicleDistanceRate,
    vehicleDistanceIncrement,
    vehicleDailyRate,
  )

  // Update offer with new totals
  const { error } = await supabase
    .from('job_offers')
    .update({
      days_of_use: basisPricing.days_of_use,
      discount_percent: basisPricing.discount_percent,
      vat_percent: basisPricing.vat_percent,
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
  const { error } = await (supabase as any).rpc(
    'public_offer_request_revision',
    {
      p_access_token: accessToken,
      p_first_name: revisionRequest.first_name,
      p_last_name: revisionRequest.last_name,
      p_phone: revisionRequest.phone,
      p_comment: revisionRequest.comment || '',
    },
  )
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
  const offer = await (offerDetailQuery(offerId).queryFn as any)()

  if (!offer) throw new Error('Offer not found')

  let basisId = offer.offer_basis_id as string
  if (await isOfferBasisLocked(basisId)) {
    basisId = await duplicateOfferBasis(basisId)
  }

  const newOfferId = await createOffer({
    jobId: offer.job_id,
    companyId: offer.company_id,
    offerBasisId: basisId,
    offerType: offer.offer_type,
    title: offer.title,
    daysOfUse: offer.days_of_use,
    discountPercent: offer.discount_percent,
    vatPercent: offer.vat_percent,
    showPricePerLine: offer.show_price_per_line,
    basedOnOfferId: offer.based_on_offer_id,
  })

  if (offer.offer_type === 'pretty') {
    if (offer.source_technical_offer_id) {
      await supabase
        .from('job_offers')
        .update({
          source_technical_offer_id: offer.source_technical_offer_id,
        })
        .eq('id', newOfferId)
    }

    await copyPrettyOfferChildren(offerId, newOfferId)

    if (offer.pretty_sections && offer.pretty_sections.length > 0) {
      const sectionsToInsert = offer.pretty_sections.map(
        (section: OfferPrettySection) => ({
          offer_id: newOfferId,
          section_type: section.section_type,
          title: section.title,
          content: section.content,
          image_url: section.image_url,
          sort_order: section.sort_order,
        }),
      )

      const { error: sectionsError } = await supabase
        .from('offer_pretty_sections')
        .insert(sectionsToInsert)

      if (sectionsError) throw sectionsError
    }

    try {
      await recalculatePrettyOfferTotals(newOfferId)
    } catch (recalcError) {
      console.warn(
        'Failed to recalculate pretty offer totals after duplication:',
        recalcError,
      )
    }

    return newOfferId
  }

  try {
    await recalculateOfferTotals(newOfferId)
  } catch (recalcError) {
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

/**
 * Create bookings from an accepted offer
 * This creates time_periods, reserved_items, reserved_crew, and reserved_vehicles
 * based on the offer's equipment, crew, and transport items.
 */
export async function createBookingsFromOffer(
  offerId: string,
  userId: string,
  options?: { force?: boolean; skipConflictCheck?: boolean },
): Promise<void> {
  const { data: offer, error } = await supabase
    .from('job_offers')
    .select('offer_basis_id')
    .eq('id', offerId)
    .single()
  if (error) throw error
  if (!offer?.offer_basis_id) throw new Error('Offer not found')
  return createBookingsFromOfferBasis(offer.offer_basis_id, userId, options)
}

export async function syncBookingsFromOffer(
  offerId: string,
  userId: string,
  options?: { force?: boolean },
): Promise<Array<string>> {
  const { data: offer, error } = await supabase
    .from('job_offers')
    .select('offer_basis_id')
    .eq('id', offerId)
    .single()
  if (error) throw error
  if (!offer?.offer_basis_id) throw new Error('Offer not found')
  return syncBookingsFromOfferBasis(offer.offer_basis_id, userId, options)
}

export async function exportOfferPDF(offerId: string): Promise<void> {
  const baseOffer = await (offerDetailQuery(offerId).queryFn as any)()
  if (!baseOffer) throw new Error('Offer not found')

  if (baseOffer.offer_type === 'pretty') {
    const prettyOffer = await fetchPrettyOfferDetail(offerId)
    if (!prettyOffer) throw new Error('Offer not found')
    await exportOfferAsPDF(prettyOffer)
    return
  }

  await exportOfferAsPDF(baseOffer)
}
