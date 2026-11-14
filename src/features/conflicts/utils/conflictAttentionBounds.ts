import { startOfMinute } from 'date-fns'

/**
 * Attention window for company conflict RPCs: bookings that have not
 * fully ended yet (`end_at >= from`), with no upper bound (`to` null).
 * Matches client `keepAttention*` filters; avoid null `from` (full history).
 */
export function conflictAttentionBounds(now: Date = new Date()): {
  from: string
  to: null
  attentionNow: Date
} {
  const attentionNow = startOfMinute(now)
  return {
    from: attentionNow.toISOString(),
    to: null,
    attentionNow,
  }
}
