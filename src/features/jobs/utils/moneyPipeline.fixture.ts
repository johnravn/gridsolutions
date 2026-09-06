import {
  calculateOfferTotals,
  calculateRentalFactor,
  equipmentLineTotal,
  roundMoney,
} from './offerCalculations'

/** Shared NOK formatter used by Totals / Offers tab / public offer / InvoicePreview. */
export function formatOfferMoney(amount: number): string {
  return new Intl.NumberFormat('nb-NO', {
    style: 'currency',
    currency: 'NOK',
    minimumFractionDigits: 2,
  }).format(amount)
}

/**
 * Deterministic equipment-only money scenario for pipeline tests.
 * Days 3 → default rental factor 2.0.
 */
export const MONEY_PIPELINE = {
  daysOfUse: 3,
  dailyUnitPrice: 1000,
  quantity: 1,
  discountPercent: 10,
  vatPercent: 25,
  customLineDescription: 'E2E money pipeline mic',
  equipmentGroupName: 'E2E Money Equipment',
  equipmentItemId: 'money-pipeline-eq-1',
  offerId: 'money-pipeline-offer-1',
  jobId: 'money-pipeline-job-1',
  /** Matches scripts/seed-test-users.mjs TEST_CONTA_CUSTOMER.name */
  contaCustomerName: 'E2E Conta Customer',
} as const

/** Pretty TotalsSection uses whole kroner (no decimals). */
export function formatOfferMoneyWhole(amount: number): string {
  return new Intl.NumberFormat('nb-NO', {
    style: 'currency',
    currency: 'NOK',
    maximumFractionDigits: 0,
  }).format(amount)
}

const rentalFactor = calculateRentalFactor(MONEY_PIPELINE.daysOfUse)
const equipmentLineTotalPrice = equipmentLineTotal(
  MONEY_PIPELINE.dailyUnitPrice,
  MONEY_PIPELINE.quantity,
  rentalFactor,
)
const equipmentSubtotal = equipmentLineTotalPrice
const discountAmount = roundMoney(
  (equipmentSubtotal * MONEY_PIPELINE.discountPercent) / 100,
)
const totalAfterDiscount = roundMoney(equipmentSubtotal - discountAmount)
const vatAmount = roundMoney(
  (totalAfterDiscount * MONEY_PIPELINE.vatPercent) / 100,
)
const totalWithVat = roundMoney(totalAfterDiscount + vatAmount)

/** Invoice expanded-line unit = stored total ÷ qty (factor baked in). */
const expandedUnitPrice = roundMoney(
  equipmentLineTotalPrice / MONEY_PIPELINE.quantity,
)

export const moneyPipelineExpected = {
  rentalFactor,
  equipmentLineTotalPrice,
  equipmentSubtotal,
  crewSubtotal: 0,
  transportSubtotal: 0,
  totalBeforeDiscount: equipmentSubtotal,
  discountAmount,
  totalAfterDiscount,
  vatAmount,
  totalWithVat,
  /** Per-line fields after offerLinesToBookings (pre-discount). */
  expandedLine: {
    id: MONEY_PIPELINE.equipmentItemId,
    quantity: MONEY_PIPELINE.quantity,
    unitPrice: expandedUnitPrice,
    totalPrice: equipmentLineTotalPrice,
    discountPercent: MONEY_PIPELINE.discountPercent,
    netAfterDiscount: totalAfterDiscount,
  },
  ui: {
    equipmentSubtotal: formatOfferMoney(equipmentSubtotal),
    totalBeforeDiscount: formatOfferMoney(equipmentSubtotal),
    totalAfterDiscount: formatOfferMoney(totalAfterDiscount),
    totalWithVat: formatOfferMoney(totalWithVat),
    vatAmount: formatOfferMoney(vatAmount),
  },
} as const

/** Sanity: fixture matches calculateOfferTotals for the same inputs. */
export function moneyPipelineOfferEquipmentItem() {
  return {
    id: MONEY_PIPELINE.equipmentItemId,
    unit_price: MONEY_PIPELINE.dailyUnitPrice,
    quantity: MONEY_PIPELINE.quantity,
    total_price: moneyPipelineExpected.equipmentLineTotalPrice,
    custom_line_description: MONEY_PIPELINE.customLineDescription,
    custom_line_brand: null,
    custom_line_model: null,
    item: null,
    group: null,
    time_period_id: null,
    is_internal: true,
    sort_order: 0,
    offer_group_id: 'money-pipeline-group-1',
  }
}

export function moneyPipelineCalculateOfferTotals() {
  return calculateOfferTotals(
    [
      {
        ...moneyPipelineOfferEquipmentItem(),
      } as Parameters<typeof calculateOfferTotals>[0][number],
    ],
    [],
    [],
    MONEY_PIPELINE.daysOfUse,
    MONEY_PIPELINE.discountPercent,
    MONEY_PIPELINE.vatPercent,
  )
}
