import { describe, expect, it } from 'vitest'
import { selectCrewInviteRecipients } from './selectCrewInviteRecipients'

const crew = [
  { user_id: 'me', placeholder_email: null },
  { user_id: 'a', placeholder_email: null },
  { user_id: 'b', placeholder_email: null },
  { user_id: null, placeholder_email: 'temp@example.com' },
  { user_id: null, placeholder_email: null },
]

describe('selectCrewInviteRecipients', () => {
  it('invites other planned people and email placeholders, but not the sender', () => {
    expect(
      selectCrewInviteRecipients({
        crew,
        currentUserId: 'me',
      }),
    ).toEqual({
      userIds: ['a', 'b'],
      placeholderRows: [
        { user_id: null, placeholder_email: 'temp@example.com' },
      ],
    })
  })

  it('limits the send to the people just added', () => {
    expect(
      selectCrewInviteRecipients({
        crew,
        currentUserId: 'me',
        onlyUserIds: ['b'],
      }),
    ).toEqual({
      userIds: ['b'],
      placeholderRows: [],
    })
  })

  it('returns nobody when the only selected person is the sender', () => {
    expect(
      selectCrewInviteRecipients({
        crew,
        currentUserId: 'me',
        onlyUserIds: ['me'],
      }),
    ).toEqual({
      userIds: [],
      placeholderRows: [],
    })
  })
})
