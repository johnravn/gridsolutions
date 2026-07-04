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
const TEST_COMPANY_ID = TEST_CONFLICT_IDS.companyId

const describeIntegration = integrationEnabled ? describe : describe.skip

describeIntegration('job subcontractors RLS', () => {
  let jobId: string | null = null
  let partnerCustomerId: string | null = null

  beforeAll(async () => {
    const reachable = await isSupabaseReachable()
    if (!reachable) {
      throw new Error(
        'Local Supabase is not reachable. Run `supabase start` and `npm run db:seed-test-users`.',
      )
    }

    const service = createServiceClient()

    const { data: partner } = await service
      .from('customers')
      .select('id')
      .eq('company_id', TEST_COMPANY_ID)
      .eq('is_partner', true)
      .limit(1)
      .maybeSingle()

    partnerCustomerId = partner?.id ?? null
    if (!partnerCustomerId) {
      const { data: createdPartner, error: partnerErr } = await service
        .from('customers')
        .insert({
          company_id: TEST_COMPANY_ID,
          name: 'Integration Partner',
          is_partner: true,
        })
        .select('id')
        .single()
      if (partnerErr) throw partnerErr
      partnerCustomerId = createdPartner.id
    }

    const { data: job, error: jobErr } = await service
      .from('jobs')
      .insert({
        company_id: TEST_COMPANY_ID,
        title: 'Integration subcontractor job',
        status: 'planned',
      })
      .select('id')
      .single()

    if (jobErr) throw jobErr
    jobId = job.id
  })

  it('allows owner to add and read job subcontractors', async () => {
    if (!jobId || !partnerCustomerId) return

    const { client } = await signInTestUser(TEST_EMAIL, TEST_PASSWORD)

    const { data: inserted, error: insertErr } = await client
      .from('job_subcontractors')
      .insert({
        job_id: jobId,
        customer_id: partnerCustomerId,
        notes: 'Integration test subcontractor',
      })
      .select('id, customer_id, notes')
      .single()

    expect(insertErr).toBeNull()
    expect(inserted?.customer_id).toBe(partnerCustomerId)

    const { data: rows, error: selectErr } = await client
      .from('job_subcontractors')
      .select('id, customer_id, notes')
      .eq('job_id', jobId)

    expect(selectErr).toBeNull()
    expect(rows?.some((r) => r.id === inserted?.id)).toBe(true)
  })
})
