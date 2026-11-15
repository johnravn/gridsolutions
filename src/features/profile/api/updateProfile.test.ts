import { describe, expect, it } from 'vitest'
import { prefsAsRecord } from './updateProfile'

describe('prefsAsRecord', () => {
  it('returns empty object for null/array/primitive', () => {
    expect(prefsAsRecord(null)).toEqual({})
    expect(prefsAsRecord([])).toEqual({})
    expect(prefsAsRecord('x')).toEqual({})
    expect(prefsAsRecord(1)).toEqual({})
  })

  it('copies object preferences', () => {
    expect(prefsAsRecord({ bible_version: 'NIV' })).toEqual({
      bible_version: 'NIV',
    })
  })
})
