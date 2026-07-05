// src/features/jobs/api/prettyOfferQueries.ts
import { queryOptions } from '@tanstack/react-query'
import { supabase } from '@shared/api/supabase'
import {
  applyComputedCostsToModules,
  calculatePrettyOfferTotals,
  lineItemSourceFromOfferBasis,
  rebuildTechnicalSplitsForCopy,
  resolveSplitAmountsForSave,
  resolveSubcontractorMarkupPercent,
  validatePricingBases,
} from '../utils/prettyOfferCalculations'
import { createOffer, offerDetailQuery } from './offerQueries'
import {
  createEmptyOfferBasis,
  offerBasisDetailQuery,
} from './offerBasisQueries'
import { jobSubcontractorQuotesQuery } from './subcontractorQueries'
import type { TechnicalLineItemSource } from '../utils/prettyOfferCalculations'
import type { RentalFactorConfig } from '../utils/offerCalculations'
import type {
  JobSubcontractorQuote,
  OfferBasisDetail,
  OfferDetail,
  PrettyOfferDetail,
  PrettyOfferModule,
  PrettyOfferModuleBlock,
  PrettyOfferModuleBlockItem,
  PrettyOfferPricingBasis,
  PrettyOfferPricingBasisSplit,
} from '../types'

function isTempId(id: string): boolean {
  return id.startsWith('temp-')
}

function resolveCopiedSourceOfferBasisId(
  basis: PrettyOfferPricingBasis,
  options?: {
    sourceOfferBasisId?: string
    newOfferBasisId?: string
  },
): string | null {
  const sourceOfferBasisId = basis.source_offer_basis_id
  if (
    options?.sourceOfferBasisId &&
    options?.newOfferBasisId &&
    sourceOfferBasisId === options.sourceOfferBasisId
  ) {
    return options.newOfferBasisId
  }
  if (sourceOfferBasisId) return sourceOfferBasisId
  if (basis.basis_type === 'technical' && options?.newOfferBasisId) {
    return options.newOfferBasisId
  }
  return null
}

async function loadPrettyOfferPricingContext(detail: PrettyOfferDetail) {
  const technicalOfferIds = [
    ...new Set(
      (detail.pricing_bases ?? [])
        .map((b) => b.source_technical_offer_id)
        .filter((id): id is string => !!id),
    ),
  ]

  const offerBasisIds = [
    ...new Set(
      [
        detail.offer_basis_id,
        ...(detail.pricing_bases ?? []).map((b) => b.source_offer_basis_id),
      ].filter((id): id is string => !!id),
    ),
  ]

  const technicalOffersById = new Map<string, OfferDetail>()
  for (const techId of technicalOfferIds) {
    const techOffer = await (
      offerDetailQuery(techId).queryFn as () => Promise<OfferDetail | null>
    )()
    if (techOffer) technicalOffersById.set(techId, techOffer)
  }

  const offerBasesById = new Map<string, OfferBasisDetail>()
  for (const basisId of offerBasisIds) {
    const basis = await (
      offerBasisDetailQuery(basisId)
        .queryFn as () => Promise<OfferBasisDetail | null>
    )()
    if (basis) offerBasesById.set(basisId, basis)
  }

  const jobQuotesById = detail.job_id
    ? await loadJobQuotesForBases(detail.job_id, detail.pricing_bases ?? [])
    : new Map()

  const { data: expansion } = await supabase
    .from('company_expansions')
    .select('subcontractor_markup_percent')
    .eq('company_id', detail.company_id)
    .maybeSingle()

  const linkedBasis = detail.offer_basis_id
    ? offerBasesById.get(detail.offer_basis_id)
    : undefined

  return {
    offerBasesById,
    technicalOffersById,
    jobQuotesById,
    technicalContext: {
      daysOfUse: linkedBasis?.days_of_use ?? detail.days_of_use ?? 1,
    },
    subcontractorMarkupPercent: resolveSubcontractorMarkupPercent(
      detail.pretty_subcontractor_markup_percent,
      expansion?.subcontractor_markup_percent,
    ),
  }
}

export function jobPrettyOffersQuery(jobId: string) {
  return queryOptions<Array<import('../types').JobOffer>>({
    queryKey: ['job-pretty-offers', jobId] as const,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('job_offers')
        .select('*')
        .eq('job_id', jobId)
        .eq('offer_type', 'pretty')
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data || []) as Array<import('../types').JobOffer>
    },
  })
}

