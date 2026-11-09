import type { OfferStatus, PublicOfferAlternative } from '../types'

/** Customer-facing tab label for a basis sub-version (e.g. Alternative 3). */
export function formatOfferAlternativeLabel(subVersion: number): string {
  return `Alternative ${subVersion}`
}

/**
 * Pick which alternative to show first on the public page.
 * Prefer accepted, else highest active (sent/viewed), else highest included.
 */
export function pickDefaultPublicOfferId(
  alternatives: Array<
    Pick<PublicOfferAlternative, 'sub_version' | 'status' | 'offer'>
  >,
): string | null {
  if (alternatives.length === 0) return null

  const bySubDesc = [...alternatives].sort(
    (a, b) => b.sub_version - a.sub_version,
  )

  const accepted = bySubDesc.find((alt) => alt.status === 'accepted')
  if (accepted) return accepted.offer.id

  const active = bySubDesc.find((alt) =>
    (['sent', 'viewed'] as Array<OfferStatus>).includes(alt.status),
  )
  if (active) return active.offer.id

  return bySubDesc[0]?.offer.id ?? null
}
