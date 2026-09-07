import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { TEST_CONFLICT_IDS } from '@test/fixtures/conflicts'
import {
  createServiceClient,
  integrationEnabled,
  isSupabaseReachable,
  signInTestUser,
} from './supabaseClient'

const OWNER_EMAIL = process.env.E2E_TEST_EMAIL ?? 'owner@test.grid.local'
const OWNER_PASSWORD = process.env.E2E_TEST_PASSWORD ?? 'TestPassword123!'
const EMPLOYEE_EMAIL = 'employee@test.grid.local'
const EMPLOYEE_PASSWORD = 'TestPassword123!'
const COMPANY_ID = TEST_CONFLICT_IDS.companyId

const describeIntegration = integrationEnabled ? describe : describe.skip

const createdInviteIds: Array<string> = []

describeIntegration('company role assignment matrix', () => {
  beforeAll(async () => {
    const reachable = await isSupabaseReachable()
    if (!reachable) {
      throw new Error(
        'Local Supabase is not reachable. Run `supabase start` and `npm run db:seed-test-users`.',
      )
    }
  })

  afterEach(async () => {
    if (createdInviteIds.length === 0) return
    const admin = createServiceClient()
    await admin.from('pending_invites').delete().in('id', createdInviteIds)
    createdInviteIds.length = 0
  })

  it('rejects employee inviting as owner', async () => {
    const { client, session } = await signInTestUser(
      EMPLOYEE_EMAIL,
      EMPLOYEE_PASSWORD,
    )
    const { data, error } = await client.rpc('add_member_or_invite', {
      p_company_id: COMPANY_ID,
      p_email: `escalate-${Date.now()}@example.com`,
      p_inviter_id: session!.user.id,
      p_role: 'owner',
    })

    expect(data).toBeNull()
    expect(error).not.toBeNull()
    expect(error?.message).toMatch(/role_not_assignable/)
  })

  it('rejects employee changing a role via set_company_user_role', async () => {
    const { client, session } = await signInTestUser(
      EMPLOYEE_EMAIL,
      EMPLOYEE_PASSWORD,
    )
    const { data: freelancer } = await client
      .from('company_users')
      .select('user_id')
      .eq('company_id', COMPANY_ID)
      .eq('role', 'freelancer')
      .limit(1)
      .maybeSingle()

    expect(freelancer?.user_id).toBeTruthy()

    const { error } = await client.rpc('set_company_user_role', {
      p_company_id: COMPANY_ID,
      p_target_user_id: freelancer!.user_id,
      p_new_role: 'owner',
      p_actor_user_id: session!.user.id,
    })

    expect(error).not.toBeNull()
    expect(error?.message).toMatch(
      /insufficient_privileges|role_not_assignable/,
    )
  })

  it('lets employee invite a freelancer', async () => {
    const { client, session } = await signInTestUser(
      EMPLOYEE_EMAIL,
      EMPLOYEE_PASSWORD,
    )
    const email = `freelancer-invite-${Date.now()}@example.com`
    const { data, error } = await client.rpc('add_member_or_invite', {
      p_company_id: COMPANY_ID,
      p_email: email,
      p_inviter_id: session!.user.id,
      p_role: 'freelancer',
    })

    expect(error).toBeNull()
    expect(data).toMatchObject({ type: 'invited' })
    if (
      data &&
      typeof data === 'object' &&
      'pending_invite_id' in data &&
      typeof data.pending_invite_id === 'string'
    ) {
      createdInviteIds.push(data.pending_invite_id)
    }
  })

  it('lets owner invite an employee', async () => {
    const { client, session } = await signInTestUser(
      OWNER_EMAIL,
      OWNER_PASSWORD,
    )
    const email = `employee-invite-${Date.now()}@example.com`
    const { data, error } = await client.rpc('add_member_or_invite', {
      p_company_id: COMPANY_ID,
      p_email: email,
      p_inviter_id: session!.user.id,
      p_role: 'employee',
    })

    expect(error).toBeNull()
    expect(data).toMatchObject({ type: 'invited' })
    if (
      data &&
      typeof data === 'object' &&
      'pending_invite_id' in data &&
      typeof data.pending_invite_id === 'string'
    ) {
      createdInviteIds.push(data.pending_invite_id)
    }
  })
})
