import { roundMoney } from './offerCalculations'

export { roundMoney }

/** Billed line amount before line discount (øre). */
export function invoiceLineGross(line: {
  totalPrice: number
  unitPrice: number
  quantity: number
}): number {
  if (Number.isFinite(line.totalPrice)) return roundMoney(line.totalPrice)
  return roundMoney(line.unitPrice * line.quantity)
}

/** Billed line amount after line discount (øre). Matches invoice preview. */
export function invoiceLineNet(
  line: { totalPrice: number; unitPrice: number; quantity: number },
  discountPercent: number,
): number {
  const d = discountPercent || 0
  return roundMoney(invoiceLineGross(line) * (1 - d / 100))
}

/** Invoice subtotal vs accepted offer total (ex VAT). 1 øre or more is a mismatch. */
export function offerInvoiceTotalMismatch(
  invoiceExVat: number,
  acceptedOfferExVat: number,
): {
  differs: boolean
  invoiceExVat: number
  offerExVat: number
  delta: number
} {
  const invoice = roundMoney(invoiceExVat)
  const offer = roundMoney(acceptedOfferExVat)
  const delta = roundMoney(invoice - offer)
  return {
    differs: Math.abs(delta) >= 0.01,
    invoiceExVat: invoice,
    offerExVat: offer,
    delta,
  }
}
