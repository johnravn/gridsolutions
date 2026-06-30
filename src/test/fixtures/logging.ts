/** Fixed ISO timestamps for deterministic logging range tests. */
export const LOGGING_FIXTURE_DATES = {
  midJune2026: '2026-06-15T12:00:00.000Z',
  january2026: '2026-01-10T08:30:00.000Z',
  invalid: 'not-a-date',
} as const

export const LOGGING_MONTH_INPUTS = {
  valid: '2026-06',
  invalid: '2026-13',
  malformed: 'bad',
} as const
