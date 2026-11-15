/**
 * Query-key helpers — prefer company-scoped keys for tenant data so
 * invalidation and DevTools stay consistent across features.
 *
 * Convention:
 * - Company data: `companyKey(companyId, 'resource', …)`
 * - Job-scoped: keep existing `['jobs', …]` / `['job-offers', …]` until a
 *   dedicated migrate pass; do not invent a third dialect for new code.
 */

export function companyKey(
  companyId: string,
  ...parts: Array<string | number | boolean | null | undefined>
) {
  return ['company', companyId, ...parts] as const
}
