import { describe, expect, it } from 'vitest'
import { DEFAULT_BIBLE_VERSION, normalizeBibleVersion } from './bibleVersion'

describe('normalizeBibleVersion', () => {
  it('accepts bm11, nn11, and msg', () => {
    expect(normalizeBibleVersion('bm11')).toBe('bm11')
    expect(normalizeBibleVersion('nn11')).toBe('nn11')
    expect(normalizeBibleVersion('msg')).toBe('msg')
  })

  it('defaults unknown values to BM11', () => {
    expect(normalizeBibleVersion(undefined)).toBe(DEFAULT_BIBLE_VERSION)
    expect(normalizeBibleVersion('niv')).toBe('bm11')
    expect(normalizeBibleVersion('en')).toBe('bm11')
  })
})
