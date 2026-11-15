import { describe, expect, it } from 'vitest'
import { requireCompanyId } from './requireCompanyId'

describe('requireCompanyId', () => {
  it('returns a trimmed non-empty id', () => {
    expect(requireCompanyId('  co-1  ')).toBe('co-1')
  })

  it('throws on empty placeholders', () => {
    expect(() => requireCompanyId('')).toThrow(/companyId is required/)
    expect(() => requireCompanyId('   ')).toThrow(/companyId is required/)
  })
})
