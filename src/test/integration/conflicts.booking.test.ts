import { beforeAll, describe, expect, it } from 'vitest'
import {
  TEST_CONFLICT_BOOKING,
  TEST_CONFLICT_IDS,
} from '@test/fixtures/conflicts'
import {
  createServiceClient,
  integrationEnabled,
  isSupabaseReachable,
  signInTestUser,
} from './supabaseClient'

const TEST_EMAIL = process.env.E2E_TEST_EMAIL ?? 'owner@test.grid.local'
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD ?? 'TestPassword123!'
const EMPLOYEE_EMAIL = 'employee@test.grid.local'
const EMPLOYEE_PASSWORD = 'TestPassword123!'
const TEST_COMPANY_ID = TEST_CONFLICT_IDS.companyId
const TEST_JOB_ID = TEST_CONFLICT_IDS.jobId
const TEST_ITEM_ID = TEST_CONFLICT_IDS.testItemId

const NON_OVERLAP = {
  startAt: '2026-08-01T08:00:00.000Z',
  endAt: '2026-08-01T18:00:00.000Z',
} as const

const describeIntegration = integrationEnabled ? describe : describe.skip

describeIntegration('booking conflicts access', () => {
  beforeAll(async () => {
    const reachable = await isSupabaseReachable()
    if (!reachable) {
      throw new Error(
        'Local Supabase is not reachable. Run `supabase start` and `npm run db:seed-test-users`.',
      )
    }
  })

  it('allows owner to read equipment time periods for conflict checks', async () => {
    const { client } = await signInTestUser(TEST_EMAIL, TEST_PASSWORD)
    const { data, error } = await client
      .from('time_periods')
      .select('id, start_at, end_at, category, job_id')
      .eq('company_id', TEST_COMPANY_ID)
      .eq('category', 'equipment')
      .limit(10)

    expect(error).toBeNull()
    expect(Array.isArray(data)).toBe(true)
  })

  it('allows owner to read reserved items for a job', async () => {
    const { client } = await signInTestUser(TEST_EMAIL, TEST_PASSWORD)
    const { data, error } = await client
      .from('reserved_items')
      .select('id, item_id, quantity, status, time_period_id')
      .limit(10)

    expect(error).toBeNull()
    expect(Array.isArray(data)).toBe(true)
  })

  it('allows employee to read seeded job bookings', async () => {
    const { client } = await signInTestUser(EMPLOYEE_EMAIL, EMPLOYEE_PASSWORD)
    const { data, error } = await client
      .from('jobs')
      .select('id, title')
      .eq('id', TEST_JOB_ID)
      .single()

    expect(error).toBeNull()
    expect(data?.id).toBe(TEST_JOB_ID)
  })
})

describeIntegration('forced booking metadata', () => {
  it('service role can read forced booking columns on reserved items', async () => {
    const admin = createServiceClient()
    const { data, error } = await admin
      .from('reserved_items')
      .select('id, forced, forced_at, forced_by_user_id')
      .limit(5)

    expect(error).toBeNull()
    expect(Array.isArray(data)).toBe(true)
  })

  it('seeded conflict booking exists on E2E Test Job', async () => {
    const admin = createServiceClient()
    const { data, error } = await admin
      .from('reserved_items')
      .select('id, item_id, quantity, forced, time_period_id')
      .eq('id', TEST_CONFLICT_IDS.conflictReservedItemId)
      .single()

    expect(error).toBeNull()
    expect(data?.item_id).toBe(TEST_ITEM_ID)
    expect(data?.forced).toBe(false)
  })
})

