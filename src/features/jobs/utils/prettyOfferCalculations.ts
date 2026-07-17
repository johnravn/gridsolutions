import { calculateRentalFactor } from './offerCalculations'
import type { RentalFactorConfig } from './offerCalculations'
import type {
  JobSubcontractorQuote,
  OfferBasisDetail,
  OfferDetail,
  OfferEquipmentItem,
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

export type PrettyOfferPricingOptions = {
  technicalOffersById?: Map<string, OfferDetail>
  offerBasesById?: Map<string, OfferBasisDetail>
  jobQuotesById?: Map<string, JobSubcontractorQuote>
  technicalContext?: TechnicalCostContext
  subcontractorMarkupPercent?: number
}

export function resolveSubcontractorMarkupPercent(
  offerMarkupPercent: number | null | undefined,
  companyMarkupPercent: number | null | undefined,
): number {
  if (
    offerMarkupPercent != null &&
    Number.isFinite(Number(offerMarkupPercent))
  ) {
    return Number(offerMarkupPercent)
  }
  if (
    companyMarkupPercent != null &&
    Number.isFinite(Number(companyMarkupPercent))
  ) {
    return Number(companyMarkupPercent)
  }
  return 0
}

export function shouldApplySubcontractorMarkup(
  basis: Pick<PrettyOfferPricingBasis, 'apply_subcontractor_markup'>,
): boolean {
  return basis.apply_subcontractor_markup !== false
}

function applySubcontractorMarkupToAmount(
  amount: number,
  basis: PrettyOfferPricingBasis,
  subcontractorMarkupPercent: number | undefined,
): number {
  if (!shouldApplySubcontractorMarkup(basis)) return amount
  const markup = subcontractorMarkupPercent ?? 0
  if (markup <= 0) return amount
  return amount * (1 + markup / 100)
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

const DEFAULT_MODULE_TITLE_SUGGESTIONS = [
  'Audio',
  'Lights',
  'Rigging',
  'AV',
  'Transport',
  'General',
] as const

/** Quick-pick module titles: basis categories first, then common defaults. */
export function buildModuleTitleSuggestions(
  options: {
    basisTitles?: Array<string>
    existingModules?: Array<Pick<PrettyOfferModule, 'title'>>
    currentModuleTitle?: string
  } = {},
): Array<string> {
  const {
    basisTitles = [],
    existingModules = [],
    currentModuleTitle = '',
  } = options
  const currentKey = normalizeCategoryKey(currentModuleTitle)
  const usedByOthers = new Set(
    existingModules
      .map((module) => normalizeCategoryKey(module.title))
      .filter((key) => key && key !== currentKey),
  )

  const seen = new Set<string>()
  const titles: Array<string> = []

  const addTitle = (name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    const key = normalizeCategoryKey(trimmed)
    if (seen.has(key) || usedByOthers.has(key)) return
    seen.add(key)
    titles.push(trimmed)
  }

  for (const title of basisTitles) addTitle(title)
  for (const title of DEFAULT_MODULE_TITLE_SUGGESTIONS) addTitle(title)

  return titles
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
      days_of_use:
        options.technicalContext?.daysOfUse ?? offerBasis.days_of_use ?? 1,
      discount_percent: offerBasis.discount_percent ?? 0,
      vat_percent: offerBasis.vat_percent ?? 25,
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

  const crewKeys = new Set<string>()
  for (const item of source.crew_items ?? []) {
    const key = item.role_title.trim() || item.role_category?.trim()
    if (key) crewKeys.add(key)
  }
  for (const role of [...crewKeys].sort((a, b) => a.localeCompare(b))) {
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

  if (
    (source.transport_groups ?? []).length === 0 &&
    (source.transport_items ?? []).length > 0
  ) {
    options.push({
      category_type: 'transport_group',
      category_key: 'Transport',
      label: 'Transport: Transport',
    })
  }

  return options
}

/** @deprecated Use buildLineItemCategoryOptions */
export const buildTechnicalCategoryOptions = buildLineItemCategoryOptions

export function resolveModuleIdForCategoryKey(
  categoryKey: string,
  modules: Array<Pick<PrettyOfferModule, 'id' | 'title' | 'module_type'>>,
): string | null {
  const normalized = normalizeCategoryKey(categoryKey)
  return (
    getPricingEligibleModules(modules).find(
      (module) => normalizeCategoryKey(module.title) === normalized,
    )?.id ?? null
  )
}

/** Rebuild internal-offer splits from basis categories and module title matching. */
export function rebuildTechnicalSplitsForCopy({
  lineItemSource,
  modules,
}: {
  lineItemSource: TechnicalLineItemSource
  modules: Array<Pick<PrettyOfferModule, 'id' | 'title' | 'module_type'>>
}): Array<Omit<PrettyOfferPricingBasisSplit, 'id' | 'basis_id'>> {
  const options = buildLineItemCategoryOptions(lineItemSource)
  const pricingModules = getPricingEligibleModules(modules)
  const defaultModuleId = pricingModules[0]?.id ?? ''

  return options.map((opt, index) => ({
    module_id:
      resolveModuleIdForCategoryKey(opt.category_key, modules) ??
      defaultModuleId,
    title: opt.label,
    amount: 0,
    sort_order: index,
    category_type: opt.category_type,
    category_key: opt.category_key,
  }))
}

export type TechnicalBasisTotals = {
  equipmentSubtotal: number
  crewSubtotal: number
  transportSubtotal: number
  totalBeforeDiscount: number
  discountPercent: number
  discountAmount: number
  totalAfterDiscount: number
  vatPercent: number
  totalWithVat: number
}

function equipmentItemAmount(
  item: OfferEquipmentItem,
  source: TechnicalLineItemSource,
  technicalContext?: TechnicalCostContext,
): number {
  if (item.total_price > 0) return item.total_price
  const rentalFactor = calculateRentalFactor(
    source.days_of_use,
    technicalContext?.rentalFactorConfig,
  )
  return item.unit_price * item.quantity * rentalFactor
}

function sumEquipmentSubtotal(
  source: TechnicalLineItemSource,
  technicalContext?: TechnicalCostContext,
): number {
  return (source.groups ?? []).reduce(
    (sum, group) =>
      sum +
      (group.items ?? []).reduce(
        (groupSum, item) =>
          groupSum + equipmentItemAmount(item, source, technicalContext),
        0,
      ),
    0,
  )
}

function sumCrewSubtotal(source: TechnicalLineItemSource): number {
  return (source.crew_items ?? []).reduce(
    (sum, item) => sum + item.total_price,
    0,
  )
}

function sumTransportSubtotal(source: TechnicalLineItemSource): number {
  return (source.transport_items ?? []).reduce(
    (sum, item) => sum + item.total_price,
    0,
  )
}

/** Totals from stored line-item prices — matches offer basis editor figures. */
export function calculateTechnicalBasisTotals(
  source: TechnicalLineItemSource,
  technicalContext?: TechnicalCostContext,
): TechnicalBasisTotals {
  const equipmentSubtotal = sumEquipmentSubtotal(source, technicalContext)
  const crewSubtotal = sumCrewSubtotal(source)
  const transportSubtotal = sumTransportSubtotal(source)
  const totalBeforeDiscount =
    equipmentSubtotal + crewSubtotal + transportSubtotal
  const discountPercent = source.discount_percent ?? 0
  const discountAmount = (equipmentSubtotal * discountPercent) / 100
  const totalAfterDiscount = totalBeforeDiscount - discountAmount
  const vatPercent = source.vat_percent ?? 25
  const totalWithVat = totalAfterDiscount * (1 + vatPercent / 100)

  return {
    equipmentSubtotal,
    crewSubtotal,
    transportSubtotal,
    totalBeforeDiscount,
    discountPercent,
    discountAmount,
    totalAfterDiscount,
    vatPercent,
    totalWithVat,
  }
}

function equipmentGroupSubtotal(
  groupName: string,
  technicalOffer: TechnicalLineItemSource,
  technicalContext?: TechnicalCostContext,
): number {
  const normalized = normalizeCategoryKey(groupName)
  const group = (technicalOffer.groups ?? []).find(
    (g) => normalizeCategoryKey(g.group_name) === normalized,
  )
  if (!group) return 0

  return (group.items ?? []).reduce(
    (sum, item) =>
      sum + equipmentItemAmount(item, technicalOffer, technicalContext),
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
  if (group) {
    return (group.items ?? []).reduce((sum, item) => sum + item.total_price, 0)
  }

  if (
    normalized === normalizeCategoryKey('Transport') &&
    (technicalOffer.transport_groups ?? []).length === 0
  ) {
    return (technicalOffer.transport_items ?? []).reduce(
      (sum, item) => sum + item.total_price,
      0,
    )
  }

  return 0
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

  const totals = calculateTechnicalBasisTotals(technicalOffer, technicalContext)

  if (split.category_type === 'equipment_group') {
    const groupSubtotal = equipmentGroupSubtotal(
      split.category_key,
      technicalOffer,
      technicalContext,
    )
    const groupDiscount =
      totals.equipmentSubtotal > 0
        ? (groupSubtotal / totals.equipmentSubtotal) * totals.discountAmount
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

export function calculateSplitAmountBeforeMarkup(
  split: PrettyOfferPricingBasisSplit,
  basis: PrettyOfferPricingBasis,
  options: PrettyOfferPricingOptions = {},
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

export function calculateSplitAmount(
  split: PrettyOfferPricingBasisSplit,
  basis: PrettyOfferPricingBasis,
  options: PrettyOfferPricingOptions = {},
): number {
  return applySubcontractorMarkupToAmount(
    calculateSplitAmountBeforeMarkup(split, basis, options),
    basis,
    options.subcontractorMarkupPercent,
  )
}

export function calculateModuleCostFromSplits(
  moduleId: string,
  pricingBases: Array<PrettyOfferPricingBasis>,
  options: PrettyOfferPricingOptions = {},
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

export function calculateModuleMarkupFromSplits(
  moduleId: string,
  pricingBases: Array<PrettyOfferPricingBasis>,
  options: PrettyOfferPricingOptions = {},
): number {
  let markup = 0
  for (const basis of pricingBases) {
    for (const split of basis.splits ?? []) {
      if (split.module_id !== moduleId) continue
      const beforeMarkup = calculateSplitAmountBeforeMarkup(
        split,
        basis,
        options,
      )
      const withMarkup = calculateSplitAmount(split, basis, options)
      markup += withMarkup - beforeMarkup
    }
  }
  return markup
}

export function applyComputedCostsToModules(
  modules: Array<PrettyOfferModule>,
  pricingBases: Array<PrettyOfferPricingBasis>,
  options: PrettyOfferPricingOptions = {},
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

export function isPricingEligibleModule(
  module: Pick<PrettyOfferModule, 'module_type'>,
): boolean {
  return module.module_type !== 'timeline'
}

export function getPricingEligibleModules<
  T extends Pick<PrettyOfferModule, 'id' | 'module_type'>,
>(modules: Array<T>): Array<T> {
  return modules.filter(isPricingEligibleModule)
}

export function validatePricingBases(
  pricingBases: Array<PrettyOfferPricingBasis>,
  modules: Array<Pick<PrettyOfferModule, 'id' | 'module_type' | 'title'>>,
  jobQuotesById: Map<string, JobSubcontractorQuote>,
): Array<PricingBasisValidationIssue> {
  const issues: Array<PricingBasisValidationIssue> = []
  const moduleIds = new Set(modules.map((m) => m.id))
  const moduleById = new Map(modules.map((m) => [m.id, m]))
  const timelineModuleIds = new Set(
    modules.filter((m) => m.module_type === 'timeline').map((m) => m.id),
  )

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
      } else if (timelineModuleIds.has(split.module_id)) {
        const moduleTitle =
          moduleById.get(split.module_id)?.title?.trim() || 'Program timeline'
        issues.push({
          basisId: basis.id,
          message: `Split "${split.title}" cannot be assigned to timeline module "${moduleTitle}".`,
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

export function buildPrettyOfferPricingFields(
  modules: Array<PrettyOfferModule>,
  options: {
    daysOfUse: number
    vatPercent: number
    discountPercent?: number
  },
): {
  days_of_use: number
  vat_percent: number
  discount_percent: number
  total_before_discount: number
  total_after_discount: number
  total_with_vat: number
} {
  const { daysOfUse, vatPercent, discountPercent = 0 } = options
  const { totalBeforeDiscount } = calculatePrettyOfferTotals(
    modules,
    vatPercent,
  )
  const discountAmount = (totalBeforeDiscount * discountPercent) / 100
  const totalAfterDiscount = totalBeforeDiscount - discountAmount
  const totalWithVat = totalAfterDiscount * (1 + vatPercent / 100)

  return {
    days_of_use: daysOfUse,
    vat_percent: vatPercent,
    discount_percent: discountPercent,
    total_before_discount: totalBeforeDiscount,
    total_after_discount: totalAfterDiscount,
    total_with_vat: totalWithVat,
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

export function basisSubtotalBeforeMarkup(
  basis: PrettyOfferPricingBasis,
  options: PrettyOfferPricingOptions = {},
): number {
  return (basis.splits ?? []).reduce(
    (sum, split) =>
      sum + calculateSplitAmountBeforeMarkup(split, basis, options),
    0,
  )
}

export function basisSubtotal(
  basis: PrettyOfferPricingBasis,
  options: PrettyOfferPricingOptions = {},
): number {
  return (basis.splits ?? []).reduce(
    (sum, split) => sum + calculateSplitAmount(split, basis, options),
    0,
  )
}

export function basisMarkupAmount(
  basis: PrettyOfferPricingBasis,
  options: PrettyOfferPricingOptions = {},
): number {
  if (!shouldApplySubcontractorMarkup(basis)) return 0
  const markupPercent = options.subcontractorMarkupPercent ?? 0
  if (markupPercent <= 0) return 0
  const beforeMarkup = basisSubtotalBeforeMarkup(basis, options)
  return beforeMarkup * (markupPercent / 100)
}

export type BasisAllocationStatus = {
  sourceTotal: number
  assignedTotal: number
  remaining: number
  isFullyAllocated: boolean
  sourceTotalLabel: string
  /** Split and source totals are ex-VAT internal costs. */
  amountsExcludeVat: boolean
  vatPercent: number
  sourceTotalWithVat: number
  assignedTotalWithVat: number
  discountPercent: number
}

export function getBasisAllocationStatus(
  basis: PrettyOfferPricingBasis,
  options: PrettyOfferPricingOptions = {},
): BasisAllocationStatus | null {
  if (basis.basis_type === 'custom') return null

  if (basis.basis_type === 'subcontractor') {
    if (!basis.job_subcontractor_quote_id) return null
    const quote = options.jobQuotesById?.get(basis.job_subcontractor_quote_id)
    if (!quote) return null

    const assignedTotal = (basis.splits ?? []).reduce(
      (sum, split) => sum + split.amount,
      0,
    )
    const sourceTotal = quote.total_amount
    const remaining = sourceTotal - assignedTotal

    return {
      sourceTotal,
      assignedTotal,
      remaining,
      isFullyAllocated: Math.abs(remaining) < 0.01,
      sourceTotalLabel: 'Quote total',
      amountsExcludeVat: false,
      vatPercent: 0,
      sourceTotalWithVat: sourceTotal,
      assignedTotalWithVat: assignedTotal,
      discountPercent: 0,
    }
  }

  const source = resolveTechnicalLineItemSource(basis, options)
  if (!source) return null

  const basisTotals = calculateTechnicalBasisTotals(
    source,
    options.technicalContext,
  )
  const sourceTotal = basisTotals.totalAfterDiscount
  const assignedTotal = (basis.splits ?? []).reduce(
    (sum, split) =>
      sum +
      calculateTechnicalSplitAmount(split, source, options.technicalContext),
    0,
  )
  const remaining = sourceTotal - assignedTotal
  const vatMultiplier = 1 + basisTotals.vatPercent / 100

  return {
    sourceTotal,
    assignedTotal,
    remaining,
    isFullyAllocated: Math.abs(remaining) < 0.01,
    sourceTotalLabel: 'Offer basis total (excl. VAT)',
    amountsExcludeVat: true,
    vatPercent: basisTotals.vatPercent,
    sourceTotalWithVat: sourceTotal * vatMultiplier,
    assignedTotalWithVat: assignedTotal * vatMultiplier,
    discountPercent: basisTotals.discountPercent,
  }
}

export function resolveModuleCustomerPrice(module: {
  show_price: boolean
  display_price: number | null
  computed_cost?: number | null
}): number | null {
  if (!module.show_price) return null
  const computed =
    module.computed_cost != null ? Number(module.computed_cost) : null
  if (computed != null && Number.isFinite(computed) && computed > 0) {
    return computed
  }
  const display =
    module.display_price != null ? Number(module.display_price) : null
  if (display != null && Number.isFinite(display) && display > 0) {
    return display
  }
  return null
}

/** Map a module for the customer-facing pretty offer deck. */
export function buildPublicPrettyModule(
  module: {
    id: string
    module_type?: PrettyOfferModule['module_type']
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
    timeline_items?: PublicPrettyOfferModule['timeline_items']
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
    computedCost > 0
      ? computedCost
      : manualDisplay != null && Number.isFinite(manualDisplay)
        ? manualDisplay
        : null
  const hasCustomerPrice = resolvedDisplay != null && resolvedDisplay > 0

  return {
    id: module.id,
    module_type: module.module_type ?? 'standard',
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
    timeline_items: module.timeline_items ?? [],
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

export const PRETTY_OFFER_MODULE_REQUIRED_FIELD_COUNT = 4
export const PRETTY_OFFER_TIMELINE_MODULE_REQUIRED_FIELD_COUNT = 2

function countRequiredFieldsForModule(
  module: Pick<PrettyOfferModule, 'module_type'>,
): number {
  return module.module_type === 'timeline'
    ? PRETTY_OFFER_TIMELINE_MODULE_REQUIRED_FIELD_COUNT
    : PRETTY_OFFER_MODULE_REQUIRED_FIELD_COUNT
}

export type PrettyOfferModuleCompletionStats = {
  moduleCount: number
  totalRequired: number
  remaining: number
  completed: number
  isComplete: boolean
}

export function getPrettyOfferModuleCompletionStats(
  modules: Array<
    Pick<
      PrettyOfferModule,
      | 'id'
      | 'module_type'
      | 'title'
      | 'story_body_1'
      | 'hero_media_type'
      | 'hero_media_url'
      | 'timeline_items'
    >
  >,
): PrettyOfferModuleCompletionStats {
  const issues = validatePrettyOfferModules(modules)
  const moduleCount = modules.length
  const totalRequired = modules.reduce(
    (sum, module) => sum + countRequiredFieldsForModule(module),
    0,
  )
  const remaining = issues.length

  return {
    moduleCount,
    totalRequired,
    remaining,
    completed: totalRequired - remaining,
    isComplete: moduleCount > 0 && remaining === 0,
  }
}

export function isPrettyModuleStoryComplete(
  module: Pick<
    PrettyOfferModule,
    | 'id'
    | 'module_type'
    | 'title'
    | 'story_body_1'
    | 'hero_media_type'
    | 'hero_media_url'
    | 'timeline_items'
  >,
): boolean {
  return validatePrettyOfferModules([module]).length === 0
}

export function validatePrettyOfferModules(
  modules: Array<
    Pick<
      PrettyOfferModule,
      | 'id'
      | 'module_type'
      | 'title'
      | 'story_body_1'
      | 'hero_media_type'
      | 'hero_media_url'
      | 'timeline_items'
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

    if (module.module_type === 'timeline') {
      if ((module.timeline_items?.length ?? 0) === 0) {
        issues.push({
          moduleId: module.id,
          field: 'timeline_items',
          message: `Module "${label}" needs an imported program timeline.`,
        })
      }
      continue
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
