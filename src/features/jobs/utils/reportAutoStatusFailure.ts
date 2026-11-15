const THROTTLE_MS = 5 * 60 * 1000
let lastToastAt = 0

export function autoStatusFailureMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message
  if (typeof err === 'object' && err && 'message' in err) {
    const message = (err as { message?: unknown }).message
    if (typeof message === 'string' && message) return message
  }
  return 'Will retry shortly.'
}

/**
 * Log auto-status failures and optionally toast at most once per throttle window.
 * Keeps the contract visible without spamming the user on every tick.
 */
export function reportAutoStatusFailure(
  context: string,
  err: unknown,
  toast?: (title: string, message: string) => void,
): void {
  const message = autoStatusFailureMessage(err)
  console.error(`[auto-status] ${context}:`, message)
  if (!toast) return
  const now = Date.now()
  if (now - lastToastAt < THROTTLE_MS) return
  lastToastAt = now
  toast('Couldn’t auto-update job status', message)
}

/** Test helper — reset throttle between cases. */
export function resetAutoStatusFailureThrottleForTests(): void {
  lastToastAt = 0
}