export function jobTechnicalOffersQuery(jobId: string) {
  return queryOptions<Array<import('../types').JobOffer>>({
    queryKey: ['job-technical-offers', jobId] as const,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('job_offers')
        .select('*')
        .eq('job_id', jobId)
        .eq('offer_type', 'technical')
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data || []) as Array<import('../types').JobOffer>
    },
  })
}

async function fetchPrettyOfferModules(
  offerId: string,
): Promise<Array<PrettyOfferModule>> {
  const { data: modules, error: modulesError } = await supabase
    .from('pretty_offer_modules')
    .select('*')
    .eq('offer_id', offerId)
    .order('sort_order', { ascending: true })

  if (modulesError) throw modulesError
  const moduleRows = (modules || []) as Array<PrettyOfferModule>
  if (moduleRows.length === 0) return []

  const moduleIds = moduleRows.map((m) => m.id)

  const { data: timelineItems, error: timelineError } = await supabase
    .from('pretty_offer_module_timeline_items')
    .select('*')
    .in('module_id', moduleIds)
    .order('sort_order', { ascending: true })

  if (timelineError) throw timelineError

  const timelineItemsByModule = new Map<
    string,
    NonNullable<PrettyOfferModule['timeline_items']>
  >()
  for (const item of timelineItems || []) {
    const list = timelineItemsByModule.get(item.module_id) ?? []
    list.push(item)
    timelineItemsByModule.set(item.module_id, list)
  }

  const { data: blocks, error: blocksError } = await supabase
    .from('pretty_offer_module_blocks')
    .select('*')
    .in('module_id', moduleIds)
    .order('sort_order', { ascending: true })

  if (blocksError) throw blocksError

  const blockIds = (blocks || []).map((b) => b.id)
  let blockItems: Array<PrettyOfferModuleBlockItem> = []
  if (blockIds.length > 0) {
    const { data: items, error: itemsError } = await supabase
      .from('pretty_offer_module_block_items')
      .select('*')
      .in('block_id', blockIds)
      .order('sort_order', { ascending: true })
    if (itemsError) throw itemsError
    blockItems = items || []
  }

  const itemsByBlock = new Map<string, PrettyOfferModuleBlock['items']>()
  for (const item of blockItems) {
    const list = itemsByBlock.get(item.block_id) ?? []
    list.push(item)
    itemsByBlock.set(item.block_id, list)
  }

  const blocksByModule = new Map<string, Array<PrettyOfferModuleBlock>>()
  for (const block of (blocks || []) as Array<PrettyOfferModuleBlock>) {
    const list = blocksByModule.get(block.module_id) ?? []
    list.push({
      ...block,
      items: itemsByBlock.get(block.id) ?? [],
    })
    blocksByModule.set(block.module_id, list)
  }

  return moduleRows.map((module) => ({
    ...module,
    module_type: module.module_type ?? 'standard',
    timeline_items: timelineItemsByModule.get(module.id) ?? [],
    content_blocks: blocksByModule.get(module.id) ?? [],
  }))
}

async function fetchPricingBases(
  offerId: string,
): Promise<Array<PrettyOfferPricingBasis>> {
  const { data: bases, error: basesError } = await supabase
    .from('pretty_offer_pricing_bases')
    .select('*')
    .eq('offer_id', offerId)
    .order('sort_order', { ascending: true })

  if (basesError) throw basesError
  const basisRows = (bases || []) as Array<PrettyOfferPricingBasis>
  if (basisRows.length === 0) return []

  const basisIds = basisRows.map((b) => b.id)
  const { data: splits, error: splitsError } = await supabase
    .from('pretty_offer_pricing_basis_splits')
    .select('*')
    .in('basis_id', basisIds)
    .order('sort_order', { ascending: true })

  if (splitsError) throw splitsError

  const splitsByBasis = new Map<string, Array<PrettyOfferPricingBasisSplit>>()
  for (const split of (splits || []) as Array<PrettyOfferPricingBasisSplit>) {
    const list = splitsByBasis.get(split.basis_id) ?? []
    list.push(split)
    splitsByBasis.set(split.basis_id, list)
  }

  return basisRows.map((basis) => ({
    ...basis,
    splits: splitsByBasis.get(basis.id) ?? [],
  }))
}

export function prettyOfferDetailQuery(offerId: string) {
  return queryOptions<PrettyOfferDetail | null>({
    queryKey: ['pretty-offer-detail', offerId] as const,
    queryFn: () => fetchPrettyOfferDetail(offerId),
  })
}

