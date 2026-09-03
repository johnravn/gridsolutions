import { describe, expect, it } from 'vitest'
import {
  crewInviteAnswerUserIds,
  parseCrewInviteAnswerMeta,
  parseMatterOutcome,
} from './crewInviteAnswer'

const validMeta = {
  source_crew_invite_matter_id: 'invite-1',
  answered_by_user_id: 'user-9',
  recipient_status: 'accepted',
}

describe('parseCrewInviteAnswerMeta', () => {
  it('parses accepted and declined crew-response updates', () => {
    expect(parseCrewInviteAnswerMeta(validMeta)).toEqual(validMeta)
    expect(
      parseCrewInviteAnswerMeta({
        ...validMeta,
        recipient_status: 'declined',
      }),
    ).toMatchObject({ recipient_status: 'declined' })
  })

  it('returns null for missing or invalid metadata', () => {
    expect(parseCrewInviteAnswerMeta(null)).toBeNull()
    expect(parseCrewInviteAnswerMeta({})).toBeNull()
    expect(
      parseCrewInviteAnswerMeta({
        ...validMeta,
        recipient_status: 'viewed',
      }),
    ).toBeNull()
    expect(
      parseCrewInviteAnswerMeta({
        ...validMeta,
        answered_by_user_id: '',
      }),
    ).toBeNull()
  })
})

describe('crewInviteAnswerUserIds', () => {
  it('collects unique answering user ids', () => {
    expect(
      crewInviteAnswerUserIds([
        { metadata: validMeta },
        { metadata: { ...validMeta, answered_by_user_id: 'user-2' } },
        { metadata: validMeta },
        { metadata: { title: 'plain update' } },
      ]),
    ).toEqual(['user-9', 'user-2'])
  })
})

describe('parseMatterOutcome', () => {
  it('parses crew invite answers', () => {
    expect(parseMatterOutcome(validMeta)).toEqual({
      kind: 'crew_invite',
      status: 'accepted',
      answeredByUserId: 'user-9',
      answeredByName: null,
    })
  })

  it('parses offer accepted and rejected as declined', () => {
    expect(
      parseMatterOutcome({
        offer_id: 'offer-1',
        accepted_at: '2026-09-01T00:00:00Z',
        accepted_by_name: 'Alex Customer',
      }),
    ).toEqual({
      kind: 'offer',
      status: 'accepted',
      answeredByUserId: null,
      answeredByName: 'Alex Customer',
    })
    expect(
      parseMatterOutcome({
        offer_id: 'offer-2',
        rejected_at: '2026-09-01T00:00:00Z',
        rejected_by_name: 'Alex Customer',
      }),
    ).toEqual({
      kind: 'offer',
      status: 'declined',
      answeredByUserId: null,
      answeredByName: 'Alex Customer',
    })
  })

  it('does not treat offer revision requests as accept/decline', () => {
    expect(
      parseMatterOutcome({
        offer_id: 'offer-3',
        revision_requested_at: '2026-09-01T00:00:00Z',
        revision_requested_by_name: 'Alex Customer',
      }),
    ).toBeNull()
  })
})
