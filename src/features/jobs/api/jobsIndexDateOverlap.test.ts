import { describe, expect, it } from 'vitest'
import {
  jobOverlapsDateFilter,
  resolveJobsIndexDateOverlap,
} from './jobsIndexDateOverlap'

describe('resolveJobsIndexDateOverlap', () => {
  it('is none when both ends are empty', () => {
    expect(resolveJobsIndexDateOverlap('', '')).toEqual({ kind: 'none' })
    expect(resolveJobsIndexDateOverlap()).toEqual({ kind: 'none' })
  })

  it('is upcoming when only from is set', () => {
    const overlap = resolveJobsIndexDateOverlap('2026-09-02', '')
    expect(overlap.kind).toBe('upcoming')
    if (overlap.kind === 'upcoming') {
      expect(new Date(overlap.rangeStart).toISOString()).toBe(
        overlap.rangeStart,
      )
    }
  })

  it('is past when only to is set', () => {
    const overlap = resolveJobsIndexDateOverlap('', '2026-09-01')
    expect(overlap.kind).toBe('past')
    if (overlap.kind === 'past') {
      expect(new Date(overlap.rangeEnd).toISOString()).toBe(overlap.rangeEnd)
    }
  })

  it('is bounded when from and to are set', () => {
    const overlap = resolveJobsIndexDateOverlap('2026-09-01', '2026-09-07')
    expect(overlap.kind).toBe('bounded')
    if (overlap.kind === 'bounded') {
      expect(overlap.rangeEnd > overlap.rangeStart).toBe(true)
    }
  })
})

describe('jobOverlapsDateFilter', () => {
  const bounded = resolveJobsIndexDateOverlap('2026-09-07', '2026-09-13')

  it('excludes jobs that ended before the range', () => {
    expect(
      jobOverlapsDateFilter(
        {
          start_at: '2026-09-01T08:00:00.000Z',
          end_at: '2026-09-02T18:00:00.000Z',
        },
        bounded,
      ),
    ).toBe(false)
  })

  it('includes jobs that span the range', () => {
    expect(
      jobOverlapsDateFilter(
        {
          start_at: '2026-09-01T08:00:00.000Z',
          end_at: '2026-09-20T18:00:00.000Z',
        },
        bounded,
      ),
    ).toBe(true)
  })

  it('includes jobs with no end that started before the range', () => {
    expect(
      jobOverlapsDateFilter(
        { start_at: '2026-08-01T08:00:00.000Z', end_at: null },
        bounded,
      ),
    ).toBe(true)
  })

  it('excludes jobs with no start_at', () => {
    expect(
      jobOverlapsDateFilter({ start_at: null, end_at: null }, bounded),
    ).toBe(false)
  })

  it('upcoming includes in-progress jobs that have not ended', () => {
    const upcoming = resolveJobsIndexDateOverlap('2026-09-10', '')
    expect(
      jobOverlapsDateFilter(
        {
          start_at: '2026-09-01T08:00:00.000Z',
          end_at: '2026-09-20T18:00:00.000Z',
        },
        upcoming,
      ),
    ).toBe(true)
  })

  it('upcoming excludes jobs that already ended', () => {
    const upcoming = resolveJobsIndexDateOverlap('2026-09-10', '')
    expect(
      jobOverlapsDateFilter(
        {
          start_at: '2026-09-01T08:00:00.000Z',
          end_at: '2026-09-05T18:00:00.000Z',
        },
        upcoming,
      ),
    ).toBe(false)
  })

  it('past includes jobs that started on or before the end day', () => {
    const past = resolveJobsIndexDateOverlap('', '2026-09-01')
    expect(
      jobOverlapsDateFilter(
        {
          start_at: '2026-08-20T08:00:00.000Z',
          end_at: '2026-08-25T18:00:00.000Z',
        },
        past,
      ),
    ).toBe(true)
  })

  it('past excludes jobs that start after the end day', () => {
    const past = resolveJobsIndexDateOverlap('', '2026-09-01')
    expect(
      jobOverlapsDateFilter(
        {
          start_at: '2026-09-10T08:00:00.000Z',
          end_at: '2026-09-12T18:00:00.000Z',
        },
        past,
      ),
    ).toBe(false)
  })
})
