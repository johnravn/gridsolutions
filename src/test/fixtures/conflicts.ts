import type { OverlapConflict } from '@features/conflicts/api/overlapChecks'

/** Matches scripts/seed-test-users.mjs — fixed overlap on E2E Test Job. */
export const TEST_CONFLICT_IDS = {
  companyId: '11111111-1111-4111-8111-111111111111',
  jobId: '22222222-2222-4222-8222-222222222222',
  conflictSeedJobId: '14141414-1414-4414-8414-141414141414',
  testItemId: 'ffffffff-ffff-4fff-8fff-fffffffffff1',
  conflictTimePeriodId: '12121212-1212-4212-8212-121212121212',
  conflictReservedItemId: '13131313-1313-4313-8313-131313131313',
} as const

export const TEST_CONFLICT_BOOKING = {
  startAt: '2026-07-01T08:00:00.000Z',
  endAt: '2026-07-01T18:00:00.000Z',
} as const

export function makeOverlapConflict(
  overrides: Partial<OverlapConflict> = {},
): OverlapConflict {
  return {
    jobId: '22222222-2222-4222-8222-222222222222',
    jobTitle: 'Test Job',
    startAt: '2026-06-01T08:00:00.000Z',
    endAt: '2026-06-01T18:00:00.000Z',
    customerName: 'Test Customer',
    projectLeadName: 'Lead Person',
    itemName: 'Test Microphone',
    quantity: 1,
    ...overrides,
  }
}
