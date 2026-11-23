/**
 * Seeds deterministic test users, company, job, offers, and a richer demo catalog
 * (inventory, vehicles, customers) for integration/E2E tests and hosted Dev.
 * Idempotent — safe to run multiple times after db reset / against hosted Dev.
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { loadLocalSupabaseEnv } from './loadLocalSupabaseEnv.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))

/** Load repo-root `.env.local` into process.env when keys are missing (hosted Dev). */
function loadEnvLocalFile() {
  const path = join(process.cwd(), '.env.local')
  if (!existsSync(path)) return
  for (const raw of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq <= 0) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (process.env[key] == null || process.env[key] === '') {
      process.env[key] = value
    }
  }
}

loadEnvLocalFile()

/** Keep in sync with `APP_VERSION` so "What's new" does not block E2E clicks. */
function readAppVersion() {
  const source = readFileSync(
    join(__dirname, '../src/app/config/releaseNotes.ts'),
    'utf8',
  )
  const match = source.match(/export const APP_VERSION = '([^']+)'/)
  if (!match) {
    throw new Error('Could not read APP_VERSION from releaseNotes.ts')
  }
  return match[1]
}

const APP_VERSION = readAppVersion()

export const TEST_IDS = {
  companyId: '11111111-1111-4111-8111-111111111111',
  jobId: '22222222-2222-4222-8222-222222222222',
  acceptJobId: '77777777-7777-4777-8777-777777777770',
  e2eJobId: '88888888-8888-4888-8888-888888888881',
  rejectJobId: '99999999-9999-4999-8999-999999999991',
  revisionJobId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  lockJobId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
  sentOfferId: '33333333-3333-4333-8333-333333333333',
  sentOfferBasisId: '33333333-3333-4333-8333-333333333330',
  draftOfferId: '44444444-4444-4444-8444-444444444444',
  draftOfferBasisId: '44444444-4444-4444-8444-444444444440',
  acceptOfferId: '77777777-7777-4777-8777-777777777777',
  acceptOfferBasisId: '77777777-7777-4777-8777-777777777772',
  e2eAcceptOfferId: '88888888-8888-4888-8888-888888888888',
  e2eAcceptOfferBasisId: '88888888-8888-4888-8888-888888888882',
  rejectOfferBasisId: 'cccccccc-cccc-4ccc-8ccc-ccccccccccc0',
  revisionOfferBasisId: 'dddddddd-dddd-4ddd-8ddd-ddddddddddd0',
  lockDraftOfferBasisId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee0',
  rejectOfferId: 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
  revisionOfferId: 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1',
  lockDraftOfferId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1',
  testItemId: 'ffffffff-ffff-4fff-8fff-fffffffffff1',
  testItemPriceId: 'ffffffff-ffff-4fff-8fff-fffffffffff2',
  contaCustomerId: 'cccccccc-cccc-4ccc-8ccc-ccccccccccc4',
  companyExpansionId: 'dddddddd-dddd-4ddd-8ddd-ddddddddddd4',
  conflictSeedJobId: '14141414-1414-4414-8414-141414141414',
  conflictTimePeriodId: '12121212-1212-4212-8212-121212121212',
  conflictReservedItemId: '13131313-1313-4313-8313-131313131313',
}

