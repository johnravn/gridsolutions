import { describe, expect, it } from 'vitest'
import { makeOfferDetail } from '@test/fixtures/offers'
import { resolvePrettyOfferStatusNotice } from './prettyOfferStatusNotice'

describe('resolvePrettyOfferStatusNotice', () => {
  it('prioritises superseded over other signals', () => {
    const notice = resolvePrettyOfferStatusNotice(
      makeOfferDetail({
        status: 'superseded',
        revision_requested_at: '2026-01-01T00:00:00.000Z',
      }),
    )

    expect(notice?.kind).toBe('superseded')
  })

  it('returns accepted notice with contact details', () => {
    const notice = resolvePrettyOfferStatusNotice(
      makeOfferDetail({
        status: 'accepted',
        accepted_at: '2026-02-01T00:00:00.000Z',
        accepted_by_name: 'Jane Doe',
        accepted_by_phone: '+4791234567',
      }),
    )

    expect(notice?.kind).toBe('accepted')
    expect(notice?.title).toBe('Offer accepted')
    expect(notice?.lines.join(' ')).toContain('Jane Doe')
  })

  it('returns rejected notice with comment', () => {
    const notice = resolvePrettyOfferStatusNotice(
      makeOfferDetail({
        status: 'rejected',
        rejected_at: '2026-02-01T00:00:00.000Z',
        rejection_comment: 'Too expensive',
      }),
    )

    expect(notice?.kind).toBe('rejected')
    expect(notice?.lines.join(' ')).toContain('Too expensive')
  })

  it('returns revision notice when revision was requested', () => {
    const notice = resolvePrettyOfferStatusNotice(
      makeOfferDetail({
        status: 'viewed',
        revision_requested_at: '2026-02-01T00:00:00.000Z',
        revision_comment: 'Add more lighting',
      }),
    )

    expect(notice?.kind).toBe('revision')
    expect(notice?.lines.join(' ')).toContain('Add more lighting')
  })
})
