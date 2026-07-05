import { calculateOfferTotals } from './offerCalculations'
import type { RentalFactorConfig } from './offerCalculations'
import type {
  JobSubcontractorQuote,
  OfferBasisDetail,
  OfferDetail,
  PrettyCategoryType,
  PrettyOfferModule,
  PrettyOfferPricingBasis,
  PrettyOfferPricingBasisSplit,
  PublicPrettyOfferModule,
} from '../types'

export function normalizeCategoryKey(key: string): string {
  return key.trim().toLowerCase()
}

export type TechnicalCostContext = {
  rentalFactorConfig?: RentalFactorConfig | null
  vehicleDistanceRate?: number | null
  vehicleDistanceIncrement?: number | null
  vehicleDailyRate?: number | null
  daysOfUse?: number
}

export type TechnicalLineItemSource = Pick<
  OfferDetail,
  | 'groups'
  | 'crew_items'
  | 'transport_items'
  | 'transport_groups'
  | 'days_of_use'
  | 'discount_percent'
  | 'vat_percent'
>

export function lineItemSourceFromOfferBasis(
  basis: Pick<
    OfferBasisDetail,
    | 'groups'
    | 'crew_items'
    | 'transport_items'
    | 'transport_groups'
    | 'days_of_use'
  >,
): TechnicalLineItemSource {
  return {
    groups: basis.groups,
    crew_items: basis.crew_items,
    transport_items: basis.transport_items,
    transport_groups: basis.transport_groups,
    days_of_use: basis.days_of_use,
    discount_percent: 0,
    vat_percent: 25,
  }
}

/** Unique module titles derived from equipment groups, crew roles, and transport groups. */
export function buildModuleTitlesFromLineItemSource(
  source: TechnicalLineItemSource,
): Array<string> {
  const seen = new Set<string>()
  const titles: Array<string> = []

  const addTitle = (name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    const key = normalizeCategoryKey(trimmed)
    if (seen.has(key)) return
    seen.add(key)
    titles.push(trimmed)
  }

  for (const group of [...(source.groups ?? [])].sort(
    (a, b) => a.sort_order - b.sort_order,
  )) {
    addTitle(group.group_name)
  }

  for (const item of [...(source.crew_items ?? [])].sort(
    (a, b) => a.sort_order - b.sort_order,
  )) {
    addTitle(item.role_title)
  }

  for (const group of [...(source.transport_groups ?? [])].sort(
    (a, b) => a.sort_order - b.sort_order,
  )) {
    addTitle(group.group_name)
  }

  if (
    (source.transport_groups ?? []).length === 0 &&
    (source.transport_items ?? []).length > 0
  ) {
    addTitle('Transport')
  }

  return titles
}

export function filterNewModuleTitles(
  titles: Array<string>,
  existingModules: Array<Pick<PrettyOfferModule, 'title'>>,
): Array<string> {
  const existingKeys = new Set(
    existingModules.map((module) => normalizeCategoryKey(module.title)),
  )
  return titles.filter(
    (title) => !existingKeys.has(normalizeCategoryKey(title)),
  )
}

function resolveTechnicalLineItemSource(
  basis: PrettyOfferPricingBasis,
  options: {
    technicalOffersById?: Map<string, OfferDetail>
    offerBasesById?: Map<string, OfferBasisDetail>
    technicalContext?: TechnicalCostContext
  },
): TechnicalLineItemSource | null {
  if (basis.source_offer_basis_id) {
    const offerBasis = options.offerBasesById?.get(basis.source_offer_basis_id)
    if (!offerBasis) return null
    return {
      groups: offerBasis.groups,
      crew_items: offerBasis.crew_items,
      transport_items: offerBasis.transport_items,
      transport_groups: offerBasis.transport_groups,
      days_of_use: options.technicalContext?.daysOfUse ?? 1,
      discount_percent: 0,
      vat_percent: 25,
    }
  }

  const technicalOfferId = basis.source_technical_offer_id
  if (!technicalOfferId) return null
  return options.technicalOffersById?.get(technicalOfferId) ?? null
}

export type TechnicalCategoryOption = {
  category_type: PrettyCategoryType
  category_key: string
  label: string
}