describeIntegration('force-book write path', () => {
  const admin = createServiceClient()
  let ephemeralJobId: string | null = null
  let ephemeralTimePeriodId: string | null = null
  let ephemeralReservedItemId: string | null = null
  let ownerUserId: string | null = null

  beforeAll(async () => {
    const reachable = await isSupabaseReachable()
    if (!reachable) {
      throw new Error(
        'Local Supabase is not reachable. Run `supabase start` and `npm run db:seed-test-users`.',
      )
    }
    const { session } = await signInTestUser(TEST_EMAIL, TEST_PASSWORD)
    ownerUserId = session?.user.id ?? null
  })

  it('owner can force-book an overlapping reservation on another job', async () => {
    expect(ownerUserId).toBeTruthy()

    ephemeralJobId = crypto.randomUUID()
    ephemeralTimePeriodId = crypto.randomUUID()

    const { error: jobError } = await admin.from('jobs').insert({
      id: ephemeralJobId,
      company_id: TEST_COMPANY_ID,
      title: `Integration Force Book ${Date.now()}`,
      description: 'Ephemeral job for force-book test',
      status: 'planned',
      start_at: TEST_CONFLICT_BOOKING.startAt,
      end_at: TEST_CONFLICT_BOOKING.endAt,
      project_lead_user_id: ownerUserId!,
      jobnr: 999900 + Math.floor(Math.random() * 99),
    })
    expect(jobError).toBeNull()

    const { client } = await signInTestUser(TEST_EMAIL, TEST_PASSWORD)
    const forcedAt = new Date().toISOString()

    const { data: tp, error: tpError } = await client
      .from('time_periods')
      .insert({
        id: ephemeralTimePeriodId!,
        company_id: TEST_COMPANY_ID,
        job_id: ephemeralJobId,
        title: 'Equipment period',
        category: 'equipment',
        start_at: TEST_CONFLICT_BOOKING.startAt,
        end_at: TEST_CONFLICT_BOOKING.endAt,
      })
      .select('id')
      .single()

    expect(tpError).toBeNull()
    expect(tp?.id).toBe(ephemeralTimePeriodId)

    const { data: reserved, error: riError } = await client
      .from('reserved_items')
      .insert({
        time_period_id: ephemeralTimePeriodId!,
        item_id: TEST_ITEM_ID,
        quantity: 1,
        status: 'planned',
        source_kind: 'direct',
        start_at: TEST_CONFLICT_BOOKING.startAt,
        end_at: TEST_CONFLICT_BOOKING.endAt,
        forced: true,
        forced_at: forcedAt,
        forced_by_user_id: ownerUserId!,
      })
      .select('id, forced, forced_at, forced_by_user_id')
      .single()

    expect(riError).toBeNull()
    expect(reserved?.forced).toBe(true)
    expect(reserved?.forced_at).toBeTruthy()
    expect(reserved?.forced_by_user_id).toBe(ownerUserId)
    ephemeralReservedItemId = reserved?.id ?? null
  })

  it('employee can insert non-forced reservation on non-overlapping window', async () => {
    const { client } = await signInTestUser(EMPLOYEE_EMAIL, EMPLOYEE_PASSWORD)
    const tempTpId = crypto.randomUUID()
    const tempRiId = crypto.randomUUID()

    const { error: tpError } = await client.from('time_periods').insert({
      id: tempTpId,
      company_id: TEST_COMPANY_ID,
      job_id: TEST_JOB_ID,
      title: 'Employee booking',
      category: 'equipment',
      start_at: NON_OVERLAP.startAt,
      end_at: NON_OVERLAP.endAt,
    })
    expect(tpError).toBeNull()

    const { data: inserted, error: riError } = await client
      .from('reserved_items')
      .insert({
        id: tempRiId,
        time_period_id: tempTpId,
        item_id: TEST_ITEM_ID,
        quantity: 1,
        status: 'planned',
        source_kind: 'direct',
        start_at: NON_OVERLAP.startAt,
        end_at: NON_OVERLAP.endAt,
      })
      .select('id, forced')
      .single()

    expect(riError).toBeNull()
    expect(inserted?.forced).toBe(false)

    await admin.from('reserved_items').delete().eq('id', tempRiId)
    await admin.from('time_periods').delete().eq('id', tempTpId)
  })

  it('non-overlapping booking succeeds without forced fields', async () => {
    const tempJobId = crypto.randomUUID()
    const tempTpId = crypto.randomUUID()

    const { error: jobError } = await admin.from('jobs').insert({
      id: tempJobId,
      company_id: TEST_COMPANY_ID,
      title: `Integration Non-overlap ${Date.now()}`,
      status: 'planned',
      start_at: NON_OVERLAP.startAt,
      end_at: NON_OVERLAP.endAt,
      project_lead_user_id: ownerUserId!,
      jobnr: 999800 + Math.floor(Math.random() * 99),
    })
    expect(jobError).toBeNull()

    const { client } = await signInTestUser(TEST_EMAIL, TEST_PASSWORD)

    const { data: tp, error: tpError } = await client
      .from('time_periods')
      .insert({
        id: tempTpId,
        company_id: TEST_COMPANY_ID,
        job_id: tempJobId,
        title: 'Non-overlap equipment',
        category: 'equipment',
        start_at: NON_OVERLAP.startAt,
        end_at: NON_OVERLAP.endAt,
      })
      .select('id')
      .single()
    expect(tpError).toBeNull()

    const { data: reserved, error: riError } = await client
      .from('reserved_items')
      .insert({
        time_period_id: tempTpId,
        item_id: TEST_ITEM_ID,
        quantity: 1,
        status: 'planned',
        source_kind: 'direct',
        start_at: NON_OVERLAP.startAt,
        end_at: NON_OVERLAP.endAt,
      })
      .select('id, forced, forced_at, forced_by_user_id')
      .single()

    expect(riError).toBeNull()
    expect(reserved?.forced).toBe(false)
    expect(reserved?.forced_at).toBeNull()
    expect(reserved?.forced_by_user_id).toBeNull()

    await admin.from('reserved_items').delete().eq('id', reserved!.id)
    await admin.from('time_periods').delete().eq('id', tp!.id)
    await admin.from('jobs').delete().eq('id', tempJobId)
  })

  it('cleans up ephemeral force-book rows', async () => {
    if (ephemeralReservedItemId) {
      const { error } = await admin
        .from('reserved_items')
        .delete()
        .eq('id', ephemeralReservedItemId)
      expect(error).toBeNull()
    }
    if (ephemeralTimePeriodId) {
      const { error } = await admin
        .from('time_periods')
        .delete()
        .eq('id', ephemeralTimePeriodId)
      expect(error).toBeNull()
    }
    if (ephemeralJobId) {
      const { error } = await admin
        .from('jobs')
        .delete()
        .eq('id', ephemeralJobId)
      expect(error).toBeNull()
    }
  })
})
