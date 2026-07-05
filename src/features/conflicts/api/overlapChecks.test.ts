import { describe, expect, it } from 'vitest'
import { dedupeOverlapConflicts } from '@features/conflicts/api/overlapChecks'
import { makeOverlapConflict } from '@test/fixtures/conflicts'

describe('dedupeOverlapConflicts', () => {
  it('returns empty array for empty input', () => {
    expect(dedupeOverlapConflicts([])).toEqual([])
  })

  it('merges overlapping periods for the same item and job', () => {
    const result = dedupeOverlapConflicts([
      makeOverlapConflict({
        startAt: '2026-06-01T08:00:00.000Z',
        endAt: '2026-06-01T12:00:00.000Z',
        quantity: 1,
      }),
      makeOverlapConflict({
        startAt: '2026-06-01T10:00:00.000Z',
        endAt: '2026-06-01T18:00:00.000Z',
        quantity: 2,
      }),
    ])

    expect(result).toHaveLength(1)
    expect(result[0]?.startAt).toBe('2026-06-01T08:00:00.000Z')
    expect(result[0]?.endAt).toBe('2026-06-01T18:00:00.000Z')
    expect(result[0]?.quantity).toBe(2)
  })

  it('keeps non-overlapping periods for the same item and job separate', () => {
    const result = dedupeOverlapConflicts([
      makeOverlapConflict({
        startAt: '2026-06-01T08:00:00.000Z',
        endAt: '2026-06-01T10:00:00.000Z',
      }),
      makeOverlapConflict({
        startAt: '2026-06-01T12:00:00.000Z',
        endAt: '2026-06-01T18:00:00.000Z',
      }),
    ])

    expect(result).toHaveLength(2)
  })

  it('keeps the higher quantity when merging overlapping periods', () => {
    const result = dedupeOverlapConflicts([
      makeOverlapConflict({
        startAt: '2026-06-01T08:00:00.000Z',
        endAt: '2026-06-01T14:00:00.000Z',
        quantity: 5,
      }),
      makeOverlapConflict({
        startAt: '2026-06-01T10:00:00.000Z',
        endAt: '2026-06-01T18:00:00.000Z',
        quantity: 3,
      }),
    ])

    expect(result).toHaveLength(1)
    expect(result[0]?.quantity).toBe(5)
  })

  it('keeps different items separate even when periods overlap', () => {
    const result = dedupeOverlapConflicts([
      makeOverlapConflict({
        itemName: 'Microphone A',
        startAt: '2026-06-01T08:00:00.000Z',
        endAt: '2026-06-01T18:00:00.000Z',
      }),
      makeOverlapConflict({
        itemName: 'Speaker B',
        startAt: '2026-06-01T08:00:00.000Z',
        endAt: '2026-06-01T18:00:00.000Z',
      }),
    ])

    expect(result).toHaveLength(2)
  })

  it('keeps different jobs separate even when periods overlap', () => {
    const result = dedupeOverlapConflicts([
      makeOverlapConflict({
        jobId: '11111111-1111-4111-8111-111111111111',
        jobTitle: 'Job Alpha',
        startAt: '2026-06-01T08:00:00.000Z',
        endAt: '2026-06-01T18:00:00.000Z',
      }),
      makeOverlapConflict({
        jobId: '22222222-2222-4222-8222-222222222222',
        jobTitle: 'Job Beta',
        startAt: '2026-06-01T08:00:00.000Z',
        endAt: '2026-06-01T18:00:00.000Z',
      }),
    ])

    expect(result).toHaveLength(2)
  })

  it('uses jobTitle as key when jobId is missing', () => {
    const result = dedupeOverlapConflicts([
      makeOverlapConflict({
        jobId: undefined,
        jobTitle: 'Same Title Job',
        startAt: '2026-06-01T08:00:00.000Z',
        endAt: '2026-06-01T12:00:00.000Z',
      }),
      makeOverlapConflict({
        jobId: undefined,
        jobTitle: 'Same Title Job',
        startAt: '2026-06-01T11:00:00.000Z',
        endAt: '2026-06-01T18:00:00.000Z',
      }),
    ])

    expect(result).toHaveLength(1)
    expect(result[0]?.startAt).toBe('2026-06-01T08:00:00.000Z')
    expect(result[0]?.endAt).toBe('2026-06-01T18:00:00.000Z')
  })
})
