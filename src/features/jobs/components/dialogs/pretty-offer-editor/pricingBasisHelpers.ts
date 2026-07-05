import type { JobSubcontractorQuote } from '../../../types'
import type { JobSubcontractorRow } from '../../../api/subcontractorQueries'
import type { LocalPricingBasis } from './types'

const DELETE_ICON_SIZE = 18

export { DELETE_ICON_SIZE }

export function getLatestQuoteBySubcontractorId(
  quotes: Array<JobSubcontractorQuote>,
): Map<string, JobSubcontractorQuote> {
  const map = new Map<string, JobSubcontractorQuote>()
  for (const quote of quotes) {
    const existing = map.get(quote.job_subcontractor_id)
    if (!existing || quote.version_number > existing.version_number) {
      map.set(quote.job_subcontractor_id, quote)
    }
  }
  return map
}

export function resolveSubcontractorIdForBasis(
  basis: LocalPricingBasis,
  quotes: Array<JobSubcontractorQuote>,
  subcontractors: Array<JobSubcontractorRow>,
): string | null {
  if (basis.source_job_subcontractor_id) {
    return basis.source_job_subcontractor_id
  }
  if (basis.job_subcontractor_quote_id) {
    const quote = quotes.find((q) => q.id === basis.job_subcontractor_quote_id)
    if (quote) return quote.job_subcontractor_id
  }
  const byName = subcontractors.find((sub) => sub.customer.name === basis.title)
  return byName?.id ?? null
}

export function quotesForSubcontractor(
  quotes: Array<JobSubcontractorQuote>,
  subcontractorId: string | null,
): Array<JobSubcontractorQuote> {
  if (!subcontractorId) return quotes
  return quotes
    .filter((quote) => quote.job_subcontractor_id === subcontractorId)
    .sort((a, b) => b.version_number - a.version_number)
}

export function subcontractorIdsWithBasis(
  bases: Array<LocalPricingBasis>,
  quotes: Array<JobSubcontractorQuote>,
  subcontractors: Array<JobSubcontractorRow>,
): Set<string> {
  const ids = new Set<string>()
  for (const basis of bases) {
    if (basis.basis_type !== 'subcontractor') continue
    const subId = resolveSubcontractorIdForBasis(basis, quotes, subcontractors)
    if (subId) ids.add(subId)
  }
  return ids
}

export const SPLITS_INFO_TOOLTIP =
  'Each split assigns part of a subcontractor quote to a module. The amounts must add up to the full quote total so each module shows the correct subcontractor cost.'

export function splitTitleLabel(
  basisType: LocalPricingBasis['basis_type'],
): string {
  if (basisType === 'subcontractor') {
    return 'What this share covers'
  }
  if (basisType === 'technical') {
    return 'Category'
  }
  return 'Split description'
}

export function splitTitlePlaceholder(
  basisType: LocalPricingBasis['basis_type'],
): string {
  if (basisType === 'subcontractor') {
    return 'e.g. Rigging labour on stage module'
  }
  return 'Describe this cost share'
}
