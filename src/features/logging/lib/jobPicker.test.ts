import { describe, expect, it } from 'vitest'
import {
  buildLoggingJobPickerList,
  jobStartsWithinLoggingWindow,
  loggingJobMatchesSearch,
  loggingSearchTerm,
  type LoggingJobPickerItem,
} from './jobPicker'

function job(
  overrides: Partial<LoggingJobPickerItem> & Pick<LoggingJobPickerItem, 'id'>,
): LoggingJobPickerItem {
  return {
    title: 'Job',
    jobnr: null,
    start_at: '2026-06-15T10:00:00.000Z',
    end_at: '2026-06-15T18:00:00.000Z',
    ...overrides,
  }
}

const now = new Date('2026-08-24T12:00:00.000Z')

describe('loggingSearchTerm', () => {
  it('strips a leading # so job-number searches match', () => {
    expect(loggingSearchTerm(' #12326 ')).toBe('12326')
  })
})

describe('jobStartsWithinLoggingWindow', () => {
  it('includes jobs with no start time', () => {
    expect(jobStartsWithinLoggingWindow(null, now)).toBe(true)
  })

  it('includes past jobs and jobs starting within the next 2 days', () => {
    expect(jobStartsWithinLoggingWindow('2026-01-01T00:00:00.000Z', now)).toBe(
      true,
    )
    expect(jobStartsWithinLoggingWindow('2026-08-26T23:00:00.000Z', now)).toBe(
      true,
    )
  })

  it('excludes jobs that start after the next 2 days', () => {
    expect(jobStartsWithinLoggingWindow('2026-08-27T00:00:00.000Z', now)).toBe(
      false,
    )
  })
})

describe('loggingJobMatchesSearch', () => {
  const logged = job({
    id: 'a',
    title: 'Outdoor concert',
    jobnr: 12326,
    customer: { name: 'Acme' },
  })

  it('matches job number even when the title does not', () => {
    expect(loggingJobMatchesSearch(logged, '12326')).toBe(true)
    expect(loggingJobMatchesSearch(logged, '#12326')).toBe(true)
  })

  it('matches title and customer', () => {
    expect(loggingJobMatchesSearch(logged, 'concert')).toBe(true)
    expect(loggingJobMatchesSearch(logged, 'acme')).toBe(true)
  })
})

describe('buildLoggingJobPickerList', () => {
  it('always includes a previously logged job even when it is outside the date window', () => {
    const previouslyLogged = job({
      id: 'logged',
      title: 'Already logged',
      start_at: '2026-09-01T10:00:00.000Z',
    })
    const result = buildLoggingJobPickerList({
      jobs: [],
      previouslyLoggedJobs: [previouslyLogged],
      search: '',
      now,
    })
    expect(result.map((item) => item.id)).toEqual(['logged'])
  })

  it('puts previously logged jobs first and does not duplicate them', () => {
    const previouslyLogged = job({ id: 'logged', title: 'Logged' })
    const other = job({ id: 'other', title: 'Other' })
    const result = buildLoggingJobPickerList({
      jobs: [previouslyLogged, other],
      previouslyLoggedJobs: [previouslyLogged],
      search: '',
      now,
    })
    expect(result.map((item) => item.id)).toEqual(['logged', 'other'])
  })

  it('keeps a previously logged job when searching by job number', () => {
    const previouslyLogged = job({
      id: 'logged',
      title: 'Stage setup',
      jobnr: 445526,
    })
    const result = buildLoggingJobPickerList({
      jobs: [],
      previouslyLoggedJobs: [previouslyLogged],
      search: '445526',
      now,
    })
    expect(result).toHaveLength(1)
    expect(result[0]?.id).toBe('logged')
  })

  it('caps other jobs without dropping previously logged ones', () => {
    const previouslyLogged = job({ id: 'logged', title: 'Logged' })
    const others = Array.from({ length: 8 }, (_, i) =>
      job({ id: `job-${i}`, title: `Job ${i}` }),
    )
    const result = buildLoggingJobPickerList({
      jobs: others,
      previouslyLoggedJobs: [previouslyLogged],
      search: '',
      now,
      maxOtherJobs: 3,
    })
    expect(result).toHaveLength(4)
    expect(result[0]?.id).toBe('logged')
  })
})