/** Extra demo catalog IDs (idempotent upserts; do not reuse E2E conflict item IDs). */
const DEMO_IDS = {
  catAudio: 'a1000001-0001-4001-8001-000000000001',
  catLighting: 'a1000001-0001-4001-8001-000000000002',
  catVideo: 'a1000001-0001-4001-8001-000000000003',
  catCables: 'a1000001-0001-4001-8001-000000000004',
  brandShure: 'a1000002-0002-4002-8002-000000000001',
  brandDb: 'a1000002-0002-4002-8002-000000000002',
  brandRobe: 'a1000002-0002-4002-8002-000000000003',
  brandBlackmagic: 'a1000002-0002-4002-8002-000000000004',
  itemSm58: 'a1000003-0003-4003-8003-000000000001',
  itemSm57: 'a1000003-0003-4003-8003-000000000002',
  itemDiBox: 'a1000003-0003-4003-8003-000000000003',
  itemXlr5: 'a1000003-0003-4003-8003-000000000004',
  itemXlr10: 'a1000003-0003-4003-8003-000000000005',
  itemQscK12: 'a1000003-0003-4003-8003-000000000006',
  itemSub: 'a1000003-0003-4003-8003-000000000007',
  itemMovingHead: 'a1000003-0003-4003-8003-000000000008',
  itemLedPar: 'a1000003-0003-4003-8003-000000000009',
  itemAtem: 'a1000003-0003-4003-8003-00000000000a',
  itemCamera: 'a1000003-0003-4003-8003-00000000000b',
  itemStand: 'a1000003-0003-4003-8003-00000000000c',
  groupFoh: 'a1000004-0004-4004-8004-000000000001',
  groupGi1: 'a1000004-0004-4004-8004-000000000011',
  groupGi2: 'a1000004-0004-4004-8004-000000000012',
  groupGi3: 'a1000004-0004-4004-8004-000000000013',
  vehicleVan: 'a1000005-0005-4005-8005-000000000001',
  vehicleCar: 'a1000005-0005-4005-8005-000000000002',
  vehicleTruck: 'a1000005-0005-4005-8005-000000000003',
  vehiclePersonal: 'a1000005-0005-4005-8005-000000000004',
  customerOslo: 'a1000006-0006-4006-8006-000000000001',
  customerBergen: 'a1000006-0006-4006-8006-000000000002',
  contactOslo: 'a1000007-0007-4007-8007-000000000001',
  contactBergen: 'a1000007-0007-4007-8007-000000000002',
  addressWarehouse: 'a1000008-0008-4008-8008-000000000001',
}

/** Conta-ready customer used by money-pipeline e2e / invoice preview. */
export const TEST_CONTA_CUSTOMER = {
  id: TEST_IDS.contaCustomerId,
  name: 'E2E Conta Customer',
  contaCustomerId: 424242,
  organizationId: 'e2e-test-org',
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
      // Required by isProfileComplete /complete-profile gate after OAuth work.
      phone: '+4712345678',
      selected_company_id: selectedCompanyId,
      superuser: false,
      // Mark current release as seen so WhatsNewPopover does not auto-open
      // and intercept pointer events during Playwright runs.
      last_seen_release_version: APP_VERSION,
    },
    { onConflict: 'user_id' },
  )
  if (error) throw error
}

async function upsertCompanyUser(
  companyId,
  userId,
  role,
  { rate = null, rateType = null } = {},
) {
  const { error } = await admin.from('company_users').upsert(
    {
      company_id: companyId,
      user_id: userId,
      role,
      rate,
      rate_type: rateType,
      rate_updated_at: rate != null ? new Date().toISOString() : null,
    },
    { onConflict: 'company_id,user_id' },
  )
  if (error) throw error
}

async function upsertItemWithPrice({
  id,
  name,
  quantity,
  amount,
  categoryId = null,
  brandId = null,
  model = null,
  itemKind = 'stock',
}) {
  const { error } = await admin.from('items').upsert(
    {
      id,
      company_id: TEST_IDS.companyId,
      name,
      model,
      total_quantity: quantity,
      category_id: categoryId,
      brand_id: brandId,
      item_kind: itemKind,
      active: true,
      deleted: false,
      allow_individual_booking: true,
    },
    { onConflict: 'id' },
  )
  if (error) throw error

  await admin
    .from('item_price_history')
    .update({ effective_to: new Date().toISOString() })
    .eq('item_id', id)
    .is('effective_to', null)

  const priceId = id.replace(/^a1000003/, 'a1000009')
  const { error: priceError } = await admin.from('item_price_history').upsert(
    {
      id: priceId,
      company_id: TEST_IDS.companyId,
      item_id: id,
      amount,
      effective_from: new Date().toISOString(),
      effective_to: null,
    },
    { onConflict: 'id' },
  )
  if (priceError) throw priceError
}

/**
 * Representative catalog so Dev UI is usable without copying Prod.
 * Does not change TEST_IDS.testItemId (qty 1) used by conflict/E2E tests.
 */
