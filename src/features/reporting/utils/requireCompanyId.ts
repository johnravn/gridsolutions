/** Fail loud at the reporting API boundary when company scope is missing. */
export function requireCompanyId(companyId: string): string {
  const trimmed = companyId.trim()
  if (!trimmed) {
    throw new Error('companyId is required for reporting queries')
  }
  return trimmed
}
