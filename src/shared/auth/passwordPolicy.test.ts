import { describe, expect, it } from 'vitest'
import {
  PASSWORD_REQUIREMENTS,
  passwordMeetsRequirements,
  strongPasswordSchema,
} from './passwordPolicy'

describe('passwordPolicy', () => {
  it('rejects weak passwords', () => {
    expect(passwordMeetsRequirements('short')).toBe(false)
    expect(passwordMeetsRequirements('alllowercase1!')).toBe(false)
    expect(passwordMeetsRequirements('ALLUPPERCASE1!')).toBe(false)
    expect(passwordMeetsRequirements('NoNumbersHere!')).toBe(false)
    expect(passwordMeetsRequirements('NoSpecialChar1')).toBe(false)
  })

  it('accepts passwords that meet every requirement', () => {
    expect(passwordMeetsRequirements('ValidPass123!')).toBe(true)
  })

  it('exposes five checklist rules', () => {
    expect(PASSWORD_REQUIREMENTS).toHaveLength(5)
    expect(PASSWORD_REQUIREMENTS.map((r) => r.id)).toEqual([
      'length',
      'lowercase',
      'uppercase',
      'number',
      'special',
    ])
  })

  it('strongPasswordSchema enforces the same contract', () => {
    expect(strongPasswordSchema.safeParse('weak').success).toBe(false)
    expect(strongPasswordSchema.safeParse('ValidPass123!').success).toBe(true)
  })
})
