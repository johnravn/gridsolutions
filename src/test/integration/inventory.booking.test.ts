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
const EMPLOYEE_EMAIL = 'employee@test.grid.local'
const EMPLOYEE_PASSWORD = 'TestPassword123!'
const FREELANCER_EMAIL = 'freelancer@test.grid.local'
const FREELANCER_PASSWORD = 'TestPassword123!'
const TEST_COMPANY_ID = TEST_CONFLICT_IDS.companyId
const TEST_ITEM_ID = TEST_CONFLICT_IDS.testItemId

const RESERVE_WINDOW = {
  startAt: '2026-09-01T08:00:00.000Z',
  endAt: '2026-09-01T18:00:00.000Z',
} as const

const describeIntegration = integrationEnabled ? describe : describe.skip

describeIntegration('inventory booking access', () => {
  beforeAll(async () => {
    const reachable = await isSupabaseReachable()
    if (!reachable) {
      throw new Error(
        'Local Supabase is not reachable. Run `supabase start` and `npm run db:seed-test-users`.',
      )
    }
  })

  it('allows owner to read inventory index', async () => {
    const { client } = await signInTestUser(TEST_EMAIL, TEST_PASSWORD)
    const { data, error } = await client
      .from('inventory_index')
      .select('id, name, on_hand, is_group')
      .eq('company_id', TEST_COMPANY_ID)
      .eq('is_group', false)
      .limit(10)

    expect(error).toBeNull()
    expect(data?.length).toBeGreaterThan(0)
  })

  it('allows employee to read seeded inventory item', async () => {
    const { client } = await signInTestUser(EMPLOYEE_EMAIL, EMPLOYEE_PASSWORD)
    const { data, error } = await client
      .from('items')
      .select('id, name, total_quantity')
      .eq('id', TEST_ITEM_ID)
      .single()

    expect(error).toBeNull()
    expect(data?.name).toBe('Test Seeded Item')
  })

  it('blocks freelancer from creating inventory items', async () => {
    const { client } = await signInTestUser(
      FREELANCER_EMAIL,
      FREELANCER_PASSWORD,
    )
    const { error } = await client.from('items').insert({
      company_id: TEST_COMPANY_ID,
      name: 'Freelancer item',
      total_quantity: 1,
    })

    expect(error).toBeTruthy()
  })

  it('allows owner to read reserved items for capacity checks', async () => {
    const { client } = await signInTestUser(TEST_EMAIL, TEST_PASSWORD)
    const { data, error } = await client
      .from('reserved_items')
      .select('id, item_id, quantity, status')
      .limit(10)

    expect(error).toBeNull()
    expect(Array.isArray(data)).toBe(true)
  })
})

describeIntegration('reserve item golden path', () => {
  const admin = createServiceClient()
  let throwawayJobId: string | null = null
  let throwawayTimePeriodId: string | null = null
  let throwawayReservedItemId: string | null = null
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

  it('owner can reserve seeded item within capacity on a throwaway job', async () => {
    expect(ownerUserId).toBeTruthy()

    throwawayJobId = crypto.randomUUID()
    throwawayTimePeriodId = crypto.randomUUID()

    const { error: jobError } = await admin.from('jobs').insert({
      id: throwawayJobId,
      company_id: TEST_COMPANY_ID,
      title: `Reserve Golden Path ${Date.now()}`,
      status: 'planned',
      start_at: RESERVE_WINDOW.startAt,
      end_at: RESERVE_WINDOW.endAt,
      project_lead_user_id: ownerUserId!,
      jobnr: 999700 + Math.floor(Math.random() * 99),
    })
    expect(jobError).toBeNull()

    const { client } = await signInTestUser(TEST_EMAIL, TEST_PASSWORD)

    const { data: item, error: itemError } = await client
      .from('items')
      .select('total_quantity')
      .eq('id', TEST_ITEM_ID)
      .single()
    expect(itemError).toBeNull()
    expect(item?.total_quantity).toBeGreaterThanOrEqual(1)

    const { data: tp, error: tpError } = await client
      .from('time_periods')
      .insert({
        id: throwawayTimePeriodId,
        company_id: TEST_COMPANY_ID,
        job_id: throwawayJobId,
        title: 'Reserve test period',
        category: 'equipment',
        start_at: RESERVE_WINDOW.startAt,
        end_at: RESERVE_WINDOW.endAt,
      })
      .select('id')
      .single()
    expect(tpError).toBeNull()

    const reserveQty = 1
    expect(reserveQty).toBeLessThanOrEqual(item!.total_quantity!)

    const { data: reserved, error: riError } = await client
      .from('reserved_items')
      .insert({
        time_period_id: throwawayTimePeriodId!,
        item_id: TEST_ITEM_ID,
        quantity: reserveQty,
        status: 'planned',
        source_kind: 'direct',
        start_at: RESERVE_WINDOW.startAt,
        end_at: RESERVE_WINDOW.endAt,
      })
      .select('id, item_id, quantity')
      .single()

    expect(riError).toBeNull()
    expect(reserved?.item_id).toBe(TEST_ITEM_ID)
    expect(reserved?.quantity).toBe(reserveQty)
    throwawayReservedItemId = reserved?.id ?? null
  })

  it('cleans up throwaway reservation rows', async () => {
    if (throwawayReservedItemId) {
      const { error } = await admin
        .from('reserved_items')
        .delete()
        .eq('id', throwawayReservedItemId)
      expect(error).toBeNull()
    }
    if (throwawayTimePeriodId) {
      const { error } = await admin
        .from('time_periods')
        .delete()
        .eq('id', throwawayTimePeriodId)
      expect(error).toBeNull()
    }
    if (throwawayJobId) {
      const { error } = await admin
        .from('jobs')
        .delete()
        .eq('id', throwawayJobId)
      expect(error).toBeNull()
    }
  })
})
