import { beforeAll, describe, expect, it } from 'vitest'
import { TEST_CONFLICT_IDS } from '@test/fixtures/conflicts'
import {
  integrationEnabled,
  isSupabaseReachable,
  signInTestUser,
} from './supabaseClient'

const TEST_EMAIL = process.env.E2E_TEST_EMAIL ?? 'owner@test.grid.local'
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD ?? 'TestPassword123!'
const FREELANCER_EMAIL = 'freelancer@test.grid.local'
const FREELANCER_PASSWORD = 'TestPassword123!'
const TEST_COMPANY_ID = TEST_CONFLICT_IDS.companyId

const describeIntegration = integrationEnabled ? describe : describe.skip

describeIntegration('crew assignments access', () => {
  beforeAll(async () => {
    const reachable = await isSupabaseReachable()
    if (!reachable) {
      throw new Error(
        'Local Supabase is not reachable. Run `supabase start` and `npm run db:seed-test-users`.',
      )
    }
  })

  it('allows owner to read company crew profiles', async () => {
    const { client } = await signInTestUser(TEST_EMAIL, TEST_PASSWORD)
    const { data, error } = await client
      .from('company_user_profiles')
      .select('user_id, company_id, display_name')
      .eq('company_id', TEST_COMPANY_ID)
      .limit(10)

    expect(error).toBeNull()
    expect(data?.length).toBeGreaterThan(0)
  })

  it('allows owner to read company_users for crew management', async () => {
    const { client } = await signInTestUser(TEST_EMAIL, TEST_PASSWORD)
    const { data, error } = await client
      .from('company_users')
      .select('user_id, role')
      .eq('company_id', TEST_COMPANY_ID)

    expect(error).toBeNull()
    expect(data?.some((row) => row.role === 'owner')).toBe(true)
  })

  it('blocks freelancer from reading internal crew notes', async () => {
    const { client } = await signInTestUser(
      FREELANCER_EMAIL,
      FREELANCER_PASSWORD,
    )
    const { data, error } = await client
      .from('company_user_internal_notes')
      .select('id')
      .eq('company_id', TEST_COMPANY_ID)
      .limit(5)

    expect(error ?? data?.length === 0).toBeTruthy()
  })
})
