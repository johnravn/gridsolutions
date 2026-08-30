import { describe, expect, it } from 'vitest'
import {
  copyJobConflictKinds,
  copyJobConflictToastTitle,
  copyJobResultTab,
  formatCopyJobConflictMessage,
  parseCopyJobRpcResult,
} from './copyJobConflicts'
import type { JobBookingConflicts } from '@features/conflicts/api/queries'

const emptyConflicts = (): JobBookingConflicts => ({
  crew: [],
  equipment: [],
  groups: [],
  vehicles: [],
})

describe('copyJobConflictKinds', () => {
  it('returns no kinds when there are no conflicts', () => {
    expect(copyJobConflictKinds(emptyConflicts())).toEqual([])
    expect(copyJobConflictKinds(null)).toEqual([])
  })

  it('lists each booking type that has conflicts', () => {
    expect(
      copyJobConflictKinds({
        crew: [{ user_id: 'u1' } as JobBookingConflicts['crew'][number]],
        equipment: [
          { item_id: 'i1' } as JobBookingConflicts['equipment'][number],
        ],
        groups: [{ group_id_1: 'g1' } as JobBookingConflicts['groups'][number]],
        vehicles: [
          { vehicle_id: 'v1' } as JobBookingConflicts['vehicles'][number],
        ],
      }),
    ).toEqual(['crew', 'equipment', 'groups', 'vehicles'])
  })
})

describe('formatCopyJobConflictMessage', () => {
  it('names a single booking type', () => {
    expect(formatCopyJobConflictMessage(['equipment'])).toBe(
      'There are conflicts on equipment bookings.',
    )
  })

  it('joins two booking types with and', () => {
    expect(formatCopyJobConflictMessage(['equipment', 'vehicles'])).toBe(
      'There are conflicts on equipment and vehicle bookings.',
    )
  })

  it('uses commas for three or more booking types', () => {
    expect(
      formatCopyJobConflictMessage(['equipment', 'groups', 'vehicles']),
    ).toBe('There are conflicts on equipment, group, and vehicle bookings.')
  })

  it('names the copied job when a title is provided', () => {
    expect(formatCopyJobConflictMessage(['vehicles'], 'Better ONS')).toBe(
      'Copying "Better ONS" created conflicts on vehicle bookings.',
    )
  })
})

describe('copyJobConflictToastTitle', () => {
  it('includes the copied job title', () => {
    expect(copyJobConflictToastTitle('Better ONS')).toBe('Copied "Better ONS"')
  })
})

describe('copyJobResultTab', () => {
  it('opens bookings when there are conflicts', () => {
    expect(copyJobResultTab(['vehicles'])).toBe('bookings')
  })

  it('opens overview when there are no conflicts', () => {
    expect(copyJobResultTab([])).toBe('overview')
  })
})

describe('parseCopyJobRpcResult', () => {
  it('reads job_id and conflict kinds from jsonb', () => {
    expect(
      parseCopyJobRpcResult({
        job_id: 'job-1',
        conflicts: ['vehicles', 'equipment', 'nope'],
      }),
    ).toEqual({
      jobId: 'job-1',
      conflicts: ['equipment', 'vehicles'],
    })
  })

  it('accepts a bare uuid from older RPCs', () => {
    expect(parseCopyJobRpcResult('job-1')).toEqual({
      jobId: 'job-1',
      conflicts: [],
    })
  })
})
