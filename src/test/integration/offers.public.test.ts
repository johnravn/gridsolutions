import { beforeAll, describe, expect, it } from 'vitest'
import {
  createAnonClient,
  createServiceClient,
  integrationEnabled,
  isSupabaseReachable,
  signInTestUser,
} from './supabaseClient'

const TEST_EMAIL = process.env.E2E_TEST_EMAIL ?? 'owner@test.grid.local'
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD ?? 'TestPassword123!'
const FREELANCER_EMAIL = 'freelancer@test.grid.local'
const FREELANCER_PASSWORD = 'TestPassword123!'
const EMPLOYEE_EMAIL = 'employee@test.grid.local'
const EMPLOYEE_PASSWORD = 'TestPassword123!'

const SENT_TOKEN = 'e2e-test-sent-offer-token'
const ACCEPT_TOKEN = 'e2e-test-accept-offer-token'
const DRAFT_TOKEN = 'e2e-test-draft-offer-token'
const REJECT_TOKEN = 'e2e-test-reject-offer-token'
const REVISION_TOKEN = 'e2e-test-revision-offer-token'
const TEST_COMPANY_ID = '11111111-1111-4111-8111-111111111111'
const TEST_JOB_ID = '22222222-2222-4222-8222-222222222222'
const TEST_ITEM_ID = 'ffffffff-ffff-4fff-8fff-fffffffffff1'
const ACCEPT_JOB_ID = '77777777-7777-4777-8777-777777777770'

const describeIntegration = integrationEnabled ? describe : describe.skip

describeIntegration('public offer RPCs', () => {
  let reachable = false

  beforeAll(async () => {
    reachable = await isSupabaseReachable()
    if (!reachable) {
      throw new Error(
        'Local Supabase is not reachable. Run `supabase start` and `npm run db:seed-test-users`.',
      )
    }
  })

  it('loads a sent offer via public_offer_get', async () => {
    const client = createAnonClient()
    const { data, error } = await client.rpc('public_offer_get', {
      p_access_token: SENT_TOKEN,
    })
    expect(error).toBeNull()
    expect(data).toBeTruthy()
    const offer = data as { status: string; title: string }
    expect(offer.status).toBe('sent')
    expect(offer.title).toContain('sent')
  })

  it('rejects accepting a draft offer', async () => {
    const client = createAnonClient()
    const { error } = await client.rpc('public_offer_accept', {
      p_access_token: DRAFT_TOKEN,
      p_first_name: 'Test',
      p_last_name: 'Customer',
      p_phone: '+4791234567',
    })
    expect(error).toBeTruthy()
    expect(error?.message).toMatch(/can no longer be accepted/i)
  })

  it('accepts a sent offer and updates status', async () => {
    const client = createAnonClient()
    const { error } = await client.rpc('public_offer_accept', {
      p_access_token: ACCEPT_TOKEN,
      p_first_name: 'E2E',
      p_last_name: 'Customer',
      p_phone: '+4791234567',
    })
    expect(error).toBeNull()

    const admin = createServiceClient()
    const { data: offer } = await admin
      .from('job_offers')
      .select('status, accepted_by_name')
      .eq('access_token', ACCEPT_TOKEN)
      .single()

    expect(offer?.status).toBe('accepted')
    expect(offer?.accepted_by_name).toBe('E2E Customer')
  })

  it('rejects a sent offer via public_offer_reject', async () => {
    const client = createAnonClient()
    const { error } = await client.rpc('public_offer_reject', {
      p_access_token: REJECT_TOKEN,
      p_first_name: 'Test',
      p_last_name: 'Customer',
      p_phone: '+4791234567',
      p_comment: 'Too expensive',
    })
    expect(error).toBeNull()

    const admin = createServiceClient()
    const { data: offer } = await admin
      .from('job_offers')
      .select('status, rejection_comment, rejected_by_name')
      .eq('access_token', REJECT_TOKEN)
      .single()

    expect(offer?.status).toBe('rejected')
    expect(offer?.rejection_comment).toBe('Too expensive')
    expect(offer?.rejected_by_name).toBe('Test Customer')
  })

  it('rejects rejecting a draft offer', async () => {
    const client = createAnonClient()
    const { error } = await client.rpc('public_offer_reject', {
      p_access_token: DRAFT_TOKEN,
      p_first_name: 'Test',
      p_last_name: 'Customer',
      p_phone: '+4791234567',
      p_comment: 'Nope',
    })
    expect(error).toBeTruthy()
    expect(error?.message).toMatch(/can no longer be rejected/i)
  })

  it('requests revision on a sent offer via public_offer_request_revision', async () => {
    const client = createAnonClient()
    const { error } = await client.rpc('public_offer_request_revision', {
      p_access_token: REVISION_TOKEN,
      p_first_name: 'Revise',
      p_last_name: 'Customer',
      p_phone: '+4791234567',
      p_comment: 'Please adjust pricing',
    })
    expect(error).toBeNull()

    const admin = createServiceClient()
    const { data: offer } = await admin
      .from('job_offers')
      .select('status, revision_comment, revision_requested_at')
      .eq('access_token', REVISION_TOKEN)
      .single()

    expect(offer?.status).toBe('viewed')
    expect(offer?.revision_comment).toBe('Please adjust pricing')
    expect(offer?.revision_requested_at).toBeTruthy()
  })

  it('rejects revision request on a draft offer', async () => {
    const client = createAnonClient()
    const { error } = await client.rpc('public_offer_request_revision', {
      p_access_token: DRAFT_TOKEN,
      p_first_name: 'Test',
      p_last_name: 'Customer',
      p_phone: '+4791234567',
      p_comment: 'Change please',
    })
    expect(error).toBeTruthy()
    expect(error?.message).toMatch(/can no longer be revised/i)
  })
})

