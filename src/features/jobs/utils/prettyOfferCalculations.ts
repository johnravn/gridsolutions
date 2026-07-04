import { calculateOfferTotals } from './offerCalculations'
import type { RentalFactorConfig } from './offerCalculations'
import type {
  JobSubcontractorQuote,
  OfferDetail,
  PrettyCategoryType,
  PrettyOfferModule,
  PrettyOfferPricingBasis,
  PrettyOfferPricingBasisSplit,
} from '../types'

export function normalizeCategoryKey(key: string): string {
  return key.trim().toLowerCase()
}

export type TechnicalCostContext = {
  rentalFactorConfig?: RentalFactorConfig | null
  vehicleDistanceRate?: number | null
  vehicleDistanceIncrement?: number | null
  vehicleDailyRate?: number | null
}

export type TechnicalCategoryOption = {
  category_type: PrettyCategoryType
  category_key: string
  label: string
}

export function buildTechnicalCategoryOptions(
  technicalOffer: OfferDetail,
): Array<TechnicalCategoryOption> {
  const options: Array<TechnicalCategoryOption> = []

  for (const group of technicalOffer.groups ?? []) {
    if (!group.group_name.trim()) continue
    options.push({
      category_type: 'equipment_group',
      category_key: group.group_name,
      label: `Equipment: ${group.group_name}`,
    })
  }

  const crewCategories = new Set<string>()
  for (const item of technicalOffer.crew_items ?? []) {
    if (!item.role_category?.trim()) continue
    crewCategories.add(item.role_category)
  }
  for (const category of crewCategories) {
    options.push({
      category_type: 'crew_category',
      category_key: category,
      label: `Crew: ${category}`,
    })
  }

  for (const group of technicalOffer.transport_groups ?? []) {
    if (!group.group_name.trim()) continue
    options.push({
      category_type: 'transport_group',
      category_key: group.group_name,
      label: `Transport: ${group.group_name}`,
    })
  }

  return options
}

function equipmentGroupSubtotal(
  groupName: string,
  technicalOffer: OfferDetail,
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
  technicalOffer: OfferDetail,
): number {
  const normalized = normalizeCategoryKey(categoryKey)
  return (technicalOffer.crew_items ?? [])
    .filter(
      (item) => normalizeCategoryKey(item.role_category ?? '') === normalized,
    )
    .reduce((sum, item) => sum + item.total_price, 0)
}

function transportGroupSubtotal(
  groupName: string,
  technicalOffer: OfferDetail,
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
  technicalOffer: OfferDetail,
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
    jobQuotesById?: Map<string, JobSubcontractorQuote>
    technicalContext?: TechnicalCostContext
  } = {},
): number {
  if (basis.basis_type === 'technical') {
    const technicalOfferId = basis.source_technical_offer_id
    if (!technicalOfferId) return 0
    const technicalOffer = options.technicalOffersById?.get(technicalOfferId)
    if (!technicalOffer) return split.amount
    return calculateTechnicalSplitAmount(
      split,
      technicalOffer,
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
    technicalContext?: TechnicalCostContext
  } = {},
): Array<PrettyOfferPricingBasis> {
  return pricingBases.map((basis) => ({
    ...basis,
    splits: (basis.splits ?? []).map((split) => {
      if (basis.basis_type !== 'technical') return split
      const technicalOfferId = basis.source_technical_offer_id
      if (!technicalOfferId) return split
      const technicalOffer = options.technicalOffersById?.get(technicalOfferId)
      if (!technicalOffer) return split
      return {
        ...split,
        amount: calculateTechnicalSplitAmount(
          split,
          technicalOffer,
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

    if (basis.basis_type === 'technical' && !basis.source_technical_offer_id) {
      issues.push({
        basisId: basis.id,
        message: `Technical basis "${basis.title || 'Untitled'}" must link to a technical offer.`,
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
    const cat = item.role_category
    if (cat && normalizeCategoryKey(cat) === normalizedTitle) {
      suggestions.push({
        module_id: moduleId,
        title: `Crew: ${cat}`,
        amount: 0,
        sort_order: sortOrder++,
        category_type: 'crew_category',
        category_key: cat,
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
    jobQuotesById?: Map<string, JobSubcontractorQuote>
    technicalContext?: TechnicalCostContext
  } = {},
): number {
  return (basis.splits ?? []).reduce(
    (sum, split) => sum + calculateSplitAmount(split, basis, options),
    0,
  )
}