export function buildLineItemCategoryOptions(
  source: TechnicalLineItemSource,
): Array<TechnicalCategoryOption> {
  const options: Array<TechnicalCategoryOption> = []

  for (const group of source.groups ?? []) {
    if (!group.group_name.trim()) continue
    options.push({
      category_type: 'equipment_group',
      category_key: group.group_name,
      label: `Equipment: ${group.group_name}`,
    })
  }

  const crewRoles = new Set<string>()
  for (const item of source.crew_items ?? []) {
    if (!item.role_title.trim()) continue
    crewRoles.add(item.role_title.trim())
  }
  for (const role of [...crewRoles].sort((a, b) => a.localeCompare(b))) {
    options.push({
      category_type: 'crew_category',
      category_key: role,
      label: `Crew: ${role}`,
    })
  }

  for (const group of source.transport_groups ?? []) {
    if (!group.group_name.trim()) continue
    options.push({
      category_type: 'transport_group',
      category_key: group.group_name,
      label: `Transport: ${group.group_name}`,
    })
  }

  return options
}

/** @deprecated Use buildLineItemCategoryOptions */
export const buildTechnicalCategoryOptions = buildLineItemCategoryOptions

export function resolveModuleIdForCategoryKey(
  categoryKey: string,
  modules: Array<Pick<PrettyOfferModule, 'id' | 'title'>>,
): string | null {
  const normalized = normalizeCategoryKey(categoryKey)
  return (
    modules.find((module) => normalizeCategoryKey(module.title) === normalized)
      ?.id ?? null
  )
}

function equipmentGroupSubtotal(
  groupName: string,
  technicalOffer: TechnicalLineItemSource,
  rentalFactor: number,
): number {
  const normalized = normalizeCategoryKey(groupName)
  const group = (technicalOffer.groups ?? []).find(
    (g) => normalizeCategoryKey(g.group_name) === normalized,
  )
  if (!group) return 0

  return (group.items ?? []).reduce(
    (sum, item) => sum + item.unit_price * item.quantity * rentalFactor,
    0,
  )
}

function crewCategorySubtotal(
  categoryKey: string,
  technicalOffer: TechnicalLineItemSource,
): number {
  const normalized = normalizeCategoryKey(categoryKey)
  return (technicalOffer.crew_items ?? [])
    .filter(
      (item) =>
        normalizeCategoryKey(item.role_title) === normalized ||
        normalizeCategoryKey(item.role_category ?? '') === normalized,
    )
    .reduce((sum, item) => sum + item.total_price, 0)
}

function transportGroupSubtotal(
  groupName: string,
  technicalOffer: TechnicalLineItemSource,
): number {
  const normalized = normalizeCategoryKey(groupName)
  const group = (technicalOffer.transport_groups ?? []).find(
    (g) => normalizeCategoryKey(g.group_name) === normalized,
  )
  if (!group) return 0
  return (group.items ?? []).reduce((sum, item) => sum + item.total_price, 0)
}

export function calculateTechnicalSplitAmount(
  split: Pick<
    PrettyOfferPricingBasisSplit,
    'category_type' | 'category_key' | 'amount'
  >,
  technicalOffer: TechnicalLineItemSource,
  technicalContext?: TechnicalCostContext,
): number {
  if (!split.category_type || !split.category_key) return split.amount

  const equipmentItems = (technicalOffer.groups ?? []).flatMap((g) => g.items)
  const totals = calculateOfferTotals(
    equipmentItems,
    technicalOffer.crew_items ?? [],
    technicalOffer.transport_items ?? [],
    technicalOffer.days_of_use,
    technicalOffer.discount_percent,
    technicalOffer.vat_percent,
    technicalContext?.rentalFactorConfig,
    technicalContext?.vehicleDistanceRate,
    technicalContext?.vehicleDistanceIncrement,
    technicalContext?.vehicleDailyRate,
  )

  const rentalFactor = totals.equipmentRentalFactor
  const equipmentSubtotal = totals.equipmentSubtotal
  const discountAmount = totals.discountAmount

  if (split.category_type === 'equipment_group') {
    const groupSubtotal = equipmentGroupSubtotal(
      split.category_key,
      technicalOffer,
      rentalFactor,
    )
    const groupDiscount =
      equipmentSubtotal > 0
        ? (groupSubtotal / equipmentSubtotal) * discountAmount
        : 0
    return groupSubtotal - groupDiscount
  }

  if (split.category_type === 'crew_category') {
    return crewCategorySubtotal(split.category_key, technicalOffer)
  }

  if (split.category_type === 'transport_group') {
    return transportGroupSubtotal(split.category_key, technicalOffer)
  }

  return 0
}

