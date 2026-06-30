/**
 * Seeds deterministic test users, company, job, and offers for integration/E2E tests.
 * Idempotent — safe to run multiple times after db reset.
 */
import { createClient } from '@supabase/supabase-js'
import { loadLocalSupabaseEnv } from './loadLocalSupabaseEnv.mjs'

export const TEST_IDS = {
  companyId: '11111111-1111-4111-8111-111111111111',
  jobId: '22222222-2222-4222-8222-222222222222',
  acceptJobId: '77777777-7777-4777-8777-777777777770',
  e2eJobId: '88888888-8888-4888-8888-888888888881',
  rejectJobId: '99999999-9999-4999-8999-999999999991',
  revisionJobId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  lockJobId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
  sentOfferId: '33333333-3333-4333-8333-333333333333',
  draftOfferId: '44444444-4444-4444-8444-444444444444',
  rejectOfferId: 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
  revisionOfferId: 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1',
  lockDraftOfferId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1',
  testItemId: 'ffffffff-ffff-4fff-8fff-fffffffffff1',
  conflictSeedJobId: '14141414-1414-4414-8414-141414141414',
  conflictTimePeriodId: '12121212-1212-4212-8212-121212121212',
  conflictReservedItemId: '13131313-1313-4313-8313-131313131313',
}

/** Fixed overlap window on E2E Test Job for conflict / force-book tests. */
export const TEST_CONFLICT_BOOKING = {
  startAt: '2026-07-01T08:00:00.000Z',
  endAt: '2026-07-01T18:00:00.000Z',
}

export const TEST_CREDENTIALS = {
  ownerEmail: process.env.E2E_TEST_EMAIL ?? 'owner@test.grid.local',
  ownerPassword: process.env.E2E_TEST_PASSWORD ?? 'TestPassword123!',
  freelancerEmail: 'freelancer@test.grid.local',
  freelancerPassword: 'TestPassword123!',
  employeeEmail: 'employee@test.grid.local',
  employeePassword: 'TestPassword123!',
}

export const TEST_OFFER_TOKENS = {
  sent: 'e2e-test-sent-offer-token',
  draft: 'e2e-test-draft-offer-token',
  accept: 'e2e-test-accept-offer-token',
  e2eAccept: 'e2e-test-e2e-accept-offer-token',
  reject: 'e2e-test-reject-offer-token',
  revision: 'e2e-test-revision-offer-token',
  lockDraft: 'e2e-test-lock-draft-offer-token',
}

const loaded = loadLocalSupabaseEnv()
const SUPABASE_URL =
  loaded?.url ??
  process.env.SUPABASE_URL ??
  process.env.VITE_SUPABASE_URL ??
  'http://127.0.0.1:54321'
const SERVICE_ROLE_KEY =
  loaded?.serviceRoleKey ?? process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SERVICE_ROLE_KEY) {
  throw new Error(
    'SUPABASE_SERVICE_ROLE_KEY is required. Run `supabase start` and retry, or export keys from `supabase status -o env`.',
  )
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function ensureAuthUser(email, password, metadata = {}) {
  const { data: listed, error: listError } = await admin.auth.admin.listUsers({
    perPage: 1000,
  })
  if (listError) throw listError

  const existing = listed.users.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase(),
  )
  if (existing) {
    await admin.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
      user_metadata: metadata,
    })
    return existing.id
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: metadata,
  })
  if (error) throw error
  return data.user.id
}

async function upsertProfile(userId, email, displayName, selectedCompanyId) {
  const { error } = await admin.from('profiles').upsert(
    {
      user_id: userId,
      email,
      display_name: displayName,
      first_name: displayName.split(' ')[0],
      last_name: displayName.split(' ').slice(1).join(' ') || 'User',
      selected_company_id: selectedCompanyId,
      superuser: false,
    },
    { onConflict: 'user_id' },
  )
  if (error) throw error
}

async function upsertCompanyUser(companyId, userId, role) {
  const { error } = await admin
    .from('company_users')
    .upsert(
      { company_id: companyId, user_id: userId, role },
      { onConflict: 'company_id,user_id' },
    )
  if (error) throw error
}

