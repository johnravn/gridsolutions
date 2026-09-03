import { describe, expect, it } from 'vitest'
import { resolveMatterCardAuthor } from './matterAuthor'

const person = {
  user_id: 'user-1',
  display_name: 'Ada Lovelace',
  email: 'ada@example.com',
  avatar_url: 'ada.png',
}

describe('resolveMatterCardAuthor', () => {
  it('shows the company — not the technical creator — for company-sent matters', () => {
    expect(
      resolveMatterCardAuthor({
        created_as_company: true,
        created_by: person,
        company: { id: 'co-1', name: 'Nordic Grid' },
      }),
    ).toEqual({
      kind: 'company',
      name: 'Nordic Grid',
      avatarPath: null,
      userId: null,
      email: '',
    })
  })

  it('shows the sender for personally created matters', () => {
    expect(
      resolveMatterCardAuthor({
        created_as_company: false,
        created_by: person,
        company: { id: 'co-1', name: 'Nordic Grid' },
      }),
    ).toEqual({
      kind: 'person',
      name: 'Ada Lovelace',
      avatarPath: 'ada.png',
      userId: 'user-1',
      email: 'ada@example.com',
    })
  })

  it('falls back to email when the sender has no display name', () => {
    expect(
      resolveMatterCardAuthor({
        created_by: { ...person, display_name: null },
      }),
    ).toMatchObject({
      kind: 'person',
      name: 'ada@example.com',
    })
  })

  it('returns null when there is no displayable author', () => {
    expect(
      resolveMatterCardAuthor({
        created_as_company: true,
        created_by: null,
        company: null,
      }),
    ).toBeNull()
  })

  it('shows the answering crew member for crew-response updates', () => {
    expect(
      resolveMatterCardAuthor({
        created_as_company: true,
        created_by: person,
        company: { id: 'co-1', name: 'Nordic Grid' },
        answered_by: {
          user_id: 'crew-1',
          display_name: 'Jane Doe',
          email: 'jane@example.com',
          avatar_url: 'jane.png',
        },
        metadata: {
          source_crew_invite_matter_id: 'invite-1',
          answered_by_user_id: 'crew-1',
          recipient_status: 'accepted',
        },
      }),
    ).toEqual({
      kind: 'person',
      name: 'Jane Doe',
      avatarPath: 'jane.png',
      userId: 'crew-1',
      email: 'jane@example.com',
    })
  })

  it('falls back to the company when the answering crew member is missing', () => {
    expect(
      resolveMatterCardAuthor({
        created_as_company: true,
        created_by: person,
        company: { id: 'co-1', name: 'Nordic Grid' },
        answered_by: null,
        metadata: {
          source_crew_invite_matter_id: 'invite-1',
          answered_by_user_id: 'crew-1',
          recipient_status: 'declined',
        },
      }),
    ).toMatchObject({
      kind: 'company',
      name: 'Nordic Grid',
    })
  })

  it('shows the customer name for offer accepted and declined updates', () => {
    expect(
      resolveMatterCardAuthor({
        created_as_company: true,
        created_by: person,
        company: { id: 'co-1', name: 'Nordic Grid' },
        metadata: {
          offer_id: 'offer-1',
          accepted_at: '2026-09-01T00:00:00Z',
          accepted_by_name: 'Alex Customer',
        },
      }),
    ).toEqual({
      kind: 'person',
      name: 'Alex Customer',
      avatarPath: null,
      userId: null,
      email: '',
    })
    expect(
      resolveMatterCardAuthor({
        created_as_company: true,
        created_by: person,
        company: { id: 'co-1', name: 'Nordic Grid' },
        metadata: {
          offer_id: 'offer-2',
          rejected_at: '2026-09-01T00:00:00Z',
          rejected_by_name: 'Sam Client',
        },
      }),
    ).toMatchObject({
      kind: 'person',
      name: 'Sam Client',
    })
  })
})
