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

describeIntegration('company settings access', () => {
  beforeAll(async () => {
    const reachable = await isSupabaseReachable()
    if (!reachable) {
      throw new Error(
        'Local Supabase is not reachable. Run `supabase start` and `npm run db:seed-test-users`.',
      )
    }
  })

  it('allows owner to read company record', async () => {
    const { client } = await signInTestUser(TEST_EMAIL, TEST_PASSWORD)
    const { data, error } = await client
      .from('companies')
      .select('id, name')
      .eq('id', TEST_COMPANY_ID)
      .single()

    expect(error).toBeNull()
    expect(data?.name).toBe('Grid Test Company')
  })

  it('allows employee to read company_users roster', async () => {
    const { client } = await signInTestUser(EMPLOYEE_EMAIL, EMPLOYEE_PASSWORD)
    const { data, error } = await client
      .from('company_users')
      .select('user_id, role')
      .eq('company_id', TEST_COMPANY_ID)

    expect(error).toBeNull()
    expect(data?.length).toBeGreaterThan(0)
  })

  it('blocks freelancer from updating company settings', async () => {
    const { client } = await signInTestUser(
      FREELANCER_EMAIL,
      FREELANCER_PASSWORD,
    )
    const { data, error } = await client
      .from('companies')
      .update({ general_email: 'hacker@example.com' })
      .eq('id', TEST_COMPANY_ID)
      .select('id')

    expect(error).toBeNull()
    expect(data ?? []).toHaveLength(0)
  })
})
