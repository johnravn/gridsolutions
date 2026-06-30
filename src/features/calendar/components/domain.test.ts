import { describe, expect, it } from 'vitest'
import { makeCalendarRecord } from '@test/fixtures/calendar'
import {
  applyCalendarFilter,
  toEventInputs,
  type CalendarFilter,
} from './domain'

describe('toEventInputs', () => {
  it('maps calendar records to FullCalendar event inputs', () => {
    const events = toEventInputs([
      makeCalendarRecord({
        title: 'Gig',
        kind: 'job',
        jobTitle: 'Summer Festival',
      }),
    ])

    expect(events).toHaveLength(1)
    expect(events[0].title).toBe('Gig')
    expect(events[0].extendedProps).toMatchObject({
      kind: 'job',
      jobTitle: 'Summer Festival',
    })
  })
})

describe('applyCalendarFilter', () => {
  const events = toEventInputs([
    makeCalendarRecord({
      id: 'job-1',
      kind: 'job',
      title: 'Festival Job',
      ref: { jobId: 'j1' },
    }),
    makeCalendarRecord({
      id: 'veh-1',
      kind: 'vehicle',
      title: 'Van booking',
      ref: { vehicleId: 'v1' },
    }),
    makeCalendarRecord({
      id: 'item-1',
      kind: 'item',
      title: 'Mic rental',
      ref: { itemIds: ['i1', 'i2'] },
    }),
  ])

  it('returns all events when filter is undefined', () => {
    expect(applyCalendarFilter(events, undefined)).toHaveLength(3)
  })

  it('filters by kind', () => {
    const filter: CalendarFilter = { kinds: ['job'] }
    const result = applyCalendarFilter(events, filter)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('job-1')
  })

  it('filters by job scope', () => {
    const filter: CalendarFilter = { scope: { jobId: 'j1' } }
    expect(applyCalendarFilter(events, filter)).toHaveLength(1)
  })

  it('filters by itemId including itemIds array', () => {
    const filter: CalendarFilter = { scope: { itemId: 'i2' } }
    expect(applyCalendarFilter(events, filter)).toHaveLength(1)
    expect(applyCalendarFilter(events, filter)[0].id).toBe('item-1')
  })

  it('filters by vehicle scope', () => {
    const filter: CalendarFilter = { scope: { vehicleId: 'v1' } }
    expect(applyCalendarFilter(events, filter)).toHaveLength(1)
  })

  it('filters by text search on title', () => {
    const filter: CalendarFilter = { text: 'Festival' }
    const result = applyCalendarFilter(events, filter)
    expect(result.length).toBeGreaterThanOrEqual(1)
    expect(result.some((e) => e.title?.includes('Festival'))).toBe(true)
  })
})
