import { describe, expect, it } from 'vitest'
import {
  formatDiscountPercentInput,
  optionalDiscountPercentSchema,
  parseOptionalDiscountPercent,
} from './discountPercent'

describe('parseOptionalDiscountPercent', () => {
  it('treats empty as company default (null)', () => {
    expect(parseOptionalDiscountPercent('')).toBeNull()
    expect(parseOptionalDiscountPercent('  ')).toBeNull()
  })

  it('parses 0 as an explicit override', () => {
    expect(parseOptionalDiscountPercent('0')).toBe(0)
  })

  it('clamps values into 0–100', () => {
    expect(parseOptionalDiscountPercent('12.5')).toBe(12.5)
    expect(parseOptionalDiscountPercent('-4')).toBe(0)
    expect(parseOptionalDiscountPercent('150')).toBe(100)
  })
})

describe('optionalDiscountPercentSchema', () => {
  it('accepts empty and in-range values', () => {
    expect(optionalDiscountPercentSchema.safeParse('').success).toBe(true)
    expect(optionalDiscountPercentSchema.safeParse('0').success).toBe(true)
    expect(optionalDiscountPercentSchema.safeParse('100').success).toBe(true)
  })

  it('rejects out of range values', () => {
    expect(optionalDiscountPercentSchema.safeParse('101').success).toBe(false)
    expect(optionalDiscountPercentSchema.safeParse('-1').success).toBe(false)
    expect(optionalDiscountPercentSchema.safeParse('abc').success).toBe(false)
  })
})

describe('formatDiscountPercentInput', () => {
  it('renders empty for nullish and the number otherwise', () => {
    expect(formatDiscountPercentInput(null)).toBe('')
    expect(formatDiscountPercentInput(undefined)).toBe('')
    expect(formatDiscountPercentInput(10)).toBe('10')
  })
})