export async function fetchPrettyOfferDetail(
  offerId: string,
): Promise<PrettyOfferDetail | null> {
  const base = await supabase
    .from('job_offers')
    .select(
      `
          *,
          job:jobs!job_offers_job_id_fkey (
            id,
            title,
            start_at,
            end_at,
            customer:customer_id ( id, name, email, phone, address, logo_path, accent_color, accent_color_custom ),
            customer_contact:contacts!jobs_customer_contact_id_fkey ( id, name, phone, email ),
            project_lead:profiles!jobs_project_lead_user_id_fkey ( user_id, display_name, email, phone )
          ),
          company:companies!job_offers_company_id_fkey (
            id, name, address, logo_light_path, logo_dark_path, accent_color
          )
        `,
    )
    .eq('id', offerId)
    .eq('offer_type', 'pretty')
    .maybeSingle()

  if (base.error) throw base.error
  if (!base.data) return null

  const offer = base.data as PrettyOfferDetail
  const [modules, pricing_bases] = await Promise.all([
    fetchPrettyOfferModules(offerId),
    fetchPricingBases(offerId),
  ])

  const job = (offer as { job?: unknown }).job
  if (job) {
    const jobData = Array.isArray(job) ? job[0] : job
    offer.job_title = jobData?.title ?? null
    offer.job_start_at = jobData?.start_at ?? null
    offer.job_end_at = jobData?.end_at ?? null

    const customer = Array.isArray(jobData?.customer)
      ? jobData.customer[0]
      : jobData?.customer
    if (customer) {
      offer.customer = {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        address: customer.address,
        logo_path: customer.logo_path,
        accent_color: customer.accent_color ?? null,
        accent_color_custom: customer.accent_color_custom ?? null,
      }
    }

    const customerContact = Array.isArray(jobData?.customer_contact)
      ? jobData.customer_contact[0]
      : jobData?.customer_contact
    if (customerContact) {
      offer.customer_contact = {
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
      offer.project_lead = {
        user_id: projectLead.user_id,
        display_name: projectLead.display_name,
        email: projectLead.email,
        phone: projectLead.phone,
      }
    }
  }

  const company = (offer as { company?: unknown }).company
  if (company) {
    const companyData = Array.isArray(company) ? company[0] : company
    offer.company = {
      id: companyData.id,
      name: companyData.name,
      address: companyData.address,
      logo_light_path: companyData.logo_light_path,
      logo_dark_path: companyData.logo_dark_path,
      accent_color: companyData.accent_color,
    }
  }

  return {
    ...offer,
    modules,
    pricing_bases,
  }
}

export async function createEmptyDraftPrettyOffer({
  jobId,
  companyId,
  offerBasisId,
}: {
  jobId: string
  companyId: string
  offerBasisId?: string
}): Promise<string> {
  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .select('title, start_at, end_at')
    .eq('id', jobId)
    .single()

  if (jobError) throw jobError

  let daysOfUse = 1
  let discountPercent = 0
  let vatPercent: 0 | 25 = 25

  const basisId =
    offerBasisId ??
    (await createEmptyOfferBasis({
      jobId,
      companyId,
      title: job.title ? `${job.title} — Basis` : 'Offer basis',
    }))

  const { data: basisRow, error: basisError } = await supabase
    .from('offer_bases')
    .select('days_of_use, discount_percent, vat_percent')
    .eq('id', basisId)
    .single()

  if (basisError) throw basisError

  daysOfUse = basisRow.days_of_use
  discountPercent = Number(basisRow.discount_percent)
  vatPercent = basisRow.vat_percent === 0 ? 0 : 25

  const offerId = await createOffer({
    jobId,
    companyId,
    offerBasisId: basisId,
    offerType: 'pretty',
    title: job.title ? `${job.title} — Proposal` : 'Proposal',
    daysOfUse,
    discountPercent,
    vatPercent,
    showPricePerLine: false,
  })

  await supabase.from('pretty_offer_pricing_bases').insert({
    offer_id: offerId,
    basis_type: 'technical',
    title: 'Offer basis',
    sort_order: 0,
    source_offer_basis_id: basisId,
    source_technical_offer_id: null,
    apply_subcontractor_markup: true,
  })

  return offerId
}

type SavePrettyOfferPayload = {
  offerId: string
  jobId: string
  title: string
  prettyIntroText?: string | null
  prettySubcontractorMarkupPercent?: number | null
  showPricePerLine: boolean
  prettyUseCustomerBrandColors: boolean
  modules: Array<PrettyOfferModule>
  pricingBases: Array<PrettyOfferPricingBasis>
  technicalOffersById?: Map<string, OfferDetail>
  offerBasesById?: Map<string, OfferBasisDetail>
  rentalFactorConfig?: RentalFactorConfig | null
  vehicleDistanceRate?: number | null
  vehicleDistanceIncrement?: number | null
  vehicleDailyRate?: number | null
  companySubcontractorMarkupPercent?: number | null
}

async function loadJobQuotesForBases(
  jobId: string,
  pricingBases: Array<PrettyOfferPricingBasis>,
): Promise<Map<string, JobSubcontractorQuote>> {
  const quoteIds = [
    ...new Set(
      pricingBases
        .map((b) => b.job_subcontractor_quote_id)
        .filter((id): id is string => !!id),
    ),
  ]

  if (quoteIds.length === 0) return new Map()

  const { data, error } = await supabase
    .from('job_subcontractor_quotes')
    .select('*')
    .eq('job_id', jobId)
    .in('id', quoteIds)

  if (error) throw error

  return new Map(
    ((data ?? []) as Array<JobSubcontractorQuote>).map((q) => [q.id, q]),
  )
}

export async function savePrettyOffer(
  payload: SavePrettyOfferPayload,
): Promise<void> {
  const {
    offerId,
    jobId,
    title,
    prettyIntroText,
    prettySubcontractorMarkupPercent,
    showPricePerLine,
    prettyUseCustomerBrandColors,
    modules,
    pricingBases,
    technicalOffersById,
    offerBasesById,
    rentalFactorConfig,
    vehicleDistanceRate,
    vehicleDistanceIncrement,
    vehicleDailyRate,
    companySubcontractorMarkupPercent,
  } = payload

  const subcontractorMarkupPercent = resolveSubcontractorMarkupPercent(
    prettySubcontractorMarkupPercent,
    companySubcontractorMarkupPercent,
  )

  const { data: existingOffer, error: offerFetchError } = await supabase
    .from('job_offers')
    .select('locked, offer_basis_id')
    .eq('id', offerId)
    .single()

  if (offerFetchError) throw offerFetchError
  if (existingOffer?.locked) {
    throw new Error('This offer is locked and cannot be edited.')
  }

  const { data: basisRow, error: basisError } = await supabase
    .from('offer_bases')
    .select('days_of_use, discount_percent, vat_percent')
    .eq('id', existingOffer.offer_basis_id)
    .single()

  if (basisError) throw basisError

  const daysOfUse = basisRow.days_of_use
  const vatPercent = basisRow.vat_percent === 0 ? 0 : 25

  const jobQuotesById = await loadJobQuotesForBases(jobId, pricingBases)
  const validationIssues = validatePricingBases(
    pricingBases,
    modules,
    jobQuotesById,
  )
  if (validationIssues.length > 0) {
    throw new Error(validationIssues[0].message)
  }

  const technicalContext = {
    rentalFactorConfig,
    vehicleDistanceRate,
    vehicleDistanceIncrement,
    vehicleDailyRate,
    daysOfUse,
  }

  const resolvedBases = resolveSplitAmountsForSave(pricingBases, {
    technicalOffersById,
    offerBasesById,
    technicalContext,
  })

  const modulesWithCost = applyComputedCostsToModules(modules, resolvedBases, {
    technicalOffersById,
    offerBasesById,
    jobQuotesById,
    technicalContext,
    subcontractorMarkupPercent,
  })

  const totals = calculatePrettyOfferTotals(modulesWithCost, vatPercent)

  const { error: headerError } = await supabase
    .from('job_offers')
    .update({
      title,
      pretty_intro_text: prettyIntroText?.trim() || null,
      pretty_subcontractor_markup_percent: prettySubcontractorMarkupPercent,
      days_of_use: daysOfUse,
      vat_percent: vatPercent,
      discount_percent: Number(basisRow.discount_percent),
      show_price_per_line: showPricePerLine,
      pretty_use_customer_accent: prettyUseCustomerBrandColors,
      pretty_use_customer_background: prettyUseCustomerBrandColors,
      equipment_subtotal: 0,
      crew_subtotal: 0,
      transport_subtotal: totals.totalBeforeDiscount,
      total_before_discount: totals.totalBeforeDiscount,
      total_after_discount: totals.totalAfterDiscount,
      total_with_vat: totals.totalWithVat,
    })
    .eq('id', offerId)

  if (headerError) throw headerError

  const existingModuleIds = modulesWithCost
    .map((m) => m.id)
    .filter((id) => !isTempId(id))

  const { data: existingModules } = await supabase
    .from('pretty_offer_modules')
    .select('id')
    .eq('offer_id', offerId)

  const moduleIdsToDelete = (existingModules || [])
    .map((m) => m.id)
    .filter((id) => !existingModuleIds.includes(id))

  if (moduleIdsToDelete.length > 0) {
    await supabase
      .from('pretty_offer_modules')
      .delete()
      .in('id', moduleIdsToDelete)
  }

  const moduleIdMap = new Map<string, string>()

  for (const module of modulesWithCost) {
    if (isTempId(module.id)) {
      const { data: inserted, error } = await supabase
        .from('pretty_offer_modules')
        .insert({
          offer_id: offerId,
          module_type: module.module_type ?? 'standard',
          title: module.title,
          subtitle: null,
          tagline: module.tagline?.trim() || null,
          story_heading_1: module.story_heading_1?.trim() || null,
          story_body_1: module.story_body_1?.trim() || null,
          story_heading_2: module.story_heading_2?.trim() || null,
          story_body_2: module.story_body_2?.trim() || null,
          hero_media_type: module.hero_media_type ?? null,
          hero_media_url: module.hero_media_url?.trim() || null,
          hero_media_caption: module.hero_media_caption?.trim() || null,
          sort_order: module.sort_order,
          display_price: module.computed_cost > 0 ? module.computed_cost : null,
          show_price: true,
          computed_cost: module.computed_cost,
        })
        .select('id')
        .single()

      if (error) throw error
      moduleIdMap.set(module.id, inserted.id)
    } else {
      const { error } = await supabase
        .from('pretty_offer_modules')
        .update({
          module_type: module.module_type ?? 'standard',
          title: module.title,
          subtitle: null,
          tagline: module.tagline?.trim() || null,
          story_heading_1: module.story_heading_1?.trim() || null,
          story_body_1: module.story_body_1?.trim() || null,
          story_heading_2: module.story_heading_2?.trim() || null,
          story_body_2: module.story_body_2?.trim() || null,
          hero_media_type: module.hero_media_type ?? null,
          hero_media_url: module.hero_media_url?.trim() || null,
          hero_media_caption: module.hero_media_caption?.trim() || null,
          sort_order: module.sort_order,
          display_price: module.computed_cost > 0 ? module.computed_cost : null,
          show_price: true,
          computed_cost: module.computed_cost,
        })
        .eq('id', module.id)

      if (error) throw error
      moduleIdMap.set(module.id, module.id)
    }
  }

  for (const module of modulesWithCost) {
    const moduleId = moduleIdMap.get(module.id)!

    const keepBlockIds = (module.content_blocks ?? [])
      .map((b) => b.id)
      .filter((id) => !isTempId(id))

    const { data: existingBlocks } = await supabase
      .from('pretty_offer_module_blocks')
      .select('id')
      .eq('module_id', moduleId)

    const blocksToDelete = (existingBlocks || [])
      .map((r) => r.id)
      .filter((id) => !keepBlockIds.includes(id))

    if (blocksToDelete.length > 0) {
      await supabase
        .from('pretty_offer_module_blocks')
        .delete()
        .in('id', blocksToDelete)
    }

    const blockIdMap = new Map<string, string>()

    for (const block of module.content_blocks ?? []) {
      if (isTempId(block.id)) {
        const { data: inserted, error } = await supabase
          .from('pretty_offer_module_blocks')
          .insert({
            module_id: moduleId,
            block_type: block.block_type,
            sort_order: block.sort_order,
            text_content: block.text_content,
            url: block.url,
            link_title: block.link_title,
            caption: block.caption,
          })
          .select('id')
          .single()
        if (error) throw error
        blockIdMap.set(block.id, inserted.id)
      } else {
        const { error } = await supabase
          .from('pretty_offer_module_blocks')
          .update({
            block_type: block.block_type,
            sort_order: block.sort_order,
            text_content: block.text_content,
            url: block.url,
            link_title: block.link_title,
            caption: block.caption,
          })
          .eq('id', block.id)
        if (error) throw error
        blockIdMap.set(block.id, block.id)
      }
    }

    for (const block of module.content_blocks ?? []) {
      const blockId = blockIdMap.get(block.id)!
      const items = block.items ?? []

      const keepItemIds = items.map((i) => i.id).filter((id) => !isTempId(id))

      const { data: existingItems } = await supabase
        .from('pretty_offer_module_block_items')
        .select('id')
        .eq('block_id', blockId)

      const itemsToDelete = (existingItems || [])
        .map((r) => r.id)
        .filter((id) => !keepItemIds.includes(id))

      if (itemsToDelete.length > 0) {
        await supabase
          .from('pretty_offer_module_block_items')
          .delete()
          .in('id', itemsToDelete)
      }

      for (const item of items) {
        if (isTempId(item.id)) {
          const { error } = await supabase
            .from('pretty_offer_module_block_items')
            .insert({
              block_id: blockId,
              label: item.label,
              summary: item.summary,
              detail: item.detail,
              url: item.url ?? null,
              sort_order: item.sort_order,
              start_at: item.start_at ?? null,
              end_at: item.end_at ?? null,
            })
          if (error) throw error
        } else {
          const { error } = await supabase
            .from('pretty_offer_module_block_items')
            .update({
              label: item.label,
              summary: item.summary,
              detail: item.detail,
              url: item.url ?? null,
              sort_order: item.sort_order,
              start_at: item.start_at ?? null,
              end_at: item.end_at ?? null,
            })
            .eq('id', item.id)
          if (error) throw error
        }
      }
    }

    const timelineItems = module.timeline_items ?? []
    const keepTimelineItemIds = timelineItems
      .map((item) => item.id)
      .filter((id) => !isTempId(id))

    const { data: existingTimelineItems } = await supabase
      .from('pretty_offer_module_timeline_items')
      .select('id')
      .eq('module_id', moduleId)

    const timelineItemsToDelete = (existingTimelineItems || [])
      .map((r) => r.id)
      .filter((id) => !keepTimelineItemIds.includes(id))

    if (timelineItemsToDelete.length > 0) {
      await supabase
        .from('pretty_offer_module_timeline_items')
        .delete()
        .in('id', timelineItemsToDelete)
    }

    for (const item of timelineItems) {
      if (isTempId(item.id)) {
        const { error } = await supabase
          .from('pretty_offer_module_timeline_items')
          .insert({
            module_id: moduleId,
            label: item.label,
            summary: item.summary,
            detail: item.detail,
            sort_order: item.sort_order,
            start_at: item.start_at ?? null,
            end_at: item.end_at ?? null,
          })
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('pretty_offer_module_timeline_items')
          .update({
            label: item.label,
            summary: item.summary,
            detail: item.detail,
            sort_order: item.sort_order,
            start_at: item.start_at ?? null,
            end_at: item.end_at ?? null,
          })
          .eq('id', item.id)
        if (error) throw error
      }
    }
  }

  const keepBasisIds = resolvedBases
    .map((b) => b.id)
    .filter((id) => !isTempId(id))

  const { data: existingBases } = await supabase
    .from('pretty_offer_pricing_bases')
    .select('id')
    .eq('offer_id', offerId)

  const basesToDelete = (existingBases || [])
    .map((r) => r.id)
    .filter((id) => !keepBasisIds.includes(id))

  if (basesToDelete.length > 0) {
    await supabase
      .from('pretty_offer_pricing_bases')
      .delete()
      .in('id', basesToDelete)
  }

  const basisIdMap = new Map<string, string>()

  for (const basis of resolvedBases) {
    if (isTempId(basis.id)) {
      const { data: inserted, error } = await supabase
        .from('pretty_offer_pricing_bases')
        .insert({
          offer_id: offerId,
          basis_type: basis.basis_type,
          title: basis.title,
          sort_order: basis.sort_order,
          source_technical_offer_id: basis.source_technical_offer_id,
          source_offer_basis_id: basis.source_offer_basis_id,
          job_subcontractor_quote_id: basis.job_subcontractor_quote_id,
          apply_subcontractor_markup: basis.apply_subcontractor_markup ?? true,
        })
        .select('id')
        .single()
      if (error) throw error
      basisIdMap.set(basis.id, inserted.id)
    } else {
      const { error } = await supabase
        .from('pretty_offer_pricing_bases')
        .update({
          basis_type: basis.basis_type,
          title: basis.title,
          sort_order: basis.sort_order,
          source_technical_offer_id: basis.source_technical_offer_id,
          source_offer_basis_id: basis.source_offer_basis_id,
          job_subcontractor_quote_id: basis.job_subcontractor_quote_id,
          apply_subcontractor_markup: basis.apply_subcontractor_markup ?? true,
        })
        .eq('id', basis.id)
      if (error) throw error
      basisIdMap.set(basis.id, basis.id)
    }
  }

  for (const basis of resolvedBases) {
    const basisId = basisIdMap.get(basis.id)!
    const splits = basis.splits ?? []
    const keepSplitIds = splits.map((s) => s.id).filter((id) => !isTempId(id))

    const { data: existingSplits } = await supabase
      .from('pretty_offer_pricing_basis_splits')
      .select('id')
      .eq('basis_id', basisId)

    const splitsToDelete = (existingSplits || [])
      .map((r) => r.id)
      .filter((id) => !keepSplitIds.includes(id))

    if (splitsToDelete.length > 0) {
      await supabase
        .from('pretty_offer_pricing_basis_splits')
        .delete()
        .in('id', splitsToDelete)
    }

    for (const split of splits) {
      const moduleId = moduleIdMap.get(split.module_id) ?? split.module_id
      if (isTempId(split.id)) {
        const { error } = await supabase
          .from('pretty_offer_pricing_basis_splits')
          .insert({
            basis_id: basisId,
            module_id: moduleId,
            title: split.title,
            amount: split.amount,
            sort_order: split.sort_order,
            category_type: split.category_type,
            category_key: split.category_key,
          })
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('pretty_offer_pricing_basis_splits')
          .update({
            module_id: moduleId,
            title: split.title,
            amount: split.amount,
            sort_order: split.sort_order,
            category_type: split.category_type,
            category_key: split.category_key,
          })
          .eq('id', split.id)
        if (error) throw error
      }
    }
  }
}

function resolveLineItemSourceForPricingBasis(
  basis: PrettyOfferPricingBasis,
  context: Awaited<ReturnType<typeof loadPrettyOfferPricingContext>>,
): TechnicalLineItemSource | null {
  if (basis.source_offer_basis_id) {
    const offerBasis = context.offerBasesById.get(basis.source_offer_basis_id)
    if (!offerBasis) return null
    return lineItemSourceFromOfferBasis(offerBasis)
  }

  const technicalOfferId = basis.source_technical_offer_id
  if (!technicalOfferId) return null

  const technicalOffer = context.technicalOffersById.get(technicalOfferId)
  if (!technicalOffer) return null

  return {
    groups: technicalOffer.groups,
    crew_items: technicalOffer.crew_items,
    transport_items: technicalOffer.transport_items,
    transport_groups: technicalOffer.transport_groups,
    days_of_use: technicalOffer.days_of_use,
    discount_percent: technicalOffer.discount_percent,
    vat_percent: technicalOffer.vat_percent,
  }
}

export async function recalculatePrettyOfferTotals(
  offerId: string,
): Promise<void> {
  const detail = await fetchPrettyOfferDetail(offerId)
  if (!detail) return

  const pricingContext = await loadPrettyOfferPricingContext(detail)

  const modules = applyComputedCostsToModules(
    detail.modules ?? [],
    detail.pricing_bases ?? [],
    pricingContext,
  )

  const totals = calculatePrettyOfferTotals(modules, detail.vat_percent)

  for (const module of modules) {
    await supabase
      .from('pretty_offer_modules')
      .update({ computed_cost: module.computed_cost })
      .eq('id', module.id)
  }

  await supabase
    .from('job_offers')
    .update({
      equipment_subtotal: 0,
      crew_subtotal: 0,
      transport_subtotal: totals.totalBeforeDiscount,
      total_before_discount: totals.totalBeforeDiscount,
      total_after_discount: totals.totalAfterDiscount,
      total_with_vat: totals.totalWithVat,
    })
    .eq('id', offerId)
}

export async function copyPrettyOfferChildren(
  sourceOfferId: string,
  newOfferId: string,
  options?: {
    sourceOfferBasisId?: string
    newOfferBasisId?: string
  },
): Promise<void> {
  const detail = await fetchPrettyOfferDetail(sourceOfferId)
  if (!detail?.modules?.length && !detail?.pricing_bases?.length) return

  const moduleIdMap = new Map<string, string>()
  const newModules: Array<{ id: string; title: string }> = []

  for (const module of detail.modules ?? []) {
    const { data: inserted, error } = await supabase
      .from('pretty_offer_modules')
      .insert({
        offer_id: newOfferId,
        module_type: module.module_type ?? 'standard',
        title: module.title,
        subtitle: module.subtitle ?? null,
        tagline: module.tagline?.trim() || null,
        story_heading_1: module.story_heading_1?.trim() || null,
        story_body_1: module.story_body_1?.trim() || null,
        story_heading_2: module.story_heading_2?.trim() || null,
        story_body_2: module.story_body_2?.trim() || null,
        hero_media_type: module.hero_media_type ?? null,
        hero_media_url: module.hero_media_url?.trim() || null,
        hero_media_caption: module.hero_media_caption?.trim() || null,
        sort_order: module.sort_order,
        display_price: module.display_price,
        show_price: module.show_price,
        computed_cost: module.computed_cost,
      })
      .select('id')
      .single()

    if (error) throw error
    moduleIdMap.set(module.id, inserted.id)
    newModules.push({ id: inserted.id, title: module.title })

    for (const item of module.timeline_items ?? []) {
      await supabase.from('pretty_offer_module_timeline_items').insert({
        module_id: inserted.id,
        label: item.label,
        summary: item.summary,
        detail: item.detail,
        sort_order: item.sort_order,
        start_at: item.start_at ?? null,
        end_at: item.end_at ?? null,
      })
    }

    for (const block of module.content_blocks ?? []) {
      const { data: insertedBlock, error: blockError } = await supabase
        .from('pretty_offer_module_blocks')
        .insert({
          module_id: inserted.id,
          block_type: block.block_type,
          sort_order: block.sort_order,
          text_content: block.text_content,
          url: block.url,
          link_title: block.link_title,
          caption: block.caption,
        })
        .select('id')
        .single()

      if (blockError) throw blockError

      for (const item of block.items ?? []) {
        await supabase.from('pretty_offer_module_block_items').insert({
          block_id: insertedBlock.id,
          label: item.label,
          summary: item.summary,
          detail: item.detail,
          url: item.url ?? null,
          sort_order: item.sort_order,
          start_at: item.start_at ?? null,
          end_at: item.end_at ?? null,
        })
      }
    }
  }

  const mappedBases = (detail.pricing_bases ?? []).map((basis) => ({
    ...basis,
    source_offer_basis_id: resolveCopiedSourceOfferBasisId(basis, options),
  }))

  const pricingContext = await loadPrettyOfferPricingContext({
    ...detail,
    offer_basis_id: options?.newOfferBasisId ?? detail.offer_basis_id,
    pricing_bases: mappedBases,
  })

  const mappedBasesWithSplits = mappedBases.map((basis) => {
    if (basis.basis_type !== 'technical' || newModules.length === 0) {
      return basis
    }

    const lineItemSource = resolveLineItemSourceForPricingBasis(
      basis,
      pricingContext,
    )
    if (!lineItemSource) return basis

    return {
      ...basis,
      splits: rebuildTechnicalSplitsForCopy({
        lineItemSource,
        modules: newModules,
      }),
    }
  })

  const resolvedBases = resolveSplitAmountsForSave(mappedBasesWithSplits, {
    offerBasesById: pricingContext.offerBasesById,
    technicalOffersById: pricingContext.technicalOffersById,
    technicalContext: pricingContext.technicalContext,
  })

  const resolvedBasesById = new Map(
    resolvedBases.map((basis) => [basis.id, basis]),
  )

  for (const basis of detail.pricing_bases ?? []) {
    const mappedSourceOfferBasisId = resolveCopiedSourceOfferBasisId(
      basis,
      options,
    )

    const { data: insertedBasis, error } = await supabase
      .from('pretty_offer_pricing_bases')
      .insert({
        offer_id: newOfferId,
        basis_type: basis.basis_type,
        title: basis.title,
        sort_order: basis.sort_order,
        source_technical_offer_id: basis.source_technical_offer_id,
        source_offer_basis_id: mappedSourceOfferBasisId,
        job_subcontractor_quote_id: basis.job_subcontractor_quote_id,
        apply_subcontractor_markup: basis.apply_subcontractor_markup ?? true,
      })
      .select('id')
      .single()

    if (error) throw error

    const resolvedBasis = resolvedBasesById.get(basis.id)
    const splitsToCopy = resolvedBasis?.splits ?? basis.splits ?? []

    for (const split of splitsToCopy) {
      const newModuleId =
        basis.basis_type === 'technical'
          ? split.module_id
          : (moduleIdMap.get(split.module_id) ?? null)

      if (!newModuleId) {
        throw new Error(
          `Failed to copy pricing split "${split.title}": module mapping missing.`,
        )
      }

      const { error: splitError } = await supabase
        .from('pretty_offer_pricing_basis_splits')
        .insert({
          basis_id: insertedBasis.id,
          module_id: newModuleId,
          title: split.title,
          amount: split.amount,
          sort_order: split.sort_order,
          category_type: split.category_type,
          category_key: split.category_key,
        })

      if (splitError) throw splitError
    }
  }

  try {
    await recalculatePrettyOfferTotals(newOfferId)
  } catch {
    // non-blocking
  }
}

export { jobSubcontractorQuotesQuery }
