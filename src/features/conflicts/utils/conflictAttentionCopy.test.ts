import { describe, expect, it } from 'vitest'
import {
  conflictEmptyStateCopy,
  conflictLoadingHint,
  formatConflictAttentionHorizon,
} from './conflictAttentionCopy'

describe('conflictAttentionCopy', () => {
  it('describes the attention horizon', () => {
    expect(
      formatConflictAttentionHorizon(new Date('2026-11-14T10:00:00.000Z')),
    ).toMatch(/bookings that have not ended yet \(from /)
  })

  it('explains empty vs filtered empty', () => {
    const empty = conflictEmptyStateCopy({
      attentionFrom: new Date('2026-11-14T10:00:00.000Z'),
      filtered: false,
    })
    expect(empty.title).toBe('No open booking conflicts.')
    expect(empty.detail).toMatch(/crew, vehicles, equipment/)

    const filtered = conflictEmptyStateCopy({
      attentionFrom: new Date('2026-11-14T10:00:00.000Z'),
      filtered: true,
    })
    expect(filtered.title).toBe('No conflicts match these filters.')
    expect(conflictLoadingHint(new Date('2026-11-14T10:00:00.000Z'))).toMatch(
      /^Checking /,
    )
  })
})
