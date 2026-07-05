import { beforeAll, describe, expect, it } from 'vitest'
import { TEST_CONFLICT_IDS } from '@test/fixtures/conflicts'
import {
  createServiceClient,
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

describeIntegration('matters RLS', () => {
  let matterId: string | null = null

  beforeAll(async () => {
    const reachable = await isSupabaseReachable()
    if (!reachable) {
      throw new Error(
        'Local Supabase is not reachable. Run `supabase start` and `npm run db:seed-test-users`.',
      )
    }

    const service = createServiceClient()
    const { data: owner } = await service.auth.admin.listUsers()
    const ownerUser = owner.users.find((u) => u.email === TEST_EMAIL)
    if (!ownerUser) throw new Error('Seed owner user not found')

    const { data: matter, error } = await service
      .from('matters')
      .insert({
        company_id: TEST_COMPANY_ID,
        created_by_user_id: ownerUser.id,
        matter_type: 'announcement',
        title: 'Integration test matter',
        content: 'RLS test body',
      })
      .select('id')
      .single()

    if (error) throw error
    matterId = matter.id
  })

  it('allows owner to read company matters', async () => {
    const { client } = await signInTestUser(TEST_EMAIL, TEST_PASSWORD)
    const { data, error } = await client
      .from('matters')
      .select('id, title, company_id')
      .eq('company_id', TEST_COMPANY_ID)
      .limit(10)

    expect(error).toBeNull()
    expect(data?.length).toBeGreaterThan(0)
  })

  it('blocks freelancer from reading matters outside their visibility', async () => {
    if (!matterId) return

    const { client } = await signInTestUser(
      FREELANCER_EMAIL,
      FREELANCER_PASSWORD,
    )
    const { data, error } = await client
      .from('matters')
      .select('id')
      .eq('id', matterId)
      .maybeSingle()

    expect(error ?? !data).toBeTruthy()
  })
})
