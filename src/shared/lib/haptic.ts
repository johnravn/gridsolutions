/** Light tap feedback on supported mobile devices; no-op elsewhere. */
export function hapticTap(durationMs = 10): void {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate(durationMs)
  }
}
