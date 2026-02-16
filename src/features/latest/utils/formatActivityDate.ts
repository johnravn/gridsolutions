import { format, formatDistanceToNow } from 'date-fns'
import { nb } from 'date-fns/locale'

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000

/**
 * Format activity date: relative time (e.g. "2 days ago") if within 3 days,
 * otherwise absolute date in same format as upcoming jobs: "d. MMM yyyy" with Norwegian locale.
 */
export function formatActivityDate(createdAt: string): string {
  const date = new Date(createdAt)
  const now = Date.now()
  if (now - date.getTime() > THREE_DAYS_MS) {
    return format(date, 'd. MMM yyyy', { locale: nb })
  }
  return formatDistanceToNow(date, { addSuffix: true })
}
