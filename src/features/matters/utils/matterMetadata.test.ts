import { describe, expect, it } from 'vitest'
import { parseActivityId, parseInvitationMessage } from './matterMetadata'

describe('parseInvitationMessage', () => {
  it('returns trimmed invitation text', () => {
    expect(
      parseInvitationMessage({ invitation_message: '  Please join  ' }),
    ).toBe('Please join')
  })

  it('rejects empty, non-string, and non-object metadata', () => {
    expect(parseInvitationMessage(null)).toBeNull()
    expect(parseInvitationMessage({})).toBeNull()
    expect(parseInvitationMessage({ invitation_message: '   ' })).toBeNull()
    expect(parseInvitationMessage({ invitation_message: 12 })).toBeNull()
    expect(parseInvitationMessage([{ invitation_message: 'x' }])).toBeNull()
  })
})

describe('parseActivityId', () => {
  it('returns a non-empty activity id', () => {
    expect(parseActivityId({ activity_id: 'act-1' })).toBe('act-1')
  })

  it('rejects missing or blank ids', () => {
    expect(parseActivityId(null)).toBeNull()
    expect(parseActivityId({ activity_id: '' })).toBeNull()
    expect(parseActivityId({ activity_id: '  ' })).toBeNull()
    expect(parseActivityId({ activity_id: 99 })).toBeNull()
  })
})
