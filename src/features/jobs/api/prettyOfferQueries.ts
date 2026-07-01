// src/features/jobs/api/prettyOfferQueries.ts
import { queryOptions } from '@tanstack/react-query'
import { supabase } from '@shared/api/supabase'
import {
  calculateModuleCost,
  calculatePrettyOfferTotals,
} from '../utils/prettyOfferCalculations'
import { createOffer, offerDetailQuery } from './offerQueries'
import type { RentalFactorConfig } from '../utils/offerCalculations'
import type {
  OfferDetail,
  PrettyOfferDetail,
  PrettyOfferModule,
  PrettyOfferModuleBlock,
  PrettyOfferModuleBlockItem,
  PrettyOfferSubcontractorQuote,
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

  const [
    { data: manualFields, error: manualError },
    { data: categoryMappings, error: categoryError },
    { data: blocks, error: blocksError },
  ] = await Promise.all([
    supabase
      .from('pretty_offer_module_manual_fields')
      .select('*')
      .in('module_id', moduleIds)
      .order('sort_order', { ascending: true }),
    supabase
      .from('pretty_offer_module_category_mappings')
      .select('*')
      .in('module_id', moduleIds),
    supabase
      .from('pretty_offer_module_blocks')
      .select('*')
      .in('module_id', moduleIds)
      .order('sort_order', { ascending: true }),
  ])

  if (manualError) throw manualError
  if (categoryError) throw categoryError
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

  const manualByModule = new Map<string, PrettyOfferModule['manual_fields']>()
  for (const field of manualFields || []) {
    const list = manualByModule.get(field.module_id) ?? []
    list.push(field)
    manualByModule.set(field.module_id, list)
  }

  const mappingsByModule = new Map<
    string,
    PrettyOfferModule['category_mappings']
  >()
  for (const mapping of categoryMappings || []) {
    const list = mappingsByModule.get(mapping.module_id) ?? []
    list.push(mapping)
    mappingsByModule.set(mapping.module_id, list)
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
    manual_fields: manualByModule.get(module.id) ?? [],
    category_mappings: mappingsByModule.get(module.id) ?? [],
    content_blocks: blocksByModule.get(module.id) ?? [],
  }))
}

