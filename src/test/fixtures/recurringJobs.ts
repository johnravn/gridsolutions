import type { RawCrewBooking } from '@features/jobs/utils/aggregateRecurringJobCrew'
import type {
  RecurringJobDetail,
  RecurringJobTemplate,
} from '@features/jobs/types'

export function makeRawCrewBooking(
  overrides: Partial<RawCrewBooking> = {},
): RawCrewBooking {
  return {
    user_id: '33333333-3333-4333-8333-333333333333',
    display_name: 'Test Crew',
    email: 'crew@test.grid.local',
    avatar_url: null,
    job_id: '44444444-4444-4444-8444-444444444444',
    job_title: 'Recurring Instance',
    jobnr: 100,
    role_title: 'Technician',
    start_at: '2026-06-01T08:00:00.000Z',
    end_at: '2026-06-01T18:00:00.000Z',
    status: 'planned',
    ...overrides,
  }
}

export function makeRecurringJobDetail(
  overrides: Partial<RecurringJobDetail> = {},
): RecurringJobDetail {
  return {
    id: '55555555-5555-4555-8555-555555555555',
    company_id: '11111111-1111-4111-8111-111111111111',
    title: 'Weekly Show',
    description: 'Recurring production',
    archived: false,
    job_count: 0,
    project_lead_user_id: '66666666-6666-4666-8666-666666666666',
    customer_id: '77777777-7777-4777-8777-777777777777',
    customer_user_id: null,
    customer_contact_id: null,
    jobs: [],
    ...overrides,
  }
}

export function makeRecurringJobTemplate(
  overrides: Partial<RecurringJobTemplate> = {},
): RecurringJobTemplate {
  return {
    id: '88888888-8888-4888-8888-888888888888',
    recurring_job_id: '55555555-5555-4555-8555-555555555555',
    company_id: '11111111-1111-4111-8111-111111111111',
    name: 'Standard Setup',
    title: 'Standard Setup',
    description: null,
    status: 'planned',
    start_time: '09:00:00',
    duration_hours: 8,
    sort_order: 0,
    crew_roles: [{ title: 'Technician', needed_count: 2, role_category: null }],
    ...overrides,
  }
}