async function seedCompany(ownerId) {
  const { error } = await admin.from('companies').upsert(
    {
      id: TEST_IDS.companyId,
      name: 'Grid Test Company',
      general_email: 'test@grid.local',
    },
    { onConflict: 'id' },
  )
  if (error) throw error

  await upsertCompanyUser(TEST_IDS.companyId, ownerId, 'owner')
}

async function seedJob({ id, title, jobnr, ownerId }) {
  const startAt = new Date()
  startAt.setDate(startAt.getDate() + 7)
  const endAt = new Date(startAt)
  endAt.setDate(endAt.getDate() + 2)

  const { error } = await admin.from('jobs').upsert(
    {
      id,
      company_id: TEST_IDS.companyId,
      title,
      description: 'Seeded job for automated tests',
      status: 'planned',
      start_at: startAt.toISOString(),
      end_at: endAt.toISOString(),
      project_lead_user_id: ownerId,
      jobnr,
    },
    { onConflict: 'id' },
  )
  if (error) throw error
}

async function seedOffer({
  id,
  jobId,
  accessToken,
  status,
  locked,
  sentAt,
  versionNumber,
}) {
  const { error } = await admin.from('job_offers').upsert(
    {
      id,
      job_id: jobId,
      company_id: TEST_IDS.companyId,
      offer_type: 'technical',
      version_number: versionNumber,
      status,
      access_token: accessToken,
      title: `Test Offer (${status})`,
      days_of_use: 3,
      discount_percent: 0,
      vat_percent: 25,
      equipment_subtotal: 1000,
      crew_subtotal: 0,
      transport_subtotal: 0,
      total_before_discount: 1000,
      total_after_discount: 1000,
      total_with_vat: 1250,
      locked,
      sent_at: sentAt,
      show_price_per_line: true,
    },
    { onConflict: 'id' },
  )
  if (error) throw error
}

async function seedTestItem() {
  const { error } = await admin.from('items').upsert(
    {
      id: TEST_IDS.testItemId,
      company_id: TEST_IDS.companyId,
      name: 'Test Seeded Item',
      total_quantity: 1,
      internally_owned: true,
      active: true,
      deleted: false,
    },
    { onConflict: 'id' },
  )
  if (error) throw error
}

async function seedEquipmentGroup(offerId, groupId, itemId) {
  const { error: groupError } = await admin
    .from('offer_equipment_groups')
    .upsert(
      {
        id: groupId,
        offer_id: offerId,
        group_name: 'Test Equipment',
        sort_order: 0,
      },
      { onConflict: 'id' },
    )
  if (groupError) throw groupError

  const { error: itemError } = await admin.from('offer_equipment_items').upsert(
    {
      id: itemId,
      offer_group_id: groupId,
      item_id: null,
      group_id: null,
      quantity: 1,
      unit_price: 1000,
      total_price: 1000,
      is_internal: true,
      sort_order: 0,
      custom_line_description: 'Test microphone',
    },
    { onConflict: 'id' },
  )
  if (itemError) throw itemError
}

async function seedConflictBooking(ownerId) {
  await admin
    .from('reserved_items')
    .delete()
    .eq('id', TEST_IDS.conflictReservedItemId)
  await admin
    .from('time_periods')
    .delete()
    .eq('id', TEST_IDS.conflictTimePeriodId)

  const { error: jobError } = await admin.from('jobs').upsert(
    {
      id: TEST_IDS.conflictSeedJobId,
      company_id: TEST_IDS.companyId,
      title: 'Conflict Seed Job',
      description: 'Seeded job for overlap / force-book tests',
      status: 'planned',
      start_at: TEST_CONFLICT_BOOKING.startAt,
      end_at: TEST_CONFLICT_BOOKING.endAt,
      project_lead_user_id: ownerId,
      jobnr: 999010,
    },
    { onConflict: 'id' },
  )
  if (jobError) throw jobError

  const { error: tpError } = await admin.from('time_periods').upsert(
    {
      id: TEST_IDS.conflictTimePeriodId,
      company_id: TEST_IDS.companyId,
      job_id: TEST_IDS.conflictSeedJobId,
      title: 'Equipment period',
      category: 'equipment',
      start_at: TEST_CONFLICT_BOOKING.startAt,
      end_at: TEST_CONFLICT_BOOKING.endAt,
      reserved_by_user_id: ownerId,
      deleted: false,
    },
    { onConflict: 'id' },
  )
  if (tpError) throw tpError

  const { error: riError } = await admin.from('reserved_items').upsert(
    {
      id: TEST_IDS.conflictReservedItemId,
      time_period_id: TEST_IDS.conflictTimePeriodId,
      item_id: TEST_IDS.testItemId,
      quantity: 1,
      status: 'planned',
      source_kind: 'direct',
      start_at: TEST_CONFLICT_BOOKING.startAt,
      end_at: TEST_CONFLICT_BOOKING.endAt,
      forced: false,
      forced_at: null,
      forced_by_user_id: null,
    },
    { onConflict: 'id' },
  )
  if (riError) throw riError
}

