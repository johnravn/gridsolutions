import { describe, expect, it } from 'vitest'
import { APP_VERSION, RELEASE_NOTES } from './releaseNotes'

describe('RELEASE_NOTES', () => {
  it('version matches APP_VERSION', () => {
    expect(RELEASE_NOTES.version).toBe(APP_VERSION)
  })

  it('has at least one highlight', () => {
    expect(RELEASE_NOTES.highlights.length).toBeGreaterThan(0)
  })
})
