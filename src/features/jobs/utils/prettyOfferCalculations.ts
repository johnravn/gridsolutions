import { calculateOfferTotals } from './offerCalculations'
import type { RentalFactorConfig } from './offerCalculations'
import type {
  OfferDetail,
  PrettyAllocationMode,
  PrettyOfferModule,
  PrettyOfferModuleCategoryMapping,
  PrettyOfferSubcontractorQuote,
} from '../types'

export function normalizeCategoryKey(key: string): string {
  return key.trim().toLowerCase()
}

export function parseManualFieldNumericValue(value: string): number {
  const cleaned = value.replace(/\s/g, '').replace(',', '.')
  const parsed = Number.parseFloat(cleaned)
  return Number.isFinite(parsed) ? parsed : 0
}

export function calculateManualModuleCost(
  module: Pick<PrettyOfferModule, 'manual_fields'>,
): number {
  return (module.manual_fields ?? []).reduce(
    (sum, field) => sum + parseManualFieldNumericValue(field.value),
    0,
  )
}

export function allocationAmountForModule(
  quote: PrettyOfferSubcontractorQuote,
  moduleId: string,
): number {
  const allocation = (quote.allocations ?? []).find(
    (a) => a.module_id === moduleId,
  )
  if (!allocation || allocation.allocation_value <= 0) return 0

  if (allocation.allocation_mode === 'amount') {
    return allocation.allocation_value
  }

  return (quote.total_amount * allocation.allocation_value) / 100
}

export function calculateSubcontractorModuleCost(
  moduleId: string,
  quotes: Array<PrettyOfferSubcontractorQuote>,
): number {
  return quotes.reduce(
    (sum, quote) => sum + allocationAmountForModule(quote, moduleId),
    0,
  )
}

type TechnicalCostContext = {
  technicalOffer: OfferDetail
  mappings: Array<PrettyOfferModuleCategoryMapping>
  rentalFactorConfig?: RentalFactorConfig | null
  vehicleDistanceRate?: number | null
  vehicleDistanceIncrement?: number | null
  vehicleDailyRate?: number | null
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

export function calculateTechnicalModuleCost({
  technicalOffer,
  mappings,
  rentalFactorConfig,
  vehicleDistanceRate,
  vehicleDistanceIncrement,
  vehicleDailyRate,
}: TechnicalCostContext): number {
  if (!mappings.length) return 0

  const equipmentItems = (technicalOffer.groups ?? []).flatMap((g) => g.items)
  const totals = calculateOfferTotals(
    equipmentItems,
    technicalOffer.crew_items ?? [],
    technicalOffer.transport_items ?? [],
    technicalOffer.days_of_use,
    technicalOffer.discount_percent,
    technicalOffer.vat_percent,
    rentalFactorConfig,
    vehicleDistanceRate,
    vehicleDistanceIncrement,
    vehicleDailyRate,
  )

  const rentalFactor = totals.equipmentRentalFactor
  const equipmentSubtotal = totals.equipmentSubtotal
  const discountAmount = totals.discountAmount

  let cost = 0

  for (const mapping of mappings) {
    const key = mapping.category_key
    if (mapping.category_type === 'equipment_group') {
      const groupSubtotal = equipmentGroupSubtotal(
        key,
        technicalOffer,
        rentalFactor,
      )
      const groupDiscount =
        equipmentSubtotal > 0
          ? (groupSubtotal / equipmentSubtotal) * discountAmount
          : 0
      cost += groupSubtotal - groupDiscount
    } else if (mapping.category_type === 'crew_category') {
      cost += crewCategorySubtotal(key, technicalOffer)
    } else if (mapping.category_type === 'transport_group') {
      cost += transportGroupSubtotal(key, technicalOffer)
    }
  }

  return cost
}

export function calculateModuleCost(
  module: PrettyOfferModule,
  quotes: Array<PrettyOfferSubcontractorQuote>,
  technicalOffer: OfferDetail | null,
  technicalContext?: Omit<TechnicalCostContext, 'mappings' | 'technicalOffer'>,
): number {
  if (module.basis_type === 'manual') {
    return calculateManualModuleCost(module)
  }
  if (module.basis_type === 'subcontractor') {
    return calculateSubcontractorModuleCost(module.id, quotes)
  }
  if (module.basis_type === 'technical' && technicalOffer) {
    return calculateTechnicalModuleCost({
      technicalOffer,
      mappings: module.category_mappings ?? [],
      ...technicalContext,
    })
  }
  return 0
}

export type AllocationValidationIssue = {
  quoteId: string
  message: string
}

export function validateSubcontractorAllocations(
  quotes: Array<PrettyOfferSubcontractorQuote>,
): Array<AllocationValidationIssue> {
  const issues: Array<AllocationValidationIssue> = []

  for (const quote of quotes) {
    const allocations = quote.allocations ?? []
    if (allocations.length === 0) continue

    const modes = new Set(allocations.map((a) => a.allocation_mode))
    if (modes.size > 1) {
      issues.push({
        quoteId: quote.id,
        message:
          'All allocations for a quote must use the same mode (percent or amount).',
      })
      continue
    }

    const mode = allocations[0]?.allocation_mode
    const sum = allocations.reduce((acc, a) => acc + a.allocation_value, 0)

    if (mode === 'percent' && Math.abs(sum - 100) > 0.01) {
      issues.push({
        quoteId: quote.id,
        message: `Percent allocations must sum to 100% (currently ${sum.toFixed(2)}%).`,
      })
    }

    if (mode === 'amount' && Math.abs(sum - quote.total_amount) > 0.01) {
      issues.push({
        quoteId: quote.id,
        message: `Amount allocations must sum to quote total (${quote.total_amount}).`,
      })
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

export function suggestCategoryMappingsForModule(
  moduleTitle: string,
  technicalOffer: OfferDetail,
): Array<PrettyOfferModuleCategoryMapping> {
  const normalizedTitle = normalizeCategoryKey(moduleTitle)
  if (!normalizedTitle) return []

  const suggestions: Array<PrettyOfferModuleCategoryMapping> = []

  for (const group of technicalOffer.groups ?? []) {
    if (normalizeCategoryKey(group.group_name) === normalizedTitle) {
      suggestions.push({
        id: `temp-eq-${group.id}`,
        module_id: '',
        category_type: 'equipment_group',
        category_key: group.group_name,
      })
    }
  }

  for (const item of technicalOffer.crew_items ?? []) {
    const cat = item.role_category
    if (cat && normalizeCategoryKey(cat) === normalizedTitle) {
      suggestions.push({
        id: `temp-crew-${item.id}`,
        module_id: '',
        category_type: 'crew_category',
        category_key: cat,
      })
    }
  }

  for (const group of technicalOffer.transport_groups ?? []) {
    if (normalizeCategoryKey(group.group_name) === normalizedTitle) {
      suggestions.push({
        id: `temp-tr-${group.id}`,
        module_id: '',
        category_type: 'transport_group',
        category_key: group.group_name,
      })
    }
  }

  const seen = new Set<string>()
  return suggestions.filter((s) => {
    const key = `${s.category_type}:${normalizeCategoryKey(s.category_key)}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