describeIntegration('jobs RLS', () => {
  it('allows owner to read company jobs', async () => {
    const { client } = await signInTestUser(TEST_EMAIL, TEST_PASSWORD)
    const { data, error } = await client
      .from('jobs')
      .select('id, title')
      .eq('company_id', TEST_COMPANY_ID)

    expect(error).toBeNull()
    expect(data?.some((job) => job.id === TEST_JOB_ID)).toBe(true)
  })

  it('blocks freelancer from creating inventory items', async () => {
    const { client } = await signInTestUser(
      FREELANCER_EMAIL,
      FREELANCER_PASSWORD,
    )
    const { error } = await client.from('items').insert({
      company_id: TEST_COMPANY_ID,
      name: 'Freelancer-created item',
      total_quantity: 1,
    })

    expect(error).toBeTruthy()
  })

  it('prevents cross-company job reads', async () => {
    const { client } = await signInTestUser(TEST_EMAIL, TEST_PASSWORD)
    const { data } = await client
      .from('jobs')
      .select('id')
      .neq('company_id', TEST_COMPANY_ID)
      .limit(5)

    expect(data ?? []).toHaveLength(0)
  })
})

describeIntegration('public offer visibility RLS', () => {
  it('blocks anon from selecting draft offers by access token', async () => {
    const client = createAnonClient()
    const { data, error } = await client
      .from('job_offers')
      .select('id, status')
      .eq('access_token', DRAFT_TOKEN)

    expect(error).toBeNull()
    expect(data ?? []).toHaveLength(0)
  })

  it('blocks anon from selecting sent offers by access token (use RPC instead)', async () => {
    const client = createAnonClient()
    const { data, error } = await client
      .from('job_offers')
      .select('id, status, locked')
      .eq('access_token', SENT_TOKEN)

    expect(error).toBeNull()
    expect(data ?? []).toHaveLength(0)
  })

  it('loads sent locked offers via public_offer_get RPC', async () => {
    const client = createAnonClient()
    const { data, error } = await client.rpc('public_offer_get', {
      p_access_token: SENT_TOKEN,
    })
    expect(error).toBeNull()
    const offer = data as { status: string; locked: boolean }
    expect(offer.status).toBe('sent')
    expect(offer.locked).toBe(true)
  })
})

