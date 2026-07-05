import { describe, expect, it } from 'vitest'
import {
  formatEquipmentConflictJobs,
  mergeEquipmentConflicts,
} from '@features/conflicts/utils/mergeEquipmentConflicts'
import type { EquipmentConflictRow } from '@features/conflicts/api/queries'

describe('mergeEquipmentConflicts', () => {
  const base: EquipmentConflictRow = {
    item_id: 'item-1',
    item_name: 'Mixer',
    capacity: 1,
    total_reserved: 2,
    start_at: '2026-06-01T10:00:00Z',
    end_at: '2026-06-01T12:00:00Z',
    job_ids: ['job-a', 'job-b'],
    job_titles: ['Job A', 'Job B'],
    has_forced: false,
  }

  it('merges duplicate rows for the same item and job set', () => {
    const duplicate: EquipmentConflictRow = {
      ...base,
      start_at: '2026-06-01T10:00:00Z',
      end_at: '2026-06-01T18:00:00Z',
    }

    const merged = mergeEquipmentConflicts([base, duplicate])
    expect(merged).toHaveLength(1)
    expect(merged[0]?.start_at).toBe('2026-06-01T10:00:00Z')
    expect(merged[0]?.end_at).toBe('2026-06-01T18:00:00Z')
  })

  it('keeps separate clusters when job sets differ', () => {
    const otherJobs: EquipmentConflictRow = {
      ...base,
      job_ids: ['job-a', 'job-c'],
      job_titles: ['Job A', 'Job C'],
    }

    const merged = mergeEquipmentConflicts([base, otherJobs])
    expect(merged).toHaveLength(2)
  })

  it('keeps separate clusters when time windows do not overlap', () => {
    const later: EquipmentConflictRow = {
      ...base,
      start_at: '2026-06-10T10:00:00Z',
      end_at: '2026-06-10T12:00:00Z',
    }

    const merged = mergeEquipmentConflicts([base, later])
    expect(merged).toHaveLength(2)
  })
})

describe('formatEquipmentConflictJobs', () => {
  it('joins job titles with and', () => {
    expect(
      formatEquipmentConflictJobs({
        item_id: 'i1',
        item_name: 'Mixer',
        capacity: 1,
        total_reserved: 2,
        start_at: '2026-06-01T10:00:00Z',
        end_at: '2026-06-01T12:00:00Z',
        job_ids: ['j1', 'j2'],
        job_titles: ['Alpha', 'Beta'],
        has_forced: false,
      }),
    ).toBe('Alpha and Beta')
  })
})
