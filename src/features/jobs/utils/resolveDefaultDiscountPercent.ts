/**
 * Default discount % for a new offer basis.
 * Precedence: customer override → company partner/customer default → 0.
 */
export function resolveDefaultDiscountPercent({
  customerDiscountPercent,
  isPartner,
  companyCustomerDiscountPercent,
  companyPartnerDiscountPercent,
}: {
  customerDiscountPercent: number | null | undefined
  isPartner: boolean
  companyCustomerDiscountPercent: number | null | undefined
  companyPartnerDiscountPercent: number | null | undefined
}): number {
  if (customerDiscountPercent != null) {
    return Number(customerDiscountPercent)
  }
  if (isPartner && companyPartnerDiscountPercent != null) {
    return Number(companyPartnerDiscountPercent)
  }
  if (!isPartner && companyCustomerDiscountPercent != null) {
    return Number(companyCustomerDiscountPercent)
  }
  return 0
}
