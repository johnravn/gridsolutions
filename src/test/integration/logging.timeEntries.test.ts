import { beforeAll, describe, expect, it } from 'vitest'
import { TEST_CONFLICT_IDS } from '@test/fixtures/conflicts'
import {
  integrationEnabled,
  isSupabaseReachable,
  signInTestUser,
} from './supabaseClient'

const TEST_EMAIL = process.env.E2E_TEST_EMAIL ?? 'owner@test.grid.local'
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD ?? 'TestPassword123!'
const EMPLOYEE_EMAIL = 'employee@test.grid.local'
const EMPLOYEE_PASSWORD = 'TestPassword123!'
const FREELANCER_EMAIL = 'freelancer@test.grid.local'
const FREELANCER_PASSWORD = 'TestPassword123!'
const TEST_COMPANY_ID = TEST_CONFLICT_IDS.companyId

const describeIntegration = integrationEnabled ? describe : describe.skip

describeIntegration('logging time entries access', () => {
  beforeAll(async () => {
    const reachable = await isSupabaseReachable()
    if (!reachable) {
      throw new Error(
        'Local Supabase is not reachable. Run `supabase start` and `npm run db:seed-test-users`.',
      )
    }
  })

  it('allows owner to read time entries', async () => {
    const { client } = await signInTestUser(TEST_EMAIL, TEST_PASSWORD)
    const { data, error } = await client
      .from('time_entries')
      .select('id, user_id, company_id')
      .eq('company_id', TEST_COMPANY_ID)
      .limit(10)

    expect(error).toBeNull()
    expect(Array.isArray(data)).toBe(true)
  })

  it('allows employee to read own company time entries', async () => {
    const { client } = await signInTestUser(EMPLOYEE_EMAIL, EMPLOYEE_PASSWORD)
    const { error } = await client
      .from('time_entries')
      .select('id')
      .eq('company_id', TEST_COMPANY_ID)
      .limit(5)

    expect(error).toBeNull()
  })

  it('blocks freelancer from inserting time entries for other users', async () => {
    const { client } = await signInTestUser(
      FREELANCER_EMAIL,
      FREELANCER_PASSWORD,
    )
    const { error } = await client.from('time_entries').insert({
      company_id: TEST_COMPANY_ID,
      user_id: '00000000-0000-4000-8000-000000009999',
      entry_date: '2026-06-01',
      hours: 1,
      entry_type: 'work',
    } as never)

    expect(error).toBeTruthy()
  })
})
