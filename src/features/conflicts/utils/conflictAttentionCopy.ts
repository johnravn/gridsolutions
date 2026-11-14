import { format } from 'date-fns'
import { nb } from 'date-fns/locale'

/** Human-readable attention horizon for empty/loading honesty. */
export function formatConflictAttentionHorizon(
  from: Date | string = new Date(),
): string {
  const date = typeof from === 'string' ? new Date(from) : from
  if (Number.isNaN(date.getTime())) {
    return 'bookings that have not ended yet'
  }
  return `bookings that have not ended yet (from ${format(date, 'd. MMM yyyy HH:mm', { locale: nb })})`
}

export function conflictEmptyStateCopy({
  attentionFrom,
  filtered,
}: {
  attentionFrom: Date | string
  filtered: boolean
}): { title: string; detail: string } {
  const horizon = formatConflictAttentionHorizon(attentionFrom)
  if (filtered) {
    return {
      title: 'No conflicts match these filters.',
      detail: `Still checking ${horizon}. Try All statuses, Forced, or Company scope.`,
    }
  }
  return {
    title: 'No open booking conflicts.',
    detail: `Checked crew, vehicles, equipment, and equipment groups for ${horizon}.`,
  }
}

export function conflictLoadingHint(attentionFrom: Date | string): string {
  return `Checking ${formatConflictAttentionHorizon(attentionFrom)}…`
}
