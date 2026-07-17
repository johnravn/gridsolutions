/**
 * Viewport height minus app chrome (top bar + main scroll padding).
 * Uses `--app-split-height` so mobile cards match the desktop split shell.
 * Backed by svh (not dvh) — dvh shifts with the iOS URL bar / visual viewport
 * when the nav drawer opens, which made page cards look vertically off.
 */
export const MOBILE_CARD_HEIGHT = 'var(--app-split-height)'