async function seedDemoCatalog(ownerId) {
  const categories = [
    { id: DEMO_IDS.catAudio, name: 'Audio' },
    { id: DEMO_IDS.catLighting, name: 'Lighting' },
    { id: DEMO_IDS.catVideo, name: 'Video' },
    { id: DEMO_IDS.catCables, name: 'Cables & stands' },
  ]
  for (const cat of categories) {
    const { error } = await admin
      .from('item_categories')
      .upsert(
        { id: cat.id, company_id: TEST_IDS.companyId, name: cat.name },
        { onConflict: 'id' },
      )
    if (error) throw error
  }

  const brands = [
    { id: DEMO_IDS.brandShure, name: 'Shure' },
    { id: DEMO_IDS.brandDb, name: 'd&b audiotechnik' },
    { id: DEMO_IDS.brandRobe, name: 'Robe' },
    { id: DEMO_IDS.brandBlackmagic, name: 'Blackmagic' },
  ]
  for (const brand of brands) {
    const { error } = await admin
      .from('item_brands')
      .upsert(
        { id: brand.id, company_id: TEST_IDS.companyId, name: brand.name },
        { onConflict: 'id' },
      )
    if (error) throw error
  }

  const items = [
    {
      id: DEMO_IDS.itemSm58,
      name: 'SM58',
      model: 'SM58',
      quantity: 24,
      amount: 85,
      categoryId: DEMO_IDS.catAudio,
      brandId: DEMO_IDS.brandShure,
    },
    {
      id: DEMO_IDS.itemSm57,
      name: 'SM57',
      model: 'SM57',
      quantity: 16,
      amount: 75,
      categoryId: DEMO_IDS.catAudio,
      brandId: DEMO_IDS.brandShure,
    },
    {
      id: DEMO_IDS.itemDiBox,
      name: 'Active DI box',
      quantity: 12,
      amount: 45,
      categoryId: DEMO_IDS.catAudio,
    },
    {
      id: DEMO_IDS.itemXlr5,
      name: 'XLR cable 5m',
      quantity: 80,
      amount: 12,
      categoryId: DEMO_IDS.catCables,
    },
    {
      id: DEMO_IDS.itemXlr10,
      name: 'XLR cable 10m',
      quantity: 40,
      amount: 18,
      categoryId: DEMO_IDS.catCables,
    },
    {
      id: DEMO_IDS.itemStand,
      name: 'Mic stand boom',
      quantity: 30,
      amount: 25,
      categoryId: DEMO_IDS.catCables,
    },
    {
      id: DEMO_IDS.itemQscK12,
      name: 'K12.2 powered speaker',
      model: 'K12.2',
      quantity: 8,
      amount: 450,
      categoryId: DEMO_IDS.catAudio,
      brandId: DEMO_IDS.brandDb,
    },
    {
      id: DEMO_IDS.itemSub,
      name: 'KS21 subwoofer',
      model: 'KS21',
      quantity: 4,
      amount: 900,
      categoryId: DEMO_IDS.catAudio,
      brandId: DEMO_IDS.brandDb,
    },
    {
      id: DEMO_IDS.itemMovingHead,
      name: 'MegaPointe',
      model: 'MegaPointe',
      quantity: 6,
      amount: 1200,
      categoryId: DEMO_IDS.catLighting,
      brandId: DEMO_IDS.brandRobe,
    },
    {
      id: DEMO_IDS.itemLedPar,
      name: 'LED PAR 64',
      quantity: 24,
      amount: 55,
      categoryId: DEMO_IDS.catLighting,
    },
    {
      id: DEMO_IDS.itemAtem,
      name: 'ATEM Mini Pro',
      model: 'ATEM Mini Pro',
      quantity: 2,
      amount: 700,
      categoryId: DEMO_IDS.catVideo,
      brandId: DEMO_IDS.brandBlackmagic,
    },
    {
      id: DEMO_IDS.itemCamera,
      name: 'Pocket Cinema 6K',
      model: 'Pocket 6K',
      quantity: 2,
      amount: 1800,
      categoryId: DEMO_IDS.catVideo,
      brandId: DEMO_IDS.brandBlackmagic,
    },
  ]
  for (const item of items) {
    await upsertItemWithPrice(item)
  }

  const { error: groupError } = await admin.from('item_groups').upsert(
    {
      id: DEMO_IDS.groupFoh,
      company_id: TEST_IDS.companyId,
      name: 'FOH PA package',
      description: '2× tops + 2× subs for small outdoor gigs',
      category_id: DEMO_IDS.catAudio,
      group_type: 'bundle',
      item_kind: 'stock',
      unique: false,
      active: true,
      deleted: false,
    },
    { onConflict: 'id' },
  )
  if (groupError) throw groupError

  const groupMembers = [
    { id: DEMO_IDS.groupGi1, itemId: DEMO_IDS.itemQscK12, quantity: 2 },
    { id: DEMO_IDS.groupGi2, itemId: DEMO_IDS.itemSub, quantity: 2 },
    { id: DEMO_IDS.groupGi3, itemId: DEMO_IDS.itemXlr10, quantity: 4 },
  ]
  for (const member of groupMembers) {
    const { error } = await admin.from('group_items').upsert(
      {
        id: member.id,
        group_id: DEMO_IDS.groupFoh,
        item_id: member.itemId,
        quantity: member.quantity,
      },
      { onConflict: 'id' },
    )
    if (error) throw error
  }

  const vehicles = [
    {
      id: DEMO_IDS.vehicleVan,
      name: 'Sprinter van',
      registration_no: 'EL12345',
      fuel: 'diesel',
      vehicle_category: 'van_medium',
      internally_owned: true,
    },
    {
      id: DEMO_IDS.vehicleCar,
      name: 'Crew car',
      registration_no: 'EL54321',
      fuel: 'petrol',
      vehicle_category: 'passenger_car_medium',
      internally_owned: true,
    },
    {
      id: DEMO_IDS.vehicleTruck,
      name: '18-pallet truck',
      registration_no: 'EL99999',
      fuel: 'diesel',
      vehicle_category: 'C',
      internally_owned: true,
    },
    {
      id: DEMO_IDS.vehiclePersonal,
      name: 'Owner EV',
      registration_no: 'EL77777',
      fuel: 'electric',
      vehicle_category: 'passenger_car_small',
      internally_owned: false,
      owner_user_id: ownerId,
    },
  ]
  for (const vehicle of vehicles) {
    const { error } = await admin.from('vehicles').upsert(
      {
        ...vehicle,
        company_id: TEST_IDS.companyId,
        active: true,
        deleted: false,
      },
      { onConflict: 'id' },
    )
    if (error) throw error
  }

  const { error: addrError } = await admin.from('addresses').upsert(
    {
      id: DEMO_IDS.addressWarehouse,
      company_id: TEST_IDS.companyId,
      name: 'Warehouse',
      address_line: 'Testveien 1',
      zip_code: '0150',
      city: 'Oslo',
      country: 'Norway',
      is_personal: false,
      deleted: false,
    },
    { onConflict: 'id' },
  )
  if (addrError) throw addrError

  const customers = [
    {
      id: DEMO_IDS.customerOslo,
      name: 'Oslo Festival AS',
      email: 'booking@oslofestival.test',
      contactId: DEMO_IDS.contactOslo,
      contactName: 'Kari Nordmann',
      contactEmail: 'kari@oslofestival.test',
      contactTitle: 'Producer',
    },
    {
      id: DEMO_IDS.customerBergen,
      name: 'Bergen Live',
      email: 'tech@bergenlive.test',
      contactId: DEMO_IDS.contactBergen,
      contactName: 'Ola Berg',
      contactEmail: 'ola@bergenlive.test',
      contactTitle: 'Tech lead',
    },
  ]
  for (const customer of customers) {
    const { error } = await admin.from('customers').upsert(
      {
        id: customer.id,
        company_id: TEST_IDS.companyId,
        name: customer.name,
        email: customer.email,
        deleted: false,
      },
      { onConflict: 'id' },
    )
    if (error) throw error

    const { error: contactError } = await admin.from('contacts').upsert(
      {
        id: customer.contactId,
        company_id: TEST_IDS.companyId,
        customer_id: customer.id,
        name: customer.contactName,
        email: customer.contactEmail,
        title: customer.contactTitle,
        phone: '+4790000000',
      },
      { onConflict: 'id' },
    )
    if (contactError) throw contactError
  }
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

async function seedOfferBasis({ id, jobId, title }) {
  const { error } = await admin.from('offer_bases').upsert(
    {
      id,
      job_id: jobId,
      company_id: TEST_IDS.companyId,
      title,
    },
    { onConflict: 'id' },
  )
  if (error) throw error
}

async function seedOffer({
  id,
  basisId,
  jobId,
  accessToken,
  status,
  locked,
  sentAt,
  versionNumber,
}) {
  const title = `Test Offer (${status})`
  await seedOfferBasis({ id: basisId, jobId, title: `${title} basis` })

  const { error } = await admin.from('job_offers').upsert(
    {
      id,
      job_id: jobId,
      company_id: TEST_IDS.companyId,
      offer_basis_id: basisId,
      offer_type: 'technical',
      version_number: versionNumber,
      status,
      access_token: accessToken,
      title,
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
      item_kind: 'stock',
      active: true,
      deleted: false,
    },
    { onConflict: 'id' },
  )
  if (error) throw error

  // Close any open price rows so the seeded list price is current.
  await admin
    .from('item_price_history')
    .update({ effective_to: new Date().toISOString() })
    .eq('item_id', TEST_IDS.testItemId)
    .is('effective_to', null)

  const { error: priceError } = await admin.from('item_price_history').upsert(
    {
      id: TEST_IDS.testItemPriceId,
      company_id: TEST_IDS.companyId,
      item_id: TEST_IDS.testItemId,
      amount: 1000,
      effective_from: new Date().toISOString(),
      effective_to: null,
    },
    { onConflict: 'id' },
  )
  if (priceError) throw priceError
}

async function seedContaConfig() {
  const { data: existingExpansion } = await admin
    .from('company_expansions')
    .select('id')
    .eq('company_id', TEST_IDS.companyId)
    .maybeSingle()

  const { error: expansionError } = await admin
    .from('company_expansions')
    .upsert(
      {
        id: existingExpansion?.id ?? TEST_IDS.companyExpansionId,
        company_id: TEST_IDS.companyId,
        accounting_software: 'conta',
        accounting_organization_id: TEST_CONTA_CUSTOMER.organizationId,
        accounting_api_read_only: false,
        accounting_api_environment: 'sandbox',
        default_invoice_days_until_due: 14,
        subcontractor_markup_percent: 0,
      },
      { onConflict: 'company_id' },
    )
  if (expansionError) throw expansionError

  const { error: customerError } = await admin.from('customers').upsert(
    {
      id: TEST_CONTA_CUSTOMER.id,
      company_id: TEST_IDS.companyId,
      name: TEST_CONTA_CUSTOMER.name,
      conta_customer_id: TEST_CONTA_CUSTOMER.contaCustomerId,
      // No vat_number → invoice send uses manual PDF path (no live EHF check).
      vat_number: null,
      email: 'conta-customer@test.grid.local',
      deleted: false,
    },
    { onConflict: 'id' },
  )
  if (customerError) throw customerError
}

async function seedEquipmentGroup(offerBasisId, groupId, itemId) {
  const { error: groupError } = await admin
    .from('offer_equipment_groups')
    .upsert(
      {
        id: groupId,
        offer_basis_id: offerBasisId,
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
  // Drop all bookings on the shared test item so integration leftovers cannot
  // exhaust capacity (total_quantity is 1).
  await admin.from('reserved_items').delete().eq('item_id', TEST_IDS.testItemId)
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
  await upsertCompanyUser(TEST_IDS.companyId, ownerId, 'owner', {
    rate: 950,
    rateType: 'daily',
  })
  await upsertProfile(
    freelancerId,
    TEST_CREDENTIALS.freelancerEmail,
    'Test Freelancer',
    TEST_IDS.companyId,
  )
  await upsertCompanyUser(TEST_IDS.companyId, freelancerId, 'freelancer', {
    rate: 750,
    rateType: 'daily',
  })
  await upsertProfile(
    employeeId,
    TEST_CREDENTIALS.employeeEmail,
    'Test Employee',
    TEST_IDS.companyId,
  )
  await upsertCompanyUser(TEST_IDS.companyId, employeeId, 'employee', {
    rate: 650,
    rateType: 'daily',
  })

  await seedTestItem()
  await seedDemoCatalog(ownerId)
  await seedContaConfig()

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
    basisId: TEST_IDS.sentOfferBasisId,
    jobId: TEST_IDS.jobId,
    accessToken: TEST_OFFER_TOKENS.sent,
    status: 'sent',
    locked: true,
    sentAt: now,
    versionNumber: 1,
  })
  await seedEquipmentGroup(
    TEST_IDS.sentOfferBasisId,
    '55555555-5555-4555-8555-555555555555',
    '66666666-6666-4666-8666-666666666666',
  )

  await seedOffer({
    id: TEST_IDS.draftOfferId,
    basisId: TEST_IDS.draftOfferBasisId,
    jobId: TEST_IDS.jobId,
    accessToken: TEST_OFFER_TOKENS.draft,
    status: 'draft',
    locked: false,
    sentAt: null,
    versionNumber: 2,
  })

  await seedOffer({
    id: TEST_IDS.acceptOfferId,
    basisId: TEST_IDS.acceptOfferBasisId,
    jobId: TEST_IDS.acceptJobId,
    accessToken: TEST_OFFER_TOKENS.accept,
    status: 'sent',
    locked: true,
    sentAt: now,
    versionNumber: 1,
  })
  await seedEquipmentGroup(
    TEST_IDS.acceptOfferBasisId,
    '77777777-7777-4777-8777-777777777778',
    '77777777-7777-4777-8777-777777777779',
  )

  await seedOffer({
    id: TEST_IDS.e2eAcceptOfferId,
    basisId: TEST_IDS.e2eAcceptOfferBasisId,
    jobId: TEST_IDS.e2eJobId,
    accessToken: TEST_OFFER_TOKENS.e2eAccept,
    status: 'sent',
    locked: true,
    sentAt: now,
    versionNumber: 1,
  })
  await seedEquipmentGroup(
    TEST_IDS.e2eAcceptOfferBasisId,
    '88888888-8888-4888-8888-888888888889',
    '88888888-8888-4888-8888-888888888880',
  )

  await seedOffer({
    id: TEST_IDS.rejectOfferId,
    basisId: TEST_IDS.rejectOfferBasisId,
    jobId: TEST_IDS.rejectJobId,
    accessToken: TEST_OFFER_TOKENS.reject,
    status: 'sent',
    locked: true,
    sentAt: now,
    versionNumber: 1,
  })
  await seedEquipmentGroup(
    TEST_IDS.rejectOfferBasisId,
    'cccccccc-cccc-4ccc-8ccc-ccccccccccc2',
    'cccccccc-cccc-4ccc-8ccc-ccccccccccc3',
  )

  await seedOffer({
    id: TEST_IDS.revisionOfferId,
    basisId: TEST_IDS.revisionOfferBasisId,
    jobId: TEST_IDS.revisionJobId,
    accessToken: TEST_OFFER_TOKENS.revision,
    status: 'sent',
    locked: true,
    sentAt: now,
    versionNumber: 1,
  })
  await seedEquipmentGroup(
    TEST_IDS.revisionOfferBasisId,
    'dddddddd-dddd-4ddd-8ddd-ddddddddddd2',
    'dddddddd-dddd-4ddd-8ddd-ddddddddddd3',
  )

  await seedOffer({
    id: TEST_IDS.lockDraftOfferId,
    basisId: TEST_IDS.lockDraftOfferBasisId,
    jobId: TEST_IDS.lockJobId,
    accessToken: TEST_OFFER_TOKENS.lockDraft,
    status: 'draft',
    locked: false,
    sentAt: null,
    versionNumber: 1,
  })
  await seedEquipmentGroup(
    TEST_IDS.lockDraftOfferBasisId,
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2',
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee3',
  )

  console.log('Test seed complete.')
  console.log(`  Owner: ${TEST_CREDENTIALS.ownerEmail}`)
  console.log(`  Employee: ${TEST_CREDENTIALS.employeeEmail}`)
  console.log(`  Freelancer: ${TEST_CREDENTIALS.freelancerEmail}`)
  console.log(`  Company: ${TEST_IDS.companyId}`)
  console.log(
    '  Demo catalog: 12 inventory items, 1 FOH bundle, 4 vehicles, 2 customers',
  )
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
