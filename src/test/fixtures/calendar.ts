import type { CalendarRecord } from '@features/calendar/components/domain'

export function makeCalendarRecord(
  overrides: Partial<CalendarRecord> = {},
): CalendarRecord {
  return {
    id: '00000000-0000-4000-8000-000000000100',
    title: 'Test Event',
    start: '2026-06-01T08:00:00.000Z',
    end: '2026-06-01T18:00:00.000Z',
    kind: 'job',
    ref: { jobId: '22222222-2222-4222-8222-222222222222' },
    status: 'confirmed',
    jobTitle: 'Test Job',
    ...overrides,
  }
}