export function calculateSplitAmount(
  split: PrettyOfferPricingBasisSplit,
  basis: PrettyOfferPricingBasis,
  options: {
    technicalOffersById?: Map<string, OfferDetail>
    offerBasesById?: Map<string, OfferBasisDetail>
    jobQuotesById?: Map<string, JobSubcontractorQuote>
    technicalContext?: TechnicalCostContext
  } = {},
): number {
  if (basis.basis_type === 'technical') {
    const source = resolveTechnicalLineItemSource(basis, options)
    if (!source) return 0
    return calculateTechnicalSplitAmount(
      split,
      source,
      options.technicalContext,
    )
  }

  return split.amount
}

export function calculateModuleCostFromSplits(
  moduleId: string,
  pricingBases: Array<PrettyOfferPricingBasis>,
  options: {
    technicalOffersById?: Map<string, OfferDetail>
    offerBasesById?: Map<string, OfferBasisDetail>
    jobQuotesById?: Map<string, JobSubcontractorQuote>
    technicalContext?: TechnicalCostContext
  } = {},
): number {
  let total = 0
  for (const basis of pricingBases) {
    for (const split of basis.splits ?? []) {
      if (split.module_id !== moduleId) continue
      total += calculateSplitAmount(split, basis, options)
    }
  }
  return total
}

export function applyComputedCostsToModules(
  modules: Array<PrettyOfferModule>,
  pricingBases: Array<PrettyOfferPricingBasis>,
  options: {
    technicalOffersById?: Map<string, OfferDetail>
    offerBasesById?: Map<string, OfferBasisDetail>
    jobQuotesById?: Map<string, JobSubcontractorQuote>
    technicalContext?: TechnicalCostContext
  } = {},
): Array<PrettyOfferModule> {
  return modules.map((module) => ({
    ...module,
    computed_cost: calculateModuleCostFromSplits(
      module.id,
      pricingBases,
      options,
    ),
  }))
}

export function resolveSplitAmountsForSave(
  pricingBases: Array<PrettyOfferPricingBasis>,
  options: {
    technicalOffersById?: Map<string, OfferDetail>
    offerBasesById?: Map<string, OfferBasisDetail>
    technicalContext?: TechnicalCostContext
  } = {},
): Array<PrettyOfferPricingBasis> {
  return pricingBases.map((basis) => ({
    ...basis,
    splits: (basis.splits ?? []).map((split) => {
      if (basis.basis_type !== 'technical') return split
      const source = resolveTechnicalLineItemSource(basis, options)
      if (!source) return split
      return {
        ...split,
        amount: calculateTechnicalSplitAmount(
          split,
          source,
          options.technicalContext,
        ),
      }
    }),
  }))
}

export type PricingBasisValidationIssue = {
  basisId: string
  message: string
}

export function validatePricingBases(
  pricingBases: Array<PrettyOfferPricingBasis>,
  modules: Array<Pick<PrettyOfferModule, 'id'>>,
  jobQuotesById: Map<string, JobSubcontractorQuote>,
): Array<PricingBasisValidationIssue> {
  const issues: Array<PricingBasisValidationIssue> = []
  const moduleIds = new Set(modules.map((m) => m.id))

  for (const basis of pricingBases) {
    const splits = basis.splits ?? []

    if (splits.length === 0) continue

    for (const split of splits) {
      if (!split.module_id) {
        issues.push({
          basisId: basis.id,
          message: `Every split in "${basis.title || 'Untitled basis'}" must be connected to a module.`,
        })
        break
      }
      if (!moduleIds.has(split.module_id)) {
        issues.push({
          basisId: basis.id,
          message: `Split "${split.title}" references a module that no longer exists.`,
        })
      }
    }

    if (
      basis.basis_type === 'technical' &&
      !basis.source_offer_basis_id &&
      !basis.source_technical_offer_id
    ) {
      issues.push({
        basisId: basis.id,
        message: `Technical basis "${basis.title || 'Untitled'}" must link to an offer basis or technical offer.`,
      })
    }

    if (basis.basis_type === 'subcontractor') {
      if (!basis.job_subcontractor_quote_id) {
        issues.push({
          basisId: basis.id,
          message: `Subcontractor basis "${basis.title || 'Untitled'}" must link to a quote version.`,
        })
        continue
      }

      const quote = jobQuotesById.get(basis.job_subcontractor_quote_id)
      if (!quote) {
        issues.push({
          basisId: basis.id,
          message: `Subcontractor basis "${basis.title || 'Untitled'}" references a missing quote.`,
        })
        continue
      }

      const splitSum = splits.reduce((sum, split) => sum + split.amount, 0)
      if (Math.abs(splitSum - quote.total_amount) > 0.01) {
        issues.push({
          basisId: basis.id,
          message: `Subcontractor splits must sum to quote total (${quote.total_amount.toLocaleString('nb-NO')} NOK, currently ${splitSum.toLocaleString('nb-NO')} NOK).`,
        })
      }
    }
  }

  return issues
}