/** Keep E2E Test Job free of equipment bookings so job_copy tests stay stable. */
async function cleanupE2eJobEquipmentBookings() {
  const { data: periods } = await admin
    .from('time_periods')
    .select('id')
    .eq('job_id', TEST_IDS.jobId)
    .eq('category', 'equipment')

  if (!periods?.length) return

  const periodIds = periods.map((p) => p.id)
  await admin.from('reserved_items').delete().in('time_period_id', periodIds)
  await admin.from('time_periods').delete().in('id', periodIds)
}

async function main() {
  console.log('Seeding test users and data…')

  const ownerId = await ensureAuthUser(
    TEST_CREDENTIALS.ownerEmail,
    TEST_CREDENTIALS.ownerPassword,
    { display_name: 'Test Owner' },
  )
  const freelancerId = await ensureAuthUser(
    TEST_CREDENTIALS.freelancerEmail,
    TEST_CREDENTIALS.freelancerPassword,
    { display_name: 'Test Freelancer' },
  )
  const employeeId = await ensureAuthUser(
    TEST_CREDENTIALS.employeeEmail,
    TEST_CREDENTIALS.employeePassword,
    { display_name: 'Test Employee' },
  )

  await seedCompany(ownerId)
  await upsertProfile(
    ownerId,
    TEST_CREDENTIALS.ownerEmail,
    'Test Owner',
    TEST_IDS.companyId,
  )
  await upsertProfile(
    freelancerId,
    TEST_CREDENTIALS.freelancerEmail,
    'Test Freelancer',
    TEST_IDS.companyId,
  )
  await upsertCompanyUser(TEST_IDS.companyId, freelancerId, 'freelancer')
  await upsertProfile(
    employeeId,
    TEST_CREDENTIALS.employeeEmail,
    'Test Employee',
    TEST_IDS.companyId,
  )
  await upsertCompanyUser(TEST_IDS.companyId, employeeId, 'employee')

  await seedTestItem()

  await seedJob({
    id: TEST_IDS.jobId,
    title: 'E2E Test Job',
    jobnr: 999001,
    ownerId,
  })
  await seedConflictBooking(ownerId)
  await cleanupE2eJobEquipmentBookings()
  await seedJob({
    id: TEST_IDS.acceptJobId,
    title: 'Integration Accept Job',
    jobnr: 999002,
    ownerId,
  })
  await seedJob({
    id: TEST_IDS.e2eJobId,
    title: 'E2E Accept Job',
    jobnr: 999003,
    ownerId,
  })
  await seedJob({
    id: TEST_IDS.rejectJobId,
    title: 'E2E Reject Job',
    jobnr: 999004,
    ownerId,
  })
  await seedJob({
    id: TEST_IDS.revisionJobId,
    title: 'E2E Revision Job',
    jobnr: 999005,
    ownerId,
  })
  await seedJob({
    id: TEST_IDS.lockJobId,
    title: 'E2E Lock Job',
    jobnr: 999006,
    ownerId,
  })

  const now = new Date().toISOString()

  await seedOffer({
    id: TEST_IDS.sentOfferId,
    jobId: TEST_IDS.jobId,
    accessToken: TEST_OFFER_TOKENS.sent,
    status: 'sent',
    locked: true,
    sentAt: now,
    versionNumber: 1,
  })
  await seedEquipmentGroup(
    TEST_IDS.sentOfferId,
    '55555555-5555-4555-8555-555555555555',
    '66666666-6666-4666-8666-666666666666',
  )

  await seedOffer({
    id: TEST_IDS.draftOfferId,
    jobId: TEST_IDS.jobId,
    accessToken: TEST_OFFER_TOKENS.draft,
    status: 'draft',
    locked: false,
    sentAt: null,
    versionNumber: 2,
  })

  await seedOffer({
    id: '77777777-7777-4777-8777-777777777777',
    jobId: TEST_IDS.acceptJobId,
    accessToken: TEST_OFFER_TOKENS.accept,
    status: 'sent',
    locked: true,
    sentAt: now,
    versionNumber: 1,
  })
  await seedEquipmentGroup(
    '77777777-7777-4777-8777-777777777777',
    '77777777-7777-4777-8777-777777777778',
    '77777777-7777-4777-8777-777777777779',
  )

  await seedOffer({
    id: '88888888-8888-4888-8888-888888888888',
    jobId: TEST_IDS.e2eJobId,
    accessToken: TEST_OFFER_TOKENS.e2eAccept,
    status: 'sent',
    locked: true,
    sentAt: now,
    versionNumber: 1,
  })
  await seedEquipmentGroup(
    '88888888-8888-4888-8888-888888888888',
    '88888888-8888-4888-8888-888888888889',
    '88888888-8888-4888-8888-888888888880',
  )

  await seedOffer({
    id: TEST_IDS.rejectOfferId,
    jobId: TEST_IDS.rejectJobId,
    accessToken: TEST_OFFER_TOKENS.reject,
    status: 'sent',
    locked: true,
    sentAt: now,
    versionNumber: 1,
  })
  await seedEquipmentGroup(
    TEST_IDS.rejectOfferId,
    'cccccccc-cccc-4ccc-8ccc-ccccccccccc2',
    'cccccccc-cccc-4ccc-8ccc-ccccccccccc3',
  )

  await seedOffer({
    id: TEST_IDS.revisionOfferId,
    jobId: TEST_IDS.revisionJobId,
    accessToken: TEST_OFFER_TOKENS.revision,
    status: 'sent',
    locked: true,
    sentAt: now,
    versionNumber: 1,
  })
  await seedEquipmentGroup(
    TEST_IDS.revisionOfferId,
    'dddddddd-dddd-4ddd-8ddd-ddddddddddd2',
    'dddddddd-dddd-4ddd-8ddd-ddddddddddd3',
  )

  await seedOffer({
    id: TEST_IDS.lockDraftOfferId,
    jobId: TEST_IDS.lockJobId,
    accessToken: TEST_OFFER_TOKENS.lockDraft,
    status: 'draft',
    locked: false,
    sentAt: null,
    versionNumber: 1,
  })
  await seedEquipmentGroup(
    TEST_IDS.lockDraftOfferId,
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2',
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee3',
  )

  console.log('Test seed complete.')
  console.log(`  Owner: ${TEST_CREDENTIALS.ownerEmail}`)
  console.log(`  Employee: ${TEST_CREDENTIALS.employeeEmail}`)
  console.log(`  Freelancer: ${TEST_CREDENTIALS.freelancerEmail}`)
  console.log(`  Company: ${TEST_IDS.companyId}`)
  console.log(`  Sent offer token: ${TEST_OFFER_TOKENS.sent}`)
  console.log(`  Accept offer token: ${TEST_OFFER_TOKENS.accept}`)
  console.log(`  Reject offer token: ${TEST_OFFER_TOKENS.reject}`)
  console.log(`  Revision offer token: ${TEST_OFFER_TOKENS.revision}`)
  console.log(
    `  Conflict booking: ${TEST_IDS.testItemId} on job ${TEST_IDS.conflictSeedJobId} (${TEST_CONFLICT_BOOKING.startAt} – ${TEST_CONFLICT_BOOKING.endAt})`,
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
