import { z } from 'zod'

export const optionalDiscountPercentSchema = z.string().refine((value) => {
  const trimmed = value.trim()
  if (trimmed === '') return true
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 100
}, 'Must be between 0 and 100')

export function parseOptionalDiscountPercent(value: string): number | null {
  const trimmed = value.trim()
  if (trimmed === '') return null
  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed)) return null
  return Math.max(0, Math.min(100, parsed))
}

export function formatDiscountPercentInput(
  value: number | null | undefined,
): string {
  if (value == null) return ''
  return String(value)
}