async function fetchSubcontractorQuotes(
  offerId: string,
): Promise<Array<PrettyOfferSubcontractorQuote>> {
  const { data: quotes, error: quotesError } = await supabase
    .from('pretty_offer_subcontractor_quotes')
    .select('*')
    .eq('offer_id', offerId)
    .order('sort_order', { ascending: true })

  if (quotesError) throw quotesError
  const quoteRows = (quotes || []) as Array<PrettyOfferSubcontractorQuote>
  if (quoteRows.length === 0) return []

  const quoteIds = quoteRows.map((q) => q.id)
  const { data: allocations, error: allocError } = await supabase
    .from('pretty_offer_subcontractor_allocations')
    .select('*')
    .in('quote_id', quoteIds)

  if (allocError) throw allocError

  const allocByQuote = new Map<
    string,
    PrettyOfferSubcontractorQuote['allocations']
  >()
  for (const alloc of allocations || []) {
    const list = allocByQuote.get(alloc.quote_id) ?? []
    list.push(alloc)
    allocByQuote.set(alloc.quote_id, list)
  }

  return quoteRows.map((quote) => ({
    ...quote,
    allocations: allocByQuote.get(quote.id) ?? [],
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
  const [modules, subcontractor_quotes] = await Promise.all([
    fetchPrettyOfferModules(offerId),
    fetchSubcontractorQuotes(offerId),
  ])

  const job = (offer as any).job
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

  const company = (offer as any).company
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
    subcontractor_quotes,
  }
}

export async function createEmptyDraftPrettyOffer({
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

  let daysOfUse = 1
  if (job.start_at && job.end_at) {
    const start = new Date(job.start_at)
    const end = new Date(job.end_at)
    daysOfUse = Math.max(
      1,
      Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)),
    )
  }

  return createOffer({
    jobId,
    companyId,
    offerType: 'pretty',
    title: job.title ? `${job.title} — Proposal` : 'Proposal',
    daysOfUse,
    discountPercent: 0,
    vatPercent: 25,
    showPricePerLine: false,
  })
}

type SavePrettyOfferPayload = {
  offerId: string
  title: string
  daysOfUse: number
  vatPercent: number
  sourceTechnicalOfferId: string | null
  prettyUseCustomerAccent: boolean
  prettyUseCustomerBackground: boolean
  modules: Array<PrettyOfferModule>
  subcontractorQuotes: Array<PrettyOfferSubcontractorQuote>
  technicalOffer?: OfferDetail | null
  rentalFactorConfig?: RentalFactorConfig | null
  vehicleDistanceRate?: number | null
  vehicleDistanceIncrement?: number | null
  vehicleDailyRate?: number | null
}

export async function savePrettyOffer(
  payload: SavePrettyOfferPayload,
): Promise<void> {
  const {
    offerId,
    title,
    daysOfUse,
    vatPercent,
    sourceTechnicalOfferId,
    prettyUseCustomerAccent,
    prettyUseCustomerBackground,
    modules,
    subcontractorQuotes,
    technicalOffer,
    rentalFactorConfig,
    vehicleDistanceRate,
    vehicleDistanceIncrement,
    vehicleDailyRate,
  } = payload

  const { data: existingOffer, error: offerFetchError } = await supabase
    .from('job_offers')
    .select('locked')
    .eq('id', offerId)
    .single()

  if (offerFetchError) throw offerFetchError
  if (existingOffer?.locked) {
    throw new Error('This offer is locked and cannot be edited.')
  }

  const modulesWithCost = modules.map((module) => ({
    ...module,
    computed_cost: calculateModuleCost(
      module,
      subcontractorQuotes,
      technicalOffer ?? null,
      {
        rentalFactorConfig,
        vehicleDistanceRate,
        vehicleDistanceIncrement,
        vehicleDailyRate,
      },
    ),
  }))

  const totals = calculatePrettyOfferTotals(modulesWithCost, vatPercent)

  const { error: headerError } = await supabase
    .from('job_offers')
    .update({
      title,
      days_of_use: daysOfUse,
      vat_percent: vatPercent,
      source_technical_offer_id: sourceTechnicalOfferId,
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
          sort_order: module.sort_order,
          basis_type: module.basis_type,
          display_price: module.display_price,
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
          sort_order: module.sort_order,
          basis_type: module.basis_type,
          display_price: module.display_price,
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
    const keepManualIds = (module.manual_fields ?? [])
      .map((f) => f.id)
      .filter((id) => !isTempId(id))

    const { data: existingManual } = await supabase
      .from('pretty_offer_module_manual_fields')
      .select('id')
      .eq('module_id', moduleId)

    const manualToDelete = (existingManual || [])
      .map((r) => r.id)
      .filter((id) => !keepManualIds.includes(id))

    if (manualToDelete.length > 0) {
      await supabase
        .from('pretty_offer_module_manual_fields')
        .delete()
        .in('id', manualToDelete)
    }

    for (const field of module.manual_fields ?? []) {
      if (isTempId(field.id)) {
        const { error } = await supabase
          .from('pretty_offer_module_manual_fields')
          .insert({
            module_id: moduleId,
            label: field.label,
            value: field.value,
            sort_order: field.sort_order,
          })
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('pretty_offer_module_manual_fields')
          .update({
            label: field.label,
            value: field.value,
            sort_order: field.sort_order,
          })
          .eq('id', field.id)
        if (error) throw error
      }
    }

    const keepMappingIds = (module.category_mappings ?? [])
      .map((m) => m.id)
      .filter((id) => !isTempId(id))

    const { data: existingMappings } = await supabase
      .from('pretty_offer_module_category_mappings')
      .select('id')
      .eq('module_id', moduleId)

    const mappingsToDelete = (existingMappings || [])
      .map((r) => r.id)
      .filter((id) => !keepMappingIds.includes(id))

    if (mappingsToDelete.length > 0) {
      await supabase
        .from('pretty_offer_module_category_mappings')
        .delete()
        .in('id', mappingsToDelete)
    }

    for (const mapping of module.category_mappings ?? []) {
      if (isTempId(mapping.id)) {
        const { error } = await supabase
          .from('pretty_offer_module_category_mappings')
          .insert({
            module_id: moduleId,
            category_type: mapping.category_type,
            category_key: mapping.category_key,
          })
        if (error) throw error
      }
    }

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

  const keepQuoteIds = subcontractorQuotes
    .map((q) => q.id)
    .filter((id) => !isTempId(id))

  const { data: existingQuotes } = await supabase
    .from('pretty_offer_subcontractor_quotes')
    .select('id')
    .eq('offer_id', offerId)

  const quotesToDelete = (existingQuotes || [])
    .map((r) => r.id)
    .filter((id) => !keepQuoteIds.includes(id))

  if (quotesToDelete.length > 0) {
    await supabase
      .from('pretty_offer_subcontractor_quotes')
      .delete()
      .in('id', quotesToDelete)
  }

  const quoteIdMap = new Map<string, string>()

  for (const quote of subcontractorQuotes) {
    if (isTempId(quote.id)) {
      const { data: inserted, error } = await supabase
        .from('pretty_offer_subcontractor_quotes')
        .insert({
          offer_id: offerId,
          vendor_name: quote.vendor_name,
          note: quote.note,
          total_amount: quote.total_amount,
          customer_id: quote.customer_id,
          pdf_path: quote.pdf_path,
          pdf_filename: quote.pdf_filename,
          mime_type: quote.mime_type,
          size_bytes: quote.size_bytes,
          sort_order: quote.sort_order,
        })
        .select('id')
        .single()
      if (error) throw error
      quoteIdMap.set(quote.id, inserted.id)
    } else {
      const { error } = await supabase
        .from('pretty_offer_subcontractor_quotes')
        .update({
          vendor_name: quote.vendor_name,
          note: quote.note,
          total_amount: quote.total_amount,
          customer_id: quote.customer_id,
          pdf_path: quote.pdf_path,
          pdf_filename: quote.pdf_filename,
          mime_type: quote.mime_type,
          size_bytes: quote.size_bytes,
          sort_order: quote.sort_order,
        })
        .eq('id', quote.id)
      if (error) throw error
      quoteIdMap.set(quote.id, quote.id)
    }
  }

  for (const quote of subcontractorQuotes) {
    const quoteId = quoteIdMap.get(quote.id)!
    const keepAllocIds = (quote.allocations ?? [])
      .map((a) => a.id)
      .filter((id) => !isTempId(id))

    const { data: existingAllocs } = await supabase
      .from('pretty_offer_subcontractor_allocations')
      .select('id')
      .eq('quote_id', quoteId)

    const allocsToDelete = (existingAllocs || [])
      .map((r) => r.id)
      .filter((id) => !keepAllocIds.includes(id))

    if (allocsToDelete.length > 0) {
      await supabase
        .from('pretty_offer_subcontractor_allocations')
        .delete()
        .in('id', allocsToDelete)
    }

    for (const alloc of quote.allocations ?? []) {
      const moduleId = moduleIdMap.get(alloc.module_id) ?? alloc.module_id
      if (isTempId(alloc.id)) {
        const { error } = await supabase
          .from('pretty_offer_subcontractor_allocations')
          .insert({
            quote_id: quoteId,
            module_id: moduleId,
            allocation_mode: alloc.allocation_mode,
            allocation_value: alloc.allocation_value,
          })
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('pretty_offer_subcontractor_allocations')
          .update({
            module_id: moduleId,
            allocation_mode: alloc.allocation_mode,
            allocation_value: alloc.allocation_value,
          })
          .eq('id', alloc.id)
        if (error) throw error
      }
    }
  }
}

export async function uploadSubcontractorQuotePdf({
  companyId,
  offerId,
  file,
}: {
  companyId: string
  offerId: string
  file: File
}): Promise<{
  path: string
  filename: string
  mimeType: string
  sizeBytes: number
}> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'pdf'
  const timestamp = Date.now()
  const filename = `${timestamp}.${ext}`
  const path = `${companyId}/${offerId}/${filename}`

  const { error: uploadError } = await supabase.storage
    .from('pretty_offer_quotes')
    .upload(path, file, {
      upsert: false,
      cacheControl: '3600',
      contentType: file.type || 'application/pdf',
    })

  if (uploadError) throw uploadError

  return {
    path,
    filename: file.name,
    mimeType: file.type || 'application/pdf',
    sizeBytes: file.size,
  }
}

export async function getSubcontractorQuotePdfUrl(
  path: string,
): Promise<string> {
  const { data, error } = await supabase.storage
    .from('pretty_offer_quotes')
    .createSignedUrl(path, 3600)

  if (error) throw error
  return data.signedUrl
}

export async function recalculatePrettyOfferTotals(
  offerId: string,
): Promise<void> {
  const detail = await fetchPrettyOfferDetail(offerId)
  if (!detail) return

  let technicalOffer: OfferDetail | null = null
  if (detail.source_technical_offer_id) {
    technicalOffer = await (
      offerDetailQuery(detail.source_technical_offer_id)
        .queryFn as () => Promise<OfferDetail | null>
    )()
  }

  const modules = (detail.modules ?? []).map((module) => ({
    ...module,
    computed_cost: calculateModuleCost(
      module,
      detail.subcontractor_quotes ?? [],
      technicalOffer,
    ),
  }))

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
  if (!detail?.modules?.length && !detail?.subcontractor_quotes?.length) return

  const moduleIdMap = new Map<string, string>()

  for (const module of detail.modules ?? []) {
    const { data: inserted, error } = await supabase
      .from('pretty_offer_modules')
      .insert({
        offer_id: newOfferId,
        title: module.title,
        subtitle: null,
        sort_order: module.sort_order,
        basis_type: module.basis_type,
        display_price: module.display_price,
        show_price: module.show_price,
        computed_cost: module.computed_cost,
      })
      .select('id')
      .single()

    if (error) throw error
    moduleIdMap.set(module.id, inserted.id)

    for (const field of module.manual_fields ?? []) {
      await supabase.from('pretty_offer_module_manual_fields').insert({
        module_id: inserted.id,
        label: field.label,
        value: field.value,
        sort_order: field.sort_order,
      })
    }

    for (const mapping of module.category_mappings ?? []) {
      await supabase.from('pretty_offer_module_category_mappings').insert({
        module_id: inserted.id,
        category_type: mapping.category_type,
        category_key: mapping.category_key,
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

  for (const quote of detail.subcontractor_quotes ?? []) {
    const { data: insertedQuote, error } = await supabase
      .from('pretty_offer_subcontractor_quotes')
      .insert({
        offer_id: newOfferId,
        vendor_name: quote.vendor_name,
        note: quote.note,
        total_amount: quote.total_amount,
        customer_id: quote.customer_id,
        pdf_path: quote.pdf_path,
        pdf_filename: quote.pdf_filename,
        mime_type: quote.mime_type,
        size_bytes: quote.size_bytes,
        sort_order: quote.sort_order,
      })
      .select('id')
      .single()

    if (error) throw error

    for (const alloc of quote.allocations ?? []) {
      const newModuleId = moduleIdMap.get(alloc.module_id)
      if (!newModuleId) continue
      await supabase.from('pretty_offer_subcontractor_allocations').insert({
        quote_id: insertedQuote.id,
        module_id: newModuleId,
        allocation_mode: alloc.allocation_mode,
        allocation_value: alloc.allocation_value,
      })
    }
  }

  try {
    await recalculatePrettyOfferTotals(newOfferId)
  } catch {
    // non-blocking
  }
}
