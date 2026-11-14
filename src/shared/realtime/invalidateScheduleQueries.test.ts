import { describe, expect, it, vi } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import {
  homeWeekBookingsQueryTouchesJobs,
  invalidateScheduleQueries,
  jobsPayloadChangedScheduleDates,
} from './invalidateScheduleQueries'
import type { Query } from '@tanstack/react-query'

function fakeQuery(queryKey: ReadonlyArray<unknown>): Query {
  return { queryKey } as Query
}

describe('homeWeekBookingsQueryTouchesJobs', () => {
  it('matches only home week-bookings keys for the company that include a job', () => {
    expect(
      homeWeekBookingsQueryTouchesJobs(
        fakeQuery([
          'home',
          'co-1',
          'company-jobs-week-bookings',
          0,
          'job-a,job-b',
        ]),
        'co-1',
        ['job-b'],
      ),
    ).toBe(true)

    expect(
      homeWeekBookingsQueryTouchesJobs(
        fakeQuery([
          'home',
          'co-1',
          'company-jobs-week-bookings',
          0,
          'job-a,job-b',
        ]),
        'co-1',
        ['job-z'],
      ),
    ).toBe(false)

    expect(
      homeWeekBookingsQueryTouchesJobs(
        fakeQuery([
          'home',
          'co-other',
          'company-jobs-week-bookings',
          0,
          'job-a',
        ]),
        'co-1',
        ['job-a'],
      ),
    ).toBe(false)
  })
})

describe('jobsPayloadChangedScheduleDates', () => {
  it('treats insert/delete as schedule-affecting', () => {
    expect(jobsPayloadChangedScheduleDates({ eventType: 'INSERT' })).toBe(true)
    expect(jobsPayloadChangedScheduleDates({ eventType: 'DELETE' })).toBe(true)
  })

  it('detects start/end changes on update', () => {
    expect(
      jobsPayloadChangedScheduleDates({
        eventType: 'UPDATE',
        new: { start_at: 'a', end_at: 'b', title: 'x' },
        old: { start_at: 'a', end_at: 'b', title: 'y' },
      }),
    ).toBe(false)

    expect(
      jobsPayloadChangedScheduleDates({
        eventType: 'UPDATE',
        new: { start_at: 'a2', end_at: 'b' },
        old: { start_at: 'a', end_at: 'b' },
      }),
    ).toBe(true)
  })
})

describe('invalidateScheduleQueries', () => {
  it('invalidates per-job keys and calendars, not company conflict scanners', () => {
    const qc = new QueryClient()
    const spy = vi.spyOn(qc, 'invalidateQueries')

    invalidateScheduleQueries(qc, 'co-1', ['job-1'])

    const keys = spy.mock.calls.map((call) => {
      const arg = call[0] as { queryKey?: ReadonlyArray<unknown> }
      return arg?.queryKey
    })

    expect(keys).toContainEqual(['company', 'co-1', 'calendar'])
    expect(keys).toContainEqual(['conflicts', 'job', 'job-1'])
    expect(keys).toContainEqual(['jobs.equipment', 'job-1'])
    expect(keys).toContainEqual(['jobs.transport', 'job-1'])
    expect(keys).toContainEqual(['jobs.crew', 'job-1'])

    expect(keys).not.toContainEqual(['conflicts', 'crew', 'co-1'])
    expect(keys).not.toContainEqual(['conflicts', 'vehicle', 'co-1'])
    expect(keys).not.toContainEqual(['conflicts', 'equipment', 'co-1'])
    expect(keys).not.toContainEqual(['conflicts', 'job'])
    expect(keys).not.toContainEqual(['jobs', 'crew-role-ids', 'co-1'])
    expect(keys).not.toContainEqual([
      'home',
      'co-1',
      'company-jobs-week-bookings',
    ])

    // Home bookings uses a predicate, not a bare queryKey.
    expect(
      spy.mock.calls.some((call) => {
        const arg = call[0] as { predicate?: unknown; queryKey?: unknown }
        return typeof arg?.predicate === 'function' && arg.queryKey == null
      }),
    ).toBe(true)
  })

  it('skips job-specific and home predicates when job id list is empty', () => {
    const qc = new QueryClient()
    const spy = vi.spyOn(qc, 'invalidateQueries')

    invalidateScheduleQueries(qc, 'co-1', [])

    const keys = spy.mock.calls.map((call) => {
      const arg = call[0] as { queryKey?: ReadonlyArray<unknown> }
      return arg?.queryKey
    })

    expect(keys).toContainEqual(['company', 'co-1', 'calendar'])
    expect(
      spy.mock.calls.every((call) => {
        const arg = call[0] as { predicate?: unknown }
        return typeof arg?.predicate !== 'function'
      }),
    ).toBe(true)
    expect(keys.some((k) => k?.[0] === 'conflicts')).toBe(false)
  })
})
