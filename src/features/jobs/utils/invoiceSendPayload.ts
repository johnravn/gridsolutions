import { acceptedOfferInvoiceLineDescription } from './offerNumber'
import { invoiceLineNet } from './invoiceMoney'
import type {
  BookingInvoiceLine,
  BookingsForInvoice,
} from '../api/invoiceQueries'
import type { JobOffer } from '../types'

/** Build a one-line BookingsForInvoice from an accepted offer for the unified preview. */
export function offerToBookingsForInvoice(offer: JobOffer): BookingsForInvoice {
  const line: BookingInvoiceLine = {
    id: offer.id,
    type: 'equipment',
    description: acceptedOfferInvoiceLineDescription(offer),
    quantity: 1,
    unitPrice: offer.total_after_discount,
    totalPrice: offer.total_after_discount,
    vatPercent: offer.vat_percent,
    timePeriodId: '',
    timePeriodTitle: null,
    startAt: '',
    endAt: '',
  }
  const totalExVat = line.totalPrice
  const totalVat = (totalExVat * offer.vat_percent) / 100
  return {
    equipment: [line],
    crew: [],
    transport: [],
    all: [line],
    totalExVat,
    totalVat,
    totalWithVat: offer.total_with_vat,
  }
}

/** Ex-VAT amount for one line after line discount (matches InvoicePreview). */
export function lineExVatAfterDiscount(
  line: BookingInvoiceLine,
  lineDiscountOverrides: Record<string, number>,
): number {
  const d = lineDiscountOverrides[line.id] ?? 0
  return invoiceLineNet(line, d)
}

/**
 * Snapshot of lines + totals from the invoice preview state. Conta payload is
 * built from this so sent values match the preview tab.
 */
export function buildBookingsForInvoiceSendPayload(
  previewBookings: BookingsForInvoice,
  editedLines: Array<BookingInvoiceLine>,
  lineDiscountOverrides: Record<string, number>,
  vatIncluded: boolean,
): BookingsForInvoice {
  const lines = editedLines.length > 0 ? editedLines : previewBookings.all
  const equipment = lines.filter((l) => l.type === 'equipment')
  const crew = lines.filter((l) => l.type === 'crew')
  const transport = lines.filter((l) => l.type === 'transport')

  let totalExVat = 0
  for (const line of lines) {
    totalExVat += lineExVatAfterDiscount(line, lineDiscountOverrides)
  }
  let totalVat = 0
  if (vatIncluded) {
    for (const line of lines) {
      const ex = lineExVatAfterDiscount(line, lineDiscountOverrides)
      totalVat += (ex * line.vatPercent) / 100
    }
  }
  const totalWithVat = totalExVat + totalVat

  return {
    ...previewBookings,
    equipment,
    crew,
    transport,
    all: lines,
    totalExVat,
    totalVat,
    totalWithVat,
  }
}
