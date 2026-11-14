import { describe, expect, it } from 'vitest'
import { conflictAttentionBounds } from './conflictAttentionBounds'

describe('conflictAttentionBounds', () => {
  it('returns start-of-minute ISO from and null to', () => {
    const now = new Date('2026-06-15T12:34:56.789Z')
    const bounds = conflictAttentionBounds(now)
    expect(bounds.from).toBe('2026-06-15T12:34:00.000Z')
    expect(bounds.to).toBeNull()
    expect(bounds.attentionNow.toISOString()).toBe('2026-06-15T12:34:00.000Z')
  })
})
