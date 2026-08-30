import { describe, expect, it } from 'vitest'
import { postgrestIlikePatterns } from './utils'

describe('postgrestIlikePatterns', () => {
  it('adds a compacted pattern so "1 ch" can match "1ch"', () => {
    expect(postgrestIlikePatterns('1 ch')).toEqual(
      expect.arrayContaining(['%1 ch%', '%1ch%', '%1%c%h%']),
    )
  })

  it('skips the compact duplicate when the term has no spaces', () => {
    expect(postgrestIlikePatterns('1ch')).toEqual(
      expect.arrayContaining(['%1ch%', '%1%c%h%']),
    )
  })

  it('adds a single-character wildcard so "share" can match "shure"', () => {
    const patterns = postgrestIlikePatterns('share')
    expect(patterns).toContain('%share%')
    expect(patterns).toContain('%sh_re%')
  })
})
