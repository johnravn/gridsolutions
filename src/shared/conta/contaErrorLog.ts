/**
 * Collapse Conta sync error lists for persistence + Super Monitor logs.
 * No path aliases — safe for Vercel serverless.
 */

export type ContaErrorTally = {
  message: string
  count: number
}

export type ContaErrorLogEntry = {
  companyId: string
  companyName: string | null
  message: string
  count: number
}

export type ContaCompanyErrorFields = {
  companyId: string
  companyName?: string | null
  errors: Array<string>
  errorEntries?: Array<ContaErrorTally>
  skippedReason?: string
}

export function tallyErrorMessages(
  messages: Array<string>,
): Array<ContaErrorTally> {
  const counts = new Map<string, number>()
  for (const message of messages) {
    const key = message.trim() || 'Unknown error'
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return [...counts.entries()].map(([message, count]) => ({ message, count }))
}

export function companyErrorTotal(row: ContaCompanyErrorFields): number {
  if (row.errorEntries && row.errorEntries.length > 0) {
    return row.errorEntries.reduce((n, entry) => n + entry.count, 0)
  }
  return row.errors.length
}

export function normalizeContaCompanyResultForPersist<
  T extends ContaCompanyErrorFields,
>(row: T): T & { errorEntries: Array<ContaErrorTally>; errors: Array<string> } {
  const errorEntries = tallyErrorMessages(row.errors)
  return {
    ...row,
    errorEntries,
    // Keep unique messages only — full tallies live in errorEntries / errorLog
    errors: errorEntries.map((entry) => entry.message),
  }
}

export function buildContaErrorLog(
  results: Array<ContaCompanyErrorFields>,
): Array<ContaErrorLogEntry> {
  const log: Array<ContaErrorLogEntry> = []
  for (const row of results) {
    const companyName = row.companyName ?? null
    const entries =
      row.errorEntries && row.errorEntries.length > 0
        ? row.errorEntries
        : tallyErrorMessages(row.errors)
    for (const entry of entries) {
      log.push({
        companyId: row.companyId,
        companyName,
        message: entry.message,
        count: entry.count,
      })
    }
    if (row.skippedReason) {
      log.push({
        companyId: row.companyId,
        companyName,
        message: row.skippedReason,
        count: 1,
      })
    }
  }
  return log
}

export function totalContaErrorCount(
  results: Array<ContaCompanyErrorFields>,
): number {
  return results.reduce((n, row) => n + companyErrorTotal(row), 0)
}

export function extractContaErrorLogFromDetails(
  details: Record<string, unknown> | null | undefined,
): Array<ContaErrorLogEntry> {
  if (!details) return []
  const direct = details.errorLog
  if (Array.isArray(direct) && direct.length > 0) {
    return direct.filter((entry): entry is ContaErrorLogEntry =>
      Boolean(
        entry &&
          typeof entry === 'object' &&
          typeof (entry as ContaErrorLogEntry).companyId === 'string' &&
          typeof (entry as ContaErrorLogEntry).message === 'string',
      ),
    )
  }

  // Back-compat: rebuild from results[].errors for older runs
  const results = details.results
  if (!Array.isArray(results)) return []
  return buildContaErrorLog(
    results.map((row) => {
      const r = row as ContaCompanyErrorFields
      return {
        companyId: String(r.companyId ?? ''),
        companyName: r.companyName ?? null,
        errors: Array.isArray(r.errors) ? r.errors.map(String) : [],
        errorEntries: Array.isArray(r.errorEntries)
          ? r.errorEntries
          : undefined,
        skippedReason:
          typeof r.skippedReason === 'string' ? r.skippedReason : undefined,
      }
    }),
  )
}
