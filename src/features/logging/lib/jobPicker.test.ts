import { describe, expect, it } from 'vitest'
import {
  buildLoggingJobPickerList,
  buildLoggingJobPickerSections,
  formatJobOption,
  isJobOnToday,
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

const now = new Date(2026, 7, 24, 12, 0, 0)

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
    expect(
      jobStartsWithinLoggingWindow(new Date(2026, 0, 1).toISOString(), now),
    ).toBe(true)
    expect(
      jobStartsWithinLoggingWindow(
        new Date(2026, 7, 26, 23, 0, 0).toISOString(),
        now,
      ),
    ).toBe(true)
  })

  it('excludes jobs that start after the next 2 days', () => {
    expect(
      jobStartsWithinLoggingWindow(
        new Date(2026, 7, 27, 0, 0, 0).toISOString(),
        now,
      ),
    ).toBe(false)
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
      start_at: new Date(2026, 8, 1, 10, 0, 0).toISOString(),
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

  it('includes far-future jobs when searching so they stay findable', () => {
    const future = job({
      id: 'future',
      title: 'Festival load-in',
      start_at: new Date(2026, 10, 1, 10, 0, 0).toISOString(),
    })
    const withoutSearch = buildLoggingJobPickerList({
      jobs: [future],
      previouslyLoggedJobs: [],
      search: '',
      now,
    })
    expect(withoutSearch).toHaveLength(0)

    const withSearch = buildLoggingJobPickerList({
      jobs: [future],
      previouslyLoggedJobs: [],
      search: 'festival',
      now,
    })
    expect(withSearch.map((item) => item.id)).toEqual(['future'])
  })
})

describe('buildLoggingJobPickerSections', () => {
  it('groups today separately from other jobs', () => {
    const todayJob = job({
      id: 'today',
      title: 'Today job',
      start_at: new Date(2026, 7, 24, 9, 0, 0).toISOString(),
      end_at: new Date(2026, 7, 24, 17, 0, 0).toISOString(),
    })
    const pastJob = job({
      id: 'past',
      title: 'Past job',
      start_at: new Date(2026, 7, 20, 9, 0, 0).toISOString(),
    })
    const recent = job({ id: 'logged', title: 'Logged' })
    const sections = buildLoggingJobPickerSections({
      jobs: [todayJob, pastJob],
      previouslyLoggedJobs: [recent],
      search: '',
      now,
    })
    expect(sections.map((s) => s.id)).toEqual(['today', 'recent', 'jobs'])
    expect(sections[0]?.jobs.map((j) => j.id)).toEqual(['today'])
    expect(sections[1]?.jobs.map((j) => j.id)).toEqual(['logged'])
    expect(sections[2]?.jobs.map((j) => j.id)).toEqual(['past'])
  })
})

describe('formatJobOption', () => {
  it('formats number, title, and date', () => {
    expect(
      formatJobOption(
        {
          id: '1',
          title: 'Load-in',
          jobnr: 42,
          start_at: '2026-06-15T12:00:00.000Z',
          end_at: null,
        },
        () => '15. jun 2026',
      ),
    ).toBe('#42 — Load-in (15. jun 2026)')
  })
})

describe('isJobOnToday', () => {
  it('returns true when start is today', () => {
    expect(
      isJobOnToday(
        {
          id: '1',
          title: 'Today',
          jobnr: null,
          start_at: new Date(2026, 5, 15, 10).toISOString(),
          end_at: null,
        },
        new Date(2026, 5, 15, 12),
      ),
    ).toBe(true)
  })

  it('returns false when outside today', () => {
    expect(
      isJobOnToday(
        {
          id: '1',
          title: 'Yesterday',
          jobnr: null,
          start_at: new Date(2026, 5, 14, 10).toISOString(),
          end_at: null,
        },
        new Date(2026, 5, 15, 12),
      ),
    ).toBe(false)
  })
})
