import { describe, expect, it } from 'vitest'
import { makeOverlapConflict } from '@test/fixtures/conflicts'
import {
  formatConflictCountLabel,
  formatConflictEntriesSummary,
  formatConflictPeriod,
  formatForceBookingDescription,
  formatGroupOverlapWarning,
  formatItemCapacityWarning,
  formatNamedJob,
  formatPairOverlapLine,
  formatVehicleOverlapWarning,
  joinWithAnd,
  uniqueOverlapJobLabels,
} from './conflictCopy'
import { groupConflictsForDisplay } from './groupConflictsForDisplay'

describe('formatNamedJob', () => {
  it('uses the job title when present', () => {
    expect(formatNamedJob('  Job A  ', true)).toBe('Job A')
  })

  it('labels a missing job as a personal booking', () => {
    expect(formatNamedJob(null, false)).toBe('a personal booking')
    expect(formatNamedJob('', false)).toBe('a personal booking')
  })

  it('labels a job with no title as untitled', () => {
    expect(formatNamedJob(null, true)).toBe('Untitled job')
  })
})

describe('formatConflictPeriod', () => {
  it('hides the end date when both sides are the same day', () => {
    const label = formatConflictPeriod(
      '2026-01-01T08:00:00.000Z',
      '2026-01-01T18:00:00.000Z',
    )
    expect(label).toMatch(/\d{1,2}\. \w+\.? \d{2}:\d{2} – \d{2}:\d{2}/)
    expect(label.match(/–/g)).toHaveLength(1)
  })
})

describe('joinWithAnd', () => {
  it('joins one, two, and many parts', () => {
    expect(joinWithAnd(['a'])).toBe('a')
    expect(joinWithAnd(['a', 'b'])).toBe('a and b')
    expect(joinWithAnd(['a', 'b', 'c'])).toBe('a, b, and c')
  })
})

describe('formatConflictCountLabel', () => {
  it('names groups and items separately', () => {
    expect(formatConflictCountLabel({ groups: 1, items: 2 })).toBe(
      '1 group and 2 items',
    )
  })

  it('falls back when every bucket is empty', () => {
    expect(formatConflictCountLabel({})).toBe('conflicts')
  })
})

describe('formatPairOverlapLine', () => {
  it('names both sides, including a personal booking', () => {
    expect(
      formatPairOverlapLine(
        'Anna',
        {
          job_id_1: 'j1',
          job_id_2: null,
          job_title_1: 'Job A',
          job_title_2: null,
          start_1: 's1',
          end_1: 'e1',
          start_2: 's2',
          end_2: 'e2',
        },
        (start, end) => `${start}–${end}`,
      ),
    ).toBe('Anna overlaps Job A (s1–e1) and a personal booking (s2–e2)')
  })
})

describe('overlap warnings', () => {
  it('names the other jobs a group overlaps', () => {
    const overlaps = [
      makeOverlapConflict({ jobId: 'j2', jobTitle: 'Job B' }),
      makeOverlapConflict({ jobId: 'j3', jobTitle: 'Job C' }),
    ]
    expect(uniqueOverlapJobLabels(overlaps)).toEqual(['Job B', 'Job C'])
    expect(formatGroupOverlapWarning('Vocal package', overlaps)).toBe(
      'Vocal package overlaps Job B and Job C',
    )
    expect(formatVehicleOverlapWarning('Sprinter', overlaps)).toBe(
      'Sprinter overlaps Job B and Job C',
    )
  })

  it('includes overlapping jobs on capacity warnings', () => {
    expect(
      formatItemCapacityWarning({
        itemName: 'SM58',
        newQty: 2,
        existingQty: 3,
        onHand: 2,
        conflicts: [makeOverlapConflict({ jobTitle: 'Job B' })],
      }),
    ).toBe(
      'SM58: booking 2 (3 already reserved), but only 2 available — overlaps Job B',
    )
  })

  it('summarizes grouped and direct entries', () => {
    const entries = groupConflictsForDisplay([
      makeOverlapConflict({
        itemName: 'SM58',
        sourceGroupId: 'g1',
        sourceGroupName: 'Vocal package',
        jobTitle: 'Job B',
      }),
      makeOverlapConflict({ itemName: 'PAR can', jobTitle: 'Job C' }),
    ])
    expect(formatConflictEntriesSummary(entries)).toBe(
      'Vocal package overlaps Job B. PAR can overlaps Job C.',
    )
  })

  it('names jobs in the force-booking description', () => {
    expect(
      formatForceBookingDescription('Equipment booking', [
        makeOverlapConflict({ jobTitle: 'Job B' }),
      ]),
    ).toBe(
      'Equipment booking overlaps Job B. You can force this booking if the overlap is intentional. Forced overlaps appear on the Conflicts page.',
    )
  })
})
