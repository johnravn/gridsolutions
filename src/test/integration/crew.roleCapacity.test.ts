import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { TEST_CONFLICT_IDS } from '@test/fixtures/conflicts'
import {
  createServiceClient,
  integrationEnabled,
  isSupabaseReachable,
  signInTestUser,
} from './supabaseClient'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@shared/types/database.types'

const OWNER_EMAIL = process.env.E2E_TEST_EMAIL ?? 'owner@test.grid.local'
const OWNER_PASSWORD = process.env.E2E_TEST_PASSWORD ?? 'TestPassword123!'
const EMPLOYEE_EMAIL = 'employee@test.grid.local'
const EMPLOYEE_PASSWORD = 'TestPassword123!'
const FREELANCER_EMAIL = 'freelancer@test.grid.local'
const FREELANCER_PASSWORD = 'TestPassword123!'
const TEST_COMPANY_ID = TEST_CONFLICT_IDS.companyId
const TEST_JOB_ID = TEST_CONFLICT_IDS.jobId

const describeIntegration = integrationEnabled ? describe : describe.skip

describeIntegration('crew role first-to-accept', () => {
  let admin: SupabaseClient<Database>
  let timePeriodId: string | null = null
  let matterId: string | null = null
  let ownerId: string | null = null
  let employeeId: string | null = null
  let freelancerId: string | null = null

  beforeAll(async () => {
    const reachable = await isSupabaseReachable()
    if (!reachable) {
      throw new Error(
        'Local Supabase is not reachable. Run `supabase start` and `npm run db:seed-test-users`.',
      )
    }

    admin = createServiceClient()

    const { data: listed, error: listError } = await admin.auth.admin.listUsers(
      { perPage: 1000 },
    )
    if (listError) throw listError

    ownerId = listed.users.find((u) => u.email === OWNER_EMAIL)?.id ?? null
    employeeId =
      listed.users.find((u) => u.email === EMPLOYEE_EMAIL)?.id ?? null
    freelancerId =
      listed.users.find((u) => u.email === FREELANCER_EMAIL)?.id ?? null
    if (!ownerId || !employeeId || !freelancerId) {
      throw new Error('Seed owner, employee, and freelancer users are required')
    }

    const { data: period, error: periodError } = await admin
      .from('time_periods')
      .insert({
        company_id: TEST_COMPANY_ID,
        job_id: TEST_JOB_ID,
        category: 'crew',
        title: 'First-to-accept role',
        needed_count: 2,
        start_at: '2028-03-15T08:00:00.000Z',
        end_at: '2028-03-15T18:00:00.000Z',
      })
      .select('id')
      .single()
    if (periodError) throw periodError
    timePeriodId = period.id

    const crewRows = [ownerId, employeeId, freelancerId].map((userId) => ({
      time_period_id: timePeriodId!,
      user_id: userId,
      status: 'planned' as const,
    }))
    const { error: crewError } = await admin
      .from('reserved_crew')
      .insert(crewRows)
    if (crewError) throw crewError

    const { data: matter, error: matterError } = await admin
      .from('matters')
      .insert({
        company_id: TEST_COMPANY_ID,
        created_by_user_id: ownerId,
        matter_type: 'crew_invite',
        title: 'Crew invitation: First-to-accept role',
        job_id: TEST_JOB_ID,
        time_period_id: timePeriodId,
      })
      .select('id')
      .single()
    if (matterError) throw matterError
    matterId = matter.id

    const { error: recipientsError } = await admin
      .from('matter_recipients')
      .insert(
        [ownerId, employeeId, freelancerId].map((userId) => ({
          matter_id: matterId!,
          user_id: userId,
          status: 'pending' as const,
        })),
      )
    if (recipientsError) throw recipientsError
  })

  afterAll(async () => {
    if (!admin) return
    if (matterId) {
      await admin.from('matters').delete().eq('id', matterId)
    }
    if (timePeriodId) {
      await admin
        .from('reserved_crew')
        .delete()
        .eq('time_period_id', timePeriodId)
      await admin.from('time_periods').delete().eq('id', timePeriodId)
    }
  })

  it('lets the first needed_count accepts win and closes the rest', async () => {
    if (!matterId || !timePeriodId) throw new Error('Test setup failed')

    const owner = await signInTestUser(OWNER_EMAIL, OWNER_PASSWORD)
    const { data: ownerResult, error: ownerError } = await owner.client.rpc(
      'respond_to_crew_invite',
      { p_matter_id: matterId, p_response: 'approved' },
    )
    expect(ownerError).toBeNull()
    expect(ownerResult).toEqual({ status: 'confirmed' })

    const employee = await signInTestUser(EMPLOYEE_EMAIL, EMPLOYEE_PASSWORD)
    const { data: employeeResult, error: employeeError } =
      await employee.client.rpc('respond_to_crew_invite', {
        p_matter_id: matterId,
        p_response: 'approved',
      })
    expect(employeeError).toBeNull()
    expect(employeeResult).toEqual({ status: 'confirmed' })

    const freelancer = await signInTestUser(
      FREELANCER_EMAIL,
      FREELANCER_PASSWORD,
    )
    const { data: freelancerResult, error: freelancerError } =
      await freelancer.client.rpc('respond_to_crew_invite', {
        p_matter_id: matterId,
        p_response: 'approved',
      })
    expect(freelancerError).toBeNull()
    expect(freelancerResult).toEqual({ status: 'role_filled' })

    const { data: crew, error: crewError } = await admin
      .from('reserved_crew')
      .select('user_id, status')
      .eq('time_period_id', timePeriodId)
    if (crewError) throw crewError

    const byUser = Object.fromEntries(
      (crew ?? []).map((row) => [row.user_id, row.status]),
    )
    expect(byUser[ownerId!]).toBe('confirmed')
    expect(byUser[employeeId!]).toBe('confirmed')
    expect(byUser[freelancerId!]).toBe('canceled')

    const { data: filledResponse, error: responseError } = await admin
      .from('matter_responses')
      .select('response')
      .eq('matter_id', matterId)
      .eq('user_id', freelancerId!)
      .single()
    expect(responseError).toBeNull()
    expect(filledResponse?.response).toBe('role_filled')
  })
})