describeIntegration('job_copy RPC', () => {
  it('allows owner to copy a job with offers', async () => {
    const { client } = await signInTestUser(TEST_EMAIL, TEST_PASSWORD)

    const startAt = new Date()
    startAt.setDate(startAt.getDate() + 14)
    const endAt = new Date(startAt)
    endAt.setDate(endAt.getDate() + 3)

    const { data: newJobId, error } = await client.rpc('job_copy', {
      p_job_id: TEST_JOB_ID,
      p_start_at: startAt.toISOString(),
      p_end_at: endAt.toISOString(),
    })

    expect(error).toBeNull()
    expect(newJobId).toBeTruthy()

    const admin = createServiceClient()
    const { data: newJob } = await admin
      .from('jobs')
      .select('id, title')
      .eq('id', newJobId as string)
      .single()
    expect(newJob).toBeTruthy()

    const { data: copiedOffers } = await admin
      .from('job_offers')
      .select('id, copied_from_job_id')
      .eq('job_id', newJobId as string)

    expect(copiedOffers?.length).toBeGreaterThan(0)
    expect(
      copiedOffers?.every((o) => o.copied_from_job_id === TEST_JOB_ID),
    ).toBe(true)
  })

  it('blocks freelancer from copying a job', async () => {
    const { client } = await signInTestUser(
      FREELANCER_EMAIL,
      FREELANCER_PASSWORD,
    )

    const startAt = new Date()
    startAt.setDate(startAt.getDate() + 21)
    const endAt = new Date(startAt)
    endAt.setDate(endAt.getDate() + 3)

    const { error } = await client.rpc('job_copy', {
      p_job_id: TEST_JOB_ID,
      p_start_at: startAt.toISOString(),
      p_end_at: endAt.toISOString(),
    })

    expect(error).toBeTruthy()
    expect(error?.message).toMatch(/not allowed/i)
  })
})

describeIntegration('employee permissions RLS', () => {
  it('allows employee to read company jobs', async () => {
    const { client } = await signInTestUser(EMPLOYEE_EMAIL, EMPLOYEE_PASSWORD)
    const { data, error } = await client
      .from('jobs')
      .select('id, title')
      .eq('company_id', TEST_COMPANY_ID)

    expect(error).toBeNull()
    expect(data?.some((job) => job.id === TEST_JOB_ID)).toBe(true)
  })

  it('allows employee to read inventory items', async () => {
    const { client } = await signInTestUser(EMPLOYEE_EMAIL, EMPLOYEE_PASSWORD)
    const { data, error } = await client
      .from('items')
      .select('id, name')
      .eq('id', TEST_ITEM_ID)

    expect(error).toBeNull()
    expect(data).toHaveLength(1)
    expect(data?.[0]?.name).toBe('Test Seeded Item')
  })

  it('allows employee to create inventory items', async () => {
    const { client } = await signInTestUser(EMPLOYEE_EMAIL, EMPLOYEE_PASSWORD)
    const { data, error } = await client
      .from('items')
      .insert({
        company_id: TEST_COMPANY_ID,
        name: 'Employee-created item',
        total_quantity: 1,
      })
      .select('id, name')

    expect(error).toBeNull()
    expect(data?.[0]?.name).toBe('Employee-created item')
  })

  it('blocks employee from updating company settings', async () => {
    const { client } = await signInTestUser(EMPLOYEE_EMAIL, EMPLOYEE_PASSWORD)
    const { data, error } = await client
      .from('companies')
      .update({ name: 'Employee Override' })
      .eq('id', TEST_COMPANY_ID)
      .select('id')

    expect(error).toBeNull()
    expect(data ?? []).toHaveLength(0)
  })

  it('allows employee to copy a job via job_copy RPC', async () => {
    const { client } = await signInTestUser(EMPLOYEE_EMAIL, EMPLOYEE_PASSWORD)

    const startAt = new Date()
    startAt.setDate(startAt.getDate() + 28)
    const endAt = new Date(startAt)
    endAt.setDate(endAt.getDate() + 3)

    const { data: newJobId, error } = await client.rpc('job_copy', {
      p_job_id: ACCEPT_JOB_ID,
      p_start_at: startAt.toISOString(),
      p_end_at: endAt.toISOString(),
    })

    expect(error).toBeNull()
    expect(newJobId).toBeTruthy()
  })
})
