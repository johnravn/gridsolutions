/** Display label for an offer basis on a job (e.g. "Basis v1"). */
export function formatBasisVersionLabel(basisVersion: number): string {
  return `Basis v${basisVersion}`
}

/** Display version for an offer on a basis (e.g. "v1.2"). */
export function formatOfferVersionOnBasis(
  basisVersion: number,
  offerSubVersion: number,
): string {
  return `v${basisVersion}.${offerSubVersion}`
}

/** Map basis id → 1-based version (oldest basis on the job is v1). */
export function buildBasisVersionById(
  bases: Array<{ id: string; created_at: string }>,
): Map<string, number> {
  const sorted = [...bases].sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  )
  const map = new Map<string, number>()
  sorted.forEach((basis, index) => {
    map.set(basis.id, index + 1)
  })
  return map
}

/** Highest basis version that has at least one locked offer (0 if none). */
export function getMaxLockedBasisVersion(
  bases: Array<{
    id: string
    offers: Array<{ locked: boolean }>
  }>,
  basisVersionById: Map<string, number>,
): number {
  let max = 0
  for (const basis of bases) {
    if (!basis.offers.some((offer) => offer.locked)) continue
    const version = basisVersionById.get(basis.id) ?? 1
    if (version > max) max = version
  }
  return max
}

/** Map offer id → 1-based sub-version within its basis. */
export function buildOfferSubVersionById(
  offers: Array<{
    id: string
    version_number: number
    created_at: string
  }>,
): Map<string, number> {
  const sorted = [...offers].sort((a, b) => {
    if (a.version_number !== b.version_number) {
      return a.version_number - b.version_number
    }
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  })
  const map = new Map<string, number>()
  sorted.forEach((offer, index) => {
    map.set(offer.id, index + 1)
  })
  return map
}

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
