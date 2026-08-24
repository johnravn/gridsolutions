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
})
