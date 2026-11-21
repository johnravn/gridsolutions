import { describe, expect, it } from 'vitest'
import {
  jobMatchesJobNumberSearch,
  jobNumberSearchHaystacks,
  parseJobsSearchJobNumber,
  stripJobNumberSearchPrefix,
} from './jobNumberSearch'

describe('stripJobNumberSearchPrefix', () => {
  it('strips a leading hash and trims', () => {
    expect(stripJobNumberSearchPrefix('  #000042  ')).toBe('000042')
  })
})

describe('parseJobsSearchJobNumber', () => {
  it('parses plain digits', () => {
    expect(parseJobsSearchJobNumber('42')).toBe(42)
  })

  it('parses hash and zero-padded display forms', () => {
    expect(parseJobsSearchJobNumber('#42')).toBe(42)
    expect(parseJobsSearchJobNumber('000042')).toBe(42)
    expect(parseJobsSearchJobNumber('#000042')).toBe(42)
  })

  it('rejects non-numeric searches', () => {
    expect(parseJobsSearchJobNumber('Acme')).toBeNull()
    expect(parseJobsSearchJobNumber('42 nordic')).toBeNull()
    expect(parseJobsSearchJobNumber('')).toBeNull()
    expect(parseJobsSearchJobNumber('#')).toBeNull()
  })
})

describe('jobNumberSearchHaystacks', () => {
  it('includes raw and padded forms', () => {
    expect(jobNumberSearchHaystacks(42)).toEqual([
      '42',
      '000042',
      '#42',
      '#000042',
    ])
  })

  it('returns empty for null', () => {
    expect(jobNumberSearchHaystacks(null)).toEqual([])
  })
})

describe('jobMatchesJobNumberSearch', () => {
  it('matches exact, padded, and hash forms', () => {
    expect(jobMatchesJobNumberSearch(42, '42')).toBe(true)
    expect(jobMatchesJobNumberSearch(42, '#42')).toBe(true)
    expect(jobMatchesJobNumberSearch(42, '000042')).toBe(true)
    expect(jobMatchesJobNumberSearch(42, '#000042')).toBe(true)
  })

  it('does not match a different number', () => {
    expect(jobMatchesJobNumberSearch(42, '43')).toBe(false)
    expect(jobMatchesJobNumberSearch(null, '42')).toBe(false)
  })
})
