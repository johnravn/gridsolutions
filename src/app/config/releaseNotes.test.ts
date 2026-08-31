import { describe, expect, it } from 'vitest'
import {
  APP_VERSION,
  RELEASE_NOTES,
  whatsNewReleaseChannel,
} from './releaseNotes'

describe('RELEASE_NOTES', () => {
  it('version matches APP_VERSION', () => {
    expect(RELEASE_NOTES.version).toBe(APP_VERSION)
  })

  it('has at least one highlight', () => {
    expect(RELEASE_NOTES.highlights.length).toBeGreaterThan(0)
  })
})

describe('whatsNewReleaseChannel', () => {
  it('uses major.minor and ignores patch', () => {
    expect(whatsNewReleaseChannel('1.13.11')).toBe('1.13')
    expect(whatsNewReleaseChannel('1.13.0')).toBe('1.13')
    expect(whatsNewReleaseChannel('2.0.1')).toBe('2.0')
  })
})
