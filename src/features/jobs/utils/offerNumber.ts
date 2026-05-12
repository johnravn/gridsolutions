/** Display like job numbers: six digits with # prefix (e.g. #001234). */
export function formatOfferNumberDisplay(
  offernr: number | null | undefined,
): string | null {
  if (offernr == null) return null
  return `#${String(offernr).padStart(6, '0')}`
}

/** Strip legacy auto-title suffixes so invoice lines stay readable. */
export function sanitizeOfferTitleForInvoiceLine(
  title: string | null | undefined,
): string | undefined {
  if (!title?.trim()) return undefined
  const cleaned = title.replace(/\s*\(bookings\)\s*$/i, '').trim()
  return cleaned || undefined
}

/** Single invoice line text for an accepted offer (Conta line description). */
export function acceptedOfferInvoiceLineDescription(offer: {
  offernr?: number | null
  version_number: number
  title?: string | null
}): string {
  const num = formatOfferNumberDisplay(offer.offernr)
  const ref = num ?? `v${offer.version_number}`
  const base = num ? `Offer ${num}` : `Offer ${ref}`
  const extra = sanitizeOfferTitleForInvoiceLine(offer.title)
  const trivial =
    !extra ||
    extra === base ||
    extra.toLowerCase() === 'offer' ||
    extra.toLowerCase() === 'offer based on bookings'
  if (!trivial) return `${base} — ${extra}`
  return base
}
