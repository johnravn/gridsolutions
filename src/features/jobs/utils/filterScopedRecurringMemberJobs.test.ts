import { describe, expect, it } from 'vitest'
import { ACTIVE_STATUS_FILTER } from '../components/JobsFilter'
import { filterScopedRecurringMemberJobs } from './filterScopedRecurringMemberJobs'
import type { JobListRow } from '../types'

function job(overrides: Partial<JobListRow> & Pick<JobListRow, 'id'>): JobListRow {
  return {
    company_id: 'c1',
    title: 'Job',
    jobnr: null,
    status: 'planned',
    start_at: '2026-06-01T10:00:00Z',
    end_at: '2026-06-01T18:00:00Z',
    customer_contact_id: null,
    archived: false,
    recurring_job_id: 'rj1',
    ...overrides,
  } as JobListRow
}

describe('filterScopedRecurringMemberJobs', () => {
  const jobs = [
    job({ id: '1', title: 'Active planned', status: 'planned' }),
    job({ id: '2', title: 'Paid show', status: 'paid' }),
    job({ id: '3', title: 'Canceled', status: 'canceled' }),
    job({ id: '4', title: 'Invoiced', status: 'invoiced' }),
    job({
      id: '5',
      title: 'Archived draft',
      status: 'draft',
      archived: true,
    }),
    job({
      id: '6',
      title: 'Completed lead',
      status: 'completed',
      project_lead: {
        user_id: 'u1',
        display_name: 'Lead',
        email: 'lead@example.com',
        avatar_url: null,
      },
    }),
  ]

  it('applies the default active status filter and hides archived', () => {
    const result = filterScopedRecurringMemberJobs(jobs, {
      statusFilter: [...ACTIVE_STATUS_FILTER],
    })
    expect(result.map((j) => j.id)).toEqual(['1', '6'])
  })

  it('can show only archived jobs', () => {
    const result = filterScopedRecurringMemberJobs(jobs, {
      statusFilter: [...ACTIVE_STATUS_FILTER],
      showOnlyArchived: true,
    })
    expect(result.map((j) => j.id)).toEqual(['5'])
  })

  it('supports ready-to-invoice: completed + project lead', () => {
    const result = filterScopedRecurringMemberJobs(jobs, {
      readyToInvoiceFilter: true,
      projectLeadUserId: 'u1',
    })
    expect(result.map((j) => j.id)).toEqual(['6'])
  })

  it('filters by search and onlyJobIds', () => {
    const result = filterScopedRecurringMemberJobs(jobs, {
      statusFilter: [...ACTIVE_STATUS_FILTER],
      search: 'active',
      onlyJobIds: ['1', '2'],
    })
    expect(result.map((j) => j.id)).toEqual(['1'])
  })
})
