import { describe, expect, it } from 'vitest'
import {
  makeRecurringJobDetail,
  makeRecurringJobTemplate,
} from '@test/fixtures/recurringJobs'
import {
  applyStartTimeToDate,
  buildJobDefaultsFromRecurringJob,
  buildJobDefaultsFromTemplate,
  formatTemplateStartTimeForInput,
  normalizeTemplateStartTimeForDb,
} from './recurringJobCreateDefaults'
import type { RecurringJobDetail } from '../types'

function makeDetail(
  overrides: Partial<RecurringJobDetail> = {},
): RecurringJobDetail {
  return makeRecurringJobDetail({
    id: 'recurring-1',
    company_id: 'company-1',
    title: 'Theatre Spring 2026',
    description: 'Weekly shows',
    project_lead_user_id: 'lead-1',
    customer_id: 'customer-1',
    customer_contact_id: 'contact-1',
    ...overrides,
  })
}

describe('buildJobDefaultsFromRecurringJob', () => {
  it('uses recurring job metadata when there are no member jobs', () => {
    const defaults = buildJobDefaultsFromRecurringJob(makeDetail())
    expect(defaults.title).toBe('Theatre Spring 2026')
    expect(defaults.description).toBe('Weekly shows')
    expect(defaults.projectLeadUserId).toBe('lead-1')
    expect(defaults.customerId).toBe('customer-1')
    expect(defaults.customerContactId).toBe('contact-1')
    expect(defaults.startAt).toBeUndefined()
  })

  it('copies from the latest member job and suggests the next date', () => {
    const defaults = buildJobDefaultsFromRecurringJob(
      makeDetail({
        job_count: 2,
        jobs: [
          {
            id: 'job-1',
            company_id: 'company-1',
            title: 'Show 1',
            jobnr: 1,
            status: 'completed',
            start_at: '2026-03-01T18:00:00.000Z',
            end_at: '2026-03-01T21:00:00.000Z',
            customer_contact_id: 'contact-1',
            archived: false,
            recurring_job_id: 'recurring-1',
          },
          {
            id: 'job-2',
            company_id: 'company-1',
            title: 'Show 2',
            jobnr: 2,
            status: 'planned',
            start_at: '2026-03-08T18:00:00.000Z',
            end_at: '2026-03-08T21:00:00.000Z',
            customer_contact_id: 'contact-1',
            archived: false,
            recurring_job_id: 'recurring-1',
          },
        ],
      }),
    )

    expect(defaults.title).toBe('Show 2')
    expect(defaults.status).toBe('planned')
    expect(defaults.customerContactId).toBe('contact-1')
    expect(defaults.startAt).toBe('2026-03-09T18:00:00.000Z')
    expect(defaults.endAt).toBe('2026-03-09T21:00:00.000Z')
  })

  it('falls back to planned status for terminal member jobs', () => {
    const defaults = buildJobDefaultsFromRecurringJob(
      makeDetail({
        jobs: [
          {
            id: 'job-1',
            company_id: 'company-1',
            title: 'Final show',
            jobnr: 1,
            status: 'paid',
            start_at: '2026-03-01T18:00:00.000Z',
            end_at: '2026-03-01T21:00:00.000Z',
            customer_contact_id: null,
            archived: false,
            recurring_job_id: 'recurring-1',
          },
        ],
      }),
    )

    expect(defaults.status).toBe('planned')
  })

  it('prefers recurring job standard contact over member job contact', () => {
    const defaults = buildJobDefaultsFromRecurringJob(
      makeDetail({
        customer_contact_id: 'recurring-contact',
        jobs: [
          {
            id: 'job-1',
            company_id: 'company-1',
            title: 'Show 1',
            jobnr: 1,
            status: 'planned',
            start_at: null,
            end_at: null,
            customer_contact_id: 'job-contact',
            archived: false,
            recurring_job_id: 'recurring-1',
          },
        ],
      }),
    )

    expect(defaults.customerContactId).toBe('recurring-contact')
  })

  it('applies template title, status, duration, start time, and crew roles', () => {
    const defaults = buildJobDefaultsFromTemplate(
      makeDetail({
        jobs: [
          {
            id: 'job-1',
            company_id: 'company-1',
            title: 'Show 1',
            jobnr: 1,
            status: 'planned',
            start_at: '2026-03-08T18:00:00.000Z',
            end_at: '2026-03-08T21:00:00.000Z',
            customer_contact_id: null,
            archived: false,
            recurring_job_id: 'recurring-1',
          },
        ],
      }),
      makeRecurringJobTemplate({
        id: 'tpl-1',
        recurring_job_id: 'recurring-1',
        company_id: 'company-1',
        name: 'Evening',
        title: 'Evening show',
        description: 'Stage notes',
        status: 'confirmed',
        duration_hours: 4,
        start_time: '19:30:00',
        crew_roles: [
          { title: 'FOH', needed_count: 1, role_category: 'audio' },
          { title: 'Loader', needed_count: 2, role_category: null },
        ],
        sort_order: 0,
      }),
    )

    expect(defaults.title).toBe('Evening show')
    expect(defaults.fromTemplate).toBe(true)
    expect(defaults.status).toBe('confirmed')
    expect(defaults.description).toBe('Stage notes')
    expect(defaults.crewRoles).toEqual([
      { title: 'FOH', needed_count: 1, role_category: 'audio' },
      { title: 'Loader', needed_count: 2, role_category: null },
    ])

    const start = new Date(defaults.startAt!)
    expect(start.getHours()).toBe(19)
    expect(start.getMinutes()).toBe(30)
    expect(defaults.endAt).toBe(
      new Date(start.getTime() + 4 * 60 * 60 * 1000).toISOString(),
    )
  })
})

describe('template time helpers', () => {
  it('applies start time to an existing date', () => {
    const result = applyStartTimeToDate('2026-03-09T18:00:00.000Z', '19:30:00')
    const date = new Date(result)
    expect(date.getHours()).toBe(19)
    expect(date.getMinutes()).toBe(30)
  })

  it('formats and normalizes template start times', () => {
    expect(formatTemplateStartTimeForInput('19:30:00')).toBe('19:30')
    expect(normalizeTemplateStartTimeForDb('19:30')).toBe('19:30:00')
  })
})
