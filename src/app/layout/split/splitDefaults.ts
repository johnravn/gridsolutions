/**
 * Default left-panel widths (%) for master-detail pages.
 * These match the pre-persistent-layout ratios each page used.
 * Clamped by the shared resize hook (15–75).
 */
export const SPLIT_LEFT_WIDTH = {
  logging: 35,
  latest: 37,
  jobs: 52,
  vehicles: 60,
  customers: 50,
  matters: 55,
  crew: 66.67,
  inventory: 66.67,
} as const

export type SplitPageId = keyof typeof SPLIT_LEFT_WIDTH
