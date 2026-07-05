// src/features/jobs/api/prettyOfferQueries.ts
import { queryOptions } from '@tanstack/react-query'
import { supabase } from '@shared/api/supabase'
import {
  applyComputedCostsToModules,
  calculatePrettyOfferTotals,
  resolveSplitAmountsForSave,
  validatePricingBases,
} from '../utils/prettyOfferCalculations'
import { createOffer, offerDetailQuery } from './offerQueries'
import { createEmptyOfferBasis } from './offerBasisQueries'
import { jobSubcontractorQuotesQuery } from './subcontractorQueries'
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
  })

  return offerId
}

type SavePrettyOfferPayload = {
  offerId: string
  jobId: string
  title: string
  prettyIntroText?: string | null
  showPricePerLine: boolean
  prettyUseCustomerAccent: boolean
  prettyUseCustomerBackground: boolean
  modules: Array<PrettyOfferModule>
  pricingBases: Array<PrettyOfferPricingBasis>
  technicalOffersById?: Map<string, OfferDetail>
  offerBasesById?: Map<string, OfferBasisDetail>
  rentalFactorConfig?: RentalFactorConfig | null
  vehicleDistanceRate?: number | null
  vehicleDistanceIncrement?: number | null
  vehicleDailyRate?: number | null
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
    showPricePerLine,
    prettyUseCustomerAccent,
    prettyUseCustomerBackground,
    modules,
    pricingBases,
    technicalOffersById,
    offerBasesById,
    rentalFactorConfig,
    vehicleDistanceRate,
    vehicleDistanceIncrement,
    vehicleDailyRate,
  } = payload

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
  })

  const totals = calculatePrettyOfferTotals(modulesWithCost, vatPercent)

  const { error: headerError } = await supabase
    .from('job_offers')
    .update({
      title,
      pretty_intro_text: prettyIntroText?.trim() || null,
      days_of_use: daysOfUse,
      vat_percent: vatPercent,
      discount_percent: Number(basisRow.discount_percent),
      show_price_per_line: showPricePerLine,
      pretty_use_customer_accent: prettyUseCustomerAccent,
      pretty_use_customer_background: prettyUseCustomerBackground,
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
          display_price: module.show_price
            ? (module.display_price ??
              (module.computed_cost > 0 ? module.computed_cost : null))
            : module.display_price,
          show_price: module.show_price,
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
          display_price: module.show_price
            ? (module.display_price ??
              (module.computed_cost > 0 ? module.computed_cost : null))
            : module.display_price,
          show_price: module.show_price,
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

export async function recalculatePrettyOfferTotals(
  offerId: string,
): Promise<void> {
  const detail = await fetchPrettyOfferDetail(offerId)
  if (!detail) return

  const technicalOfferIds = [
    ...new Set(
      (detail.pricing_bases ?? [])
        .map((b) => b.source_technical_offer_id)
        .filter((id): id is string => !!id),
    ),
  ]

  const technicalOffersById = new Map<string, OfferDetail>()
  for (const techId of technicalOfferIds) {
    const techOffer = await (
      offerDetailQuery(techId).queryFn as () => Promise<OfferDetail | null>
    )()
    if (techOffer) technicalOffersById.set(techId, techOffer)
  }

  const jobQuotesById = detail.job_id
    ? await loadJobQuotesForBases(detail.job_id, detail.pricing_bases ?? [])
    : new Map()

  const modules = applyComputedCostsToModules(
    detail.modules ?? [],
    detail.pricing_bases ?? [],
    { technicalOffersById, jobQuotesById },
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
): Promise<void> {
  const detail = await fetchPrettyOfferDetail(sourceOfferId)
  if (!detail?.modules?.length && !detail?.pricing_bases?.length) return

  const moduleIdMap = new Map<string, string>()

  for (const module of detail.modules ?? []) {
    const { data: inserted, error } = await supabase
      .from('pretty_offer_modules')
      .insert({
        offer_id: newOfferId,
        title: module.title,
        subtitle: null,
        sort_order: module.sort_order,
        display_price: module.display_price,
        show_price: module.show_price,
        computed_cost: module.computed_cost,
      })
      .select('id')
      .single()

    if (error) throw error
    moduleIdMap.set(module.id, inserted.id)

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

  for (const basis of detail.pricing_bases ?? []) {
    const { data: insertedBasis, error } = await supabase
      .from('pretty_offer_pricing_bases')
      .insert({
        offer_id: newOfferId,
        basis_type: basis.basis_type,
        title: basis.title,
        sort_order: basis.sort_order,
        source_technical_offer_id: basis.source_technical_offer_id,
        job_subcontractor_quote_id: basis.job_subcontractor_quote_id,
      })
      .select('id')
      .single()

    if (error) throw error

    for (const split of basis.splits ?? []) {
      const newModuleId = moduleIdMap.get(split.module_id)
      if (!newModuleId) continue
      await supabase.from('pretty_offer_pricing_basis_splits').insert({
        basis_id: insertedBasis.id,
        module_id: newModuleId,
        title: split.title,
        amount: split.amount,
        sort_order: split.sort_order,
        category_type: split.category_type,
        category_key: split.category_key,
      })
    }
  }

  try {
    await recalculatePrettyOfferTotals(newOfferId)
  } catch {
    // non-blocking
  }
}

export { jobSubcontractorQuotesQuery }
