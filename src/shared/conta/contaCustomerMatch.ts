export type ContaCustomerType = 'INDIVIDUAL' | 'ORGANIZATION'

export type ContaMatchReason = 'orgNo' | 'email' | 'name'

export type ContaMatchCustomer = {
  name?: string | null
  email?: string | null
  vat_number?: string | null
}

export type ContaMatchHit = {
  id?: number
  name?: string
  customerName?: string
  orgNo?: string
  emailAddress?: string
  customerType?: ContaCustomerType | string
}

export type ContaMatchScore = {
  score: number
  reasons: Array<ContaMatchReason>
}

const MIN_ORG_NO_LENGTH = 6

export function normalizeOrgNo(value: string | null | undefined): string {
  return (value || '').replace(/\D/g, '').trim()
}

export function isValidOrgNo(orgNo: string): boolean {
  return orgNo.length >= MIN_ORG_NO_LENGTH
}

export function normalizeEmail(value: string | null | undefined): string {
  return (value || '').trim().toLowerCase()
}

export function normalizeName(value: string | null | undefined): string {
  return (value || '').trim().toLowerCase().replace(/\s+/g, ' ')
}

export function hitDisplayName(hit: ContaMatchHit): string {
  return (hit.name ?? hit.customerName ?? '').trim()
}

export function resolveContaCustomerType(
  vatNumber: string | null | undefined,
): ContaCustomerType {
  return isValidOrgNo(normalizeOrgNo(vatNumber)) ? 'ORGANIZATION' : 'INDIVIDUAL'
}

function nameSimilarity(gridName: string, hitName: string): number {
  if (!gridName || !hitName) return 0
  if (gridName === hitName) return 1
  if (gridName.includes(hitName) || hitName.includes(gridName)) return 0.7

  const gridTokens = new Set(gridName.split(' ').filter(Boolean))
  const hitTokens = hitName.split(' ').filter(Boolean)
  if (gridTokens.size === 0 || hitTokens.length === 0) return 0
  const overlap = hitTokens.filter((token) => gridTokens.has(token)).length
  if (overlap === 0) return 0
  if (overlap === hitTokens.length || overlap === gridTokens.size) return 0.5
  return 0.25
}

/**
 * Score a Conta customer against a Grid customer.
 * Exact org-number mismatch (both sides have an org number) scores 0.
 */
export function scoreContaCustomerMatch(
  customer: ContaMatchCustomer,
  hit: ContaMatchHit,
): ContaMatchScore {
  const reasons: Array<ContaMatchReason> = []
  let score = 0

  const gridOrg = normalizeOrgNo(customer.vat_number)
  const hitOrg = normalizeOrgNo(hit.orgNo)
  if (gridOrg && hitOrg && gridOrg !== hitOrg) {
    return { score: 0, reasons: [] }
  }
  if (gridOrg && hitOrg && gridOrg === hitOrg) {
    score += 100
    reasons.push('orgNo')
  }

  const gridEmail = normalizeEmail(customer.email)
  const hitEmail = normalizeEmail(hit.emailAddress)
  if (gridEmail && hitEmail && gridEmail === hitEmail) {
    score += 80
    reasons.push('email')
  }

  const gridName = normalizeName(customer.name)
  const hitName = normalizeName(hitDisplayName(hit))
  const similarity = nameSimilarity(gridName, hitName)
  if (similarity >= 1) {
    score += 60
    reasons.push('name')
  } else if (similarity >= 0.7) {
    score += 40
    reasons.push('name')
  } else if (similarity >= 0.5) {
    score += 20
    reasons.push('name')
  }

  return { score, reasons }
}

export const MIN_CONTA_MATCH_SCORE = 20

export function rankContaCustomerMatches<T extends ContaMatchHit>(
  customer: ContaMatchCustomer,
  hits: Array<T>,
): Array<T & ContaMatchScore> {
  const byId = new Map<number, T & ContaMatchScore>()
  for (const hit of hits) {
    if (!hit.id) continue
    const scored = { ...hit, ...scoreContaCustomerMatch(customer, hit) }
    if (scored.score < MIN_CONTA_MATCH_SCORE) continue
    const existing = byId.get(hit.id)
    if (!existing || scored.score > existing.score) {
      byId.set(hit.id, scored)
    }
  }
  return [...byId.values()].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return hitDisplayName(a).localeCompare(hitDisplayName(b))
  })
}