export function calculatePrettyOfferTotals(
  modules: Array<PrettyOfferModule>,
  vatPercent: number,
): {
  totalBeforeDiscount: number
  totalAfterDiscount: number
  totalWithVat: number
} {
  const totalBeforeDiscount = modules.reduce(
    (sum, module) => sum + (module.computed_cost ?? 0),
    0,
  )
  const totalAfterDiscount = totalBeforeDiscount
  const totalWithVat = totalAfterDiscount * (1 + vatPercent / 100)

  return {
    totalBeforeDiscount,
    totalAfterDiscount,
    totalWithVat,
  }
}

export function suggestTechnicalSplitsForModule(
  moduleTitle: string,
  technicalOffer: OfferDetail,
  moduleId: string,
): Array<Omit<PrettyOfferPricingBasisSplit, 'id' | 'basis_id'>> {
  const normalizedTitle = normalizeCategoryKey(moduleTitle)
  if (!normalizedTitle) return []

  const suggestions: Array<
    Omit<PrettyOfferPricingBasisSplit, 'id' | 'basis_id'>
  > = []
  let sortOrder = 0

  for (const group of technicalOffer.groups ?? []) {
    if (normalizeCategoryKey(group.group_name) === normalizedTitle) {
      suggestions.push({
        module_id: moduleId,
        title: `Equipment: ${group.group_name}`,
        amount: 0,
        sort_order: sortOrder++,
        category_type: 'equipment_group',
        category_key: group.group_name,
      })
    }
  }

  for (const item of technicalOffer.crew_items ?? []) {
    const roleKey = item.role_title || item.role_category
    if (roleKey && normalizeCategoryKey(roleKey) === normalizedTitle) {
      suggestions.push({
        module_id: moduleId,
        title: `Crew: ${roleKey}`,
        amount: 0,
        sort_order: sortOrder++,
        category_type: 'crew_category',
        category_key: roleKey,
      })
    }
  }

  for (const group of technicalOffer.transport_groups ?? []) {
    if (normalizeCategoryKey(group.group_name) === normalizedTitle) {
      suggestions.push({
        module_id: moduleId,
        title: `Transport: ${group.group_name}`,
        amount: 0,
        sort_order: sortOrder++,
        category_type: 'transport_group',
        category_key: group.group_name,
      })
    }
  }

  const seen = new Set<string>()
  return suggestions.filter((s) => {
    const key = `${s.category_type}:${normalizeCategoryKey(s.category_key ?? '')}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function basisSubtotal(
  basis: PrettyOfferPricingBasis,
  options: {
    technicalOffersById?: Map<string, OfferDetail>
    offerBasesById?: Map<string, OfferBasisDetail>
    jobQuotesById?: Map<string, JobSubcontractorQuote>
    technicalContext?: TechnicalCostContext
  } = {},
): number {
  return (basis.splits ?? []).reduce(
    (sum, split) => sum + calculateSplitAmount(split, basis, options),
    0,
  )
}

export function resolveModuleCustomerPrice(module: {
  show_price: boolean
  display_price: number | null
  computed_cost?: number | null
}): number | null {
  if (!module.show_price) return null
  const display =
    module.display_price != null ? Number(module.display_price) : null
  if (display != null && Number.isFinite(display)) return display
  const computed =
    module.computed_cost != null ? Number(module.computed_cost) : null
  if (computed != null && Number.isFinite(computed) && computed > 0) {
    return computed
  }
  return null
}

/** Map a module for the customer-facing pretty offer deck. */
export function buildPublicPrettyModule(
  module: {
    id: string
    title: string
    tagline?: string | null
    story_heading_1?: string | null
    story_body_1?: string | null
    story_heading_2?: string | null
    story_body_2?: string | null
    hero_media_type?: PrettyOfferModule['hero_media_type']
    hero_media_url?: string | null
    hero_media_caption?: string | null
    sort_order: number
    display_price: number | null
    show_price: boolean
    computed_cost?: number | null
    blocks?: PublicPrettyOfferModule['blocks']
    content_blocks?: PublicPrettyOfferModule['blocks']
  },
  showPricePerLine: boolean,
): PublicPrettyOfferModule {
  const computedCost =
    module.computed_cost != null ? Number(module.computed_cost) : 0
  const manualDisplay =
    module.display_price != null ? Number(module.display_price) : null
  const resolvedDisplay =
    manualDisplay != null && Number.isFinite(manualDisplay)
      ? manualDisplay
      : computedCost > 0
        ? computedCost
        : null
  const hasCustomerPrice = resolvedDisplay != null && resolvedDisplay > 0

  return {
    id: module.id,
    title: module.title,
    tagline: module.tagline,
    story_heading_1: module.story_heading_1,
    story_body_1: module.story_body_1,
    story_heading_2: module.story_heading_2,
    story_body_2: module.story_body_2,
    hero_media_type: module.hero_media_type,
    hero_media_url: module.hero_media_url,
    hero_media_caption: module.hero_media_caption,
    sort_order: module.sort_order,
    display_price: resolvedDisplay,
    computed_cost: computedCost,
    show_price: showPricePerLine && hasCustomerPrice,
    blocks: module.blocks ?? module.content_blocks ?? [],
  }
}

export function getModuleStoryPairs(
  module: Pick<
    PrettyOfferModule,
    'story_heading_1' | 'story_body_1' | 'story_heading_2' | 'story_body_2'
  >,
): Array<{ heading: string | null; body: string }> {
  const pairs: Array<{ heading: string | null; body: string }> = []
  if (module.story_body_1?.trim()) {
    pairs.push({
      heading: module.story_heading_1?.trim() || null,
      body: module.story_body_1.trim(),
    })
  }
  if (module.story_body_2?.trim()) {
    pairs.push({
      heading: module.story_heading_2?.trim() || null,
      body: module.story_body_2.trim(),
    })
  }
  return pairs
}

export type PrettyOfferModuleValidationIssue = {
  moduleId: string
  field?: string
  message: string
}

export function isPrettyModuleStoryComplete(
  module: Pick<
    PrettyOfferModule,
    'id' | 'title' | 'story_body_1' | 'hero_media_type' | 'hero_media_url'
  >,
): boolean {
  return validatePrettyOfferModules([module]).length === 0
}

export function validatePrettyOfferModules(
  modules: Array<
    Pick<
      PrettyOfferModule,
      'id' | 'title' | 'story_body_1' | 'hero_media_type' | 'hero_media_url'
    >
  >,
): Array<PrettyOfferModuleValidationIssue> {
  const issues: Array<PrettyOfferModuleValidationIssue> = []

  for (const module of modules) {
    const label = module.title.trim() || 'Untitled module'

    if (!module.title.trim()) {
      issues.push({
        moduleId: module.id,
        field: 'title',
        message: `Module "${label}" needs a title.`,
      })
    }

    if (!module.story_body_1?.trim()) {
      issues.push({
        moduleId: module.id,
        field: 'story_body_1',
        message: `Module "${label}" needs at least one story paragraph.`,
      })
    }

    if (!module.hero_media_type) {
      issues.push({
        moduleId: module.id,
        field: 'hero_media_type',
        message: `Module "${label}" needs hero media (image or video).`,
      })
    }

    if (!module.hero_media_url?.trim()) {
      issues.push({
        moduleId: module.id,
        field: 'hero_media_url',
        message: `Module "${label}" needs hero media uploaded or linked.`,
      })
    }
  }

  return issues
}
