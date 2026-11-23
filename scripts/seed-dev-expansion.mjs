/**
 * Expands hosted Dev (Grid Test Company) with varied jobs, money ledger,
 * crew bookings + org numbers, Conta-linked invoices, time entries, and
 * queue fodder (ready-to-invoice / accounting-unverified).
 *
 * Idempotent: only upserts fixed IDs in the `b2……` namespace. Does not delete
 * John's intentional Dev rows outside that namespace.
 *
 * Prerequisites:
 *   npm run db:seed-test-users   # company + owner/employee/freelancer
 *   npm run db:seed-dev-expansion
 *
 * Safety: refuses Prod (see `PROD_PROJECT_REF` in supabase-targets.mjs).
 *
 * Optional: SEED_WIPE=1 deletes only our b2…… rows before re-upsert
 * (still leaves non-seed Dev data alone).
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { loadLocalSupabaseEnv } from './loadLocalSupabaseEnv.mjs'
import { PROD_PROJECT_REF } from './supabase-targets.mjs'

const COMPANY_ID = '11111111-1111-4111-8111-111111111111'
const DEMO_CUSTOMER_OSLO = 'a1000006-0006-4006-8006-000000000001'
const DEMO_CUSTOMER_BERGEN = 'a1000006-0006-4006-8006-000000000002'
const CONTA_CUSTOMER_ID = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc4'
const CONTA_ORG_ID = 'e2e-test-org'

const OWNER_EMAIL = process.env.E2E_TEST_EMAIL ?? 'owner@test.grid.local'
const FREELANCER_EMAIL = 'freelancer@test.grid.local'
const EMPLOYEE_EMAIL = 'employee@test.grid.local'

/**
 * John's real Prod login email (confirmed read-only on Prod Auth/profiles).
 * Dev Auth is a separate user store — Prod password does NOT apply here.
 * Override password with DEV_JOHN_PASSWORD if desired.
 */
const JOHN_DEV_EMAIL = process.env.DEV_JOHN_EMAIL ?? 'john.ravndal@gmail.com'
const JOHN_DEV_PASSWORD = process.env.DEV_JOHN_PASSWORD ?? 'TestPassword123!'
const JOHN_DEV_NAME = 'John Ravndal'

/** Deterministic UUID in the expansion namespace (never collide with E2E/demo). */
function sid(kind, n) {
  const k = String(kind).padStart(4, '0')
  const i = String(n).padStart(12, '0')
  // 8-4-4-4-12 — kind embedded so wipe/upsert stays namespaced
  return `b2${k}00-${k}-4${k.slice(1)}-8${k.slice(1)}-${i}`
}

const IDS = {
  customers: {
    stavanger: sid(1, 1),
    trondheim: sid(1, 2),
    kristiansand: sid(1, 3),
    partner: sid(1, 4),
  },
  contacts: {
    stavanger: sid(11, 1),
    trondheim: sid(11, 2),
    kristiansand: sid(11, 3),
    partner: sid(11, 4),
  },
  freelancers: [
    {
      email: 'freelancer2@test.grid.local',
      name: 'Ada Freelancer',
      vat: '918273645',
      rate: 820,
      metaKey: 'fl2',
    },
    {
      email: 'freelancer3@test.grid.local',
      name: 'Bjørn Tech',
      vat: '912345678',
      rate: 700,
      metaKey: 'fl3',
    },
    {
      email: 'freelancer4@test.grid.local',
      name: 'Cecilie Sound',
      vat: '998877665',
      rate: 900,
      metaKey: 'fl4',
    },
  ],
}

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
const loaded = loadLocalSupabaseEnv()

const SUPABASE_URL =
  loaded?.url ?? process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? ''
const SERVICE_ROLE_KEY =
  loaded?.serviceRoleKey ?? process.env.SUPABASE_SERVICE_ROLE_KEY
const PROJECT_REF =
  process.env.SUPABASE_PROJECT_REF ??
  SUPABASE_URL.match(/https?:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1] ??
  ''

if (!SERVICE_ROLE_KEY || !SUPABASE_URL) {
  throw new Error(
    'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY required (Dev secrets or .env.local).',
  )
}

if (
  PROJECT_REF === PROD_PROJECT_REF ||
  SUPABASE_URL.includes(PROD_PROJECT_REF)
) {
  throw new Error(
    `Refusing to seed Prod (${PROD_PROJECT_REF}). Use hosted Dev secrets only.`,
  )
}

if (
  !SUPABASE_URL.includes('.supabase.co') &&
  !SUPABASE_URL.includes('127.0.0.1')
) {
  console.warn(
    `Warning: unexpected Supabase URL host — expected hosted Dev or local. Continuing because URL is not Prod.`,
  )
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const WIPE = process.env.SEED_WIPE === '1' || process.argv.includes('--wipe')

function isoDaysFrom(base, dayOffset, hour = 10) {
  const d = new Date(base)
  d.setUTCDate(d.getUTCDate() + dayOffset)
  d.setUTCHours(hour, 0, 0, 0)
  return d.toISOString()
}

function monthStart(year, monthIndex /* 0-based */) {
  return new Date(Date.UTC(year, monthIndex, 5, 10, 0, 0))
}

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

function readAppVersion() {
  try {
    const source = readFileSync(
      join(process.cwd(), 'src/app/config/releaseNotes.ts'),
      'utf8',
    )
    const match = source.match(/export const APP_VERSION = '([^']+)'/)
    return match?.[1] ?? null
  } catch {
    return null
  }
}

async function upsertProfile(
  userId,
  email,
  displayName,
  { superuser = false } = {},
) {
  const appVersion = readAppVersion()
  const { error } = await admin.from('profiles').upsert(
    {
      user_id: userId,
      email,
      display_name: displayName,
      first_name: displayName.split(' ')[0],
      last_name: displayName.split(' ').slice(1).join(' ') || 'User',
      phone: '+4712345678',
      selected_company_id: COMPANY_ID,
      superuser,
      ...(appVersion ? { last_seen_release_version: appVersion } : {}),
    },
    { onConflict: 'user_id' },
  )
  if (error) throw error
}

/**
 * Ensure John's real email can sign into hosted Dev and own Grid Test Company.
 * Does not copy Prod password — Dev Auth is separate.
 */
async function seedJohnDevOwner() {
  const userId = await ensureAuthUser(JOHN_DEV_EMAIL, JOHN_DEV_PASSWORD, {
    display_name: JOHN_DEV_NAME,
  })
  await upsertProfile(userId, JOHN_DEV_EMAIL, JOHN_DEV_NAME, {
    superuser: true,
  })
  await upsertCompanyUser(userId, 'owner', {
    rate: 950,
    rateType: 'daily',
  })
  return userId
}

async function upsertCompanyUser(
  userId,
  role,
  { rate = null, rateType = null, vatNumber = null } = {},
) {
  const { error } = await admin.from('company_users').upsert(
    {
      company_id: COMPANY_ID,
      user_id: userId,
      role,
      rate,
      rate_type: rateType,
      rate_updated_at: rate != null ? new Date().toISOString() : null,
      vat_number: vatNumber,
    },
    { onConflict: 'company_id,user_id' },
  )
  if (error) throw error
}

async function findUserIdByEmail(email) {
  const { data: listed, error } = await admin.auth.admin.listUsers({
    perPage: 1000,
  })
  if (error) throw error
  const user = listed.users.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase(),
  )
  if (!user) {
    throw new Error(
      `Missing auth user ${email}. Run npm run db:seed-test-users first.`,
    )
  }
  return user.id
}

async function assertCompany() {
  const { data, error } = await admin
    .from('companies')
    .select('id, name')
    .eq('id', COMPANY_ID)
    .maybeSingle()
  if (error) throw error
  if (!data) {
    throw new Error(
      'Grid Test Company missing. Run npm run db:seed-test-users first.',
    )
  }
}

/** Job catalog — varied statuses, months, money/crew/invoice flags. */
function buildJobCatalog() {
  const jobs = []
  let jobnr = 880001
  let idx = 1

  const push = (spec) => {
    const id = sid(2, idx)
    jobs.push({ id, jobnr: jobnr++, ...spec })
    idx += 1
  }

  // Verified paid jobs across 2024–2026 for Reporting / monthly P&L
  const verifiedMonths = [
    [2024, 2],
    [2024, 5],
    [2024, 8],
    [2024, 10],
    [2025, 0],
    [2025, 2],
    [2025, 4],
    [2025, 6],
    [2025, 8],
    [2025, 10],
    [2026, 0],
    [2026, 2],
    [2026, 4],
    [2026, 6],
    [2026, 8],
  ]
  for (const [y, m] of verifiedMonths) {
    const start = monthStart(y, m)
    push({
      title: `Verified ${y}-${String(m + 1).padStart(2, '0')} Festival`,
      status: 'paid',
      startAt: start.toISOString(),
      endAt: isoDaysFrom(start, 2, 22),
      customerKey: m % 2 === 0 ? 'oslo' : 'bergen',
      money: 'full',
      verified: true,
      crew: true,
      invoice: true,
      km: 120 + m * 10,
      income: 45000 + m * 1500,
      crewCost: 12000 + m * 400,
      equipmentCost: 8000 + m * 200,
      transportCost: 600 + m * 20,
      contaCost: m % 3 === 0 ? 3500 : 0,
    })
  }

  // Invoiced/paid unverified → Accounting ready-to-verify queue
  const unverifiedSpecs = [
    {
      title: 'Unverified Invoice — Opera Gala',
      status: 'invoiced',
      monthsAgo: 1,
    },
    {
      title: 'Unverified Invoice — Corporate Townhall',
      status: 'invoiced',
      monthsAgo: 2,
    },
    { title: 'Unverified Paid — Outdoor Stage', status: 'paid', monthsAgo: 3 },
    { title: 'Unverified Paid — Conference AV', status: 'paid', monthsAgo: 4 },
    {
      title: 'Unverified Invoice — Theatre Tour',
      status: 'invoiced',
      monthsAgo: 5,
    },
    {
      title: 'Unverified Paid — Brand Activation',
      status: 'paid',
      monthsAgo: 6,
    },
  ]
  for (const spec of unverifiedSpecs) {
    const start = new Date()
    start.setUTCMonth(start.getUTCMonth() - spec.monthsAgo)
    start.setUTCDate(8)
    start.setUTCHours(9, 0, 0, 0)
    push({
      title: spec.title,
      status: spec.status,
      startAt: start.toISOString(),
      endAt: isoDaysFrom(start, 1, 20),
      customerKey: 'conta',
      money: 'full',
      verified: false,
      crew: true,
      invoice: true,
      km: 80,
      income: 32000,
      crewCost: 9000,
      equipmentCost: 5000,
      transportCost: 400,
      contaCost: 2200,
    })
  }

  // Completed → ready-to-invoice queue
  for (let i = 0; i < 5; i++) {
    const start = new Date()
    start.setUTCDate(start.getUTCDate() - (3 + i * 4))
    start.setUTCHours(8, 0, 0, 0)
    push({
      title: `Ready Invoice ${i + 1} — Wrap Day`,
      status: 'completed',
      startAt: start.toISOString(),
      endAt: isoDaysFrom(start, 1, 18),
      customerKey: i % 2 === 0 ? 'stavanger' : 'trondheim',
      money: 'partial',
      verified: false,
      crew: true,
      invoice: false,
      km: 40,
      income: 0,
      crewCost: 4500,
      equipmentCost: 0,
      transportCost: 200,
      contaCost: 0,
    })
  }

  // Active / pipeline statuses for Jobs filters + search
  const pipeline = [
    { title: 'Draft Lead — Winter Market', status: 'draft', days: 40 },
    { title: 'Requested Lead — Museum Install', status: 'requested', days: 25 },
    { title: 'Planned — City Square Concert', status: 'planned', days: 14 },
    { title: 'Confirmed — Sports Arena', status: 'confirmed', days: 10 },
    {
      title: 'In Progress — Nightclub Residency',
      status: 'in_progress',
      days: -1,
    },
    { title: 'Canceled — Rainout Outdoor', status: 'canceled', days: -20 },
    { title: 'Search Alpha — Nordlys Stage', status: 'confirmed', days: 21 },
    { title: 'Search Beta — Fjord Film Shoot', status: 'planned', days: 28 },
  ]
  for (const p of pipeline) {
    const start = new Date()
    start.setUTCDate(start.getUTCDate() + p.days)
    start.setUTCHours(10, 0, 0, 0)
    push({
      title: p.title,
      status: p.status,
      startAt: start.toISOString(),
      endAt: isoDaysFrom(start, 2, 22),
      customerKey: 'kristiansand',
      money: p.status === 'in_progress' ? 'partial' : 'none',
      verified: false,
      crew: ['confirmed', 'in_progress', 'planned'].includes(p.status),
      invoice: false,
      km: null,
      income: 0,
      crewCost: 0,
      equipmentCost: 0,
      transportCost: 0,
      contaCost: 0,
    })
  }

  // Logging-friendly: today ± window with searchable titles
  for (let i = 0; i < 4; i++) {
    const start = new Date()
    start.setUTCDate(start.getUTCDate() - i)
    start.setUTCHours(7, 0, 0, 0)
    push({
      title: `Logging Job ${i + 1} — Daily Call`,
      status: i === 0 ? 'in_progress' : 'completed',
      startAt: start.toISOString(),
      endAt: isoDaysFrom(start, 0, 19),
      customerKey: 'partner',
      money: 'none',
      verified: false,
      crew: true,
      invoice: false,
      logging: true,
      km: null,
      income: 0,
      crewCost: 0,
      equipmentCost: 0,
      transportCost: 0,
      contaCost: 0,
    })
  }

  return jobs
}

async function seedCustomers() {
  const rows = [
    {
      id: IDS.customers.stavanger,
      name: 'Stavanger Events AS',
      email: 'book@stavangerevents.test',
      vat_number: '921000001',
      conta_customer_id: 500001,
      contactId: IDS.contacts.stavanger,
      contactName: 'Per Strand',
    },
    {
      id: IDS.customers.trondheim,
      name: 'Trondheim Kultur',
      email: 'tech@trondheimkultur.test',
      vat_number: '921000002',
      conta_customer_id: null,
      contactId: IDS.contacts.trondheim,
      contactName: 'Ingrid Fjord',
    },
    {
      id: IDS.customers.kristiansand,
      name: 'Sørland Festivals',
      email: 'crew@sorlandfest.test',
      vat_number: '921000003',
      conta_customer_id: 500003,
      contactId: IDS.contacts.kristiansand,
      contactName: 'Lars Sør',
    },
    {
      id: IDS.customers.partner,
      name: 'Partner Productions',
      email: 'ops@partnerprod.test',
      vat_number: '921000004',
      conta_customer_id: null,
      contactId: IDS.contacts.partner,
      contactName: 'Mia Partner',
      is_partner: true,
    },
  ]

  for (const c of rows) {
    const { error } = await admin.from('customers').upsert(
      {
        id: c.id,
        company_id: COMPANY_ID,
        name: c.name,
        email: c.email,
        vat_number: c.vat_number,
        conta_customer_id: c.conta_customer_id,
        is_partner: c.is_partner ?? false,
        deleted: false,
      },
      { onConflict: 'id' },
    )
    if (error) throw error

    const { error: contactError } = await admin.from('contacts').upsert(
      {
        id: c.contactId,
        company_id: COMPANY_ID,
        customer_id: c.id,
        name: c.contactName,
        email: c.email,
        phone: '+4791112233',
        title: 'Producer',
      },
      { onConflict: 'id' },
    )
    if (contactError) throw contactError
  }

  // Give demo customers org numbers for Conta/EHF testing
  for (const [id, vat] of [
    [DEMO_CUSTOMER_OSLO, '919999001'],
    [DEMO_CUSTOMER_BERGEN, '919999002'],
    [CONTA_CUSTOMER_ID, '919999042'],
  ]) {
    const { error } = await admin
      .from('customers')
      .update({ vat_number: vat })
      .eq('id', id)
      .eq('company_id', COMPANY_ID)
    if (error) throw error
  }
}

function resolveCustomerId(key) {
  switch (key) {
    case 'oslo':
      return DEMO_CUSTOMER_OSLO
    case 'bergen':
      return DEMO_CUSTOMER_BERGEN
    case 'conta':
      return CONTA_CUSTOMER_ID
    case 'stavanger':
      return IDS.customers.stavanger
    case 'trondheim':
      return IDS.customers.trondheim
    case 'kristiansand':
      return IDS.customers.kristiansand
    case 'partner':
      return IDS.customers.partner
    default:
      return DEMO_CUSTOMER_OSLO
  }
}

async function wipeSeedNamespace(jobIds) {
  console.log('SEED_WIPE=1 — deleting expansion-namespace rows only…')
  if (jobIds.length) {
    await admin.from('job_money_items').delete().in('job_id', jobIds)
    await admin.from('job_invoices').delete().in('job_id', jobIds)
    await admin.from('time_entries').delete().in('job_id', jobIds)

    const { data: periods } = await admin
      .from('time_periods')
      .select('id')
      .in('job_id', jobIds)
    const periodIds = (periods ?? []).map((p) => p.id)
    if (periodIds.length) {
      await admin.from('reserved_crew').delete().in('time_period_id', periodIds)
      await admin.from('time_periods').delete().in('id', periodIds)
    }
    await admin.from('jobs').delete().in('id', jobIds)
  }

  const customerIds = Object.values(IDS.customers)
  await admin.from('contacts').delete().in('id', Object.values(IDS.contacts))
  await admin.from('customers').delete().in('id', customerIds)
}

async function seedJobs(jobs, ownerId, employeeId) {
  for (const job of jobs) {
    // Queue jobs (completed / unverified invoiced|paid) stay on owner so
    // ready-to-invoice + accounting-unverified counters show for login owner.
    const queueJob =
      job.status === 'completed' ||
      ((job.status === 'invoiced' || job.status === 'paid') && !job.verified)
    const lead = queueJob ? ownerId : job.jobnr % 7 === 0 ? employeeId : ownerId
    const { error } = await admin.from('jobs').upsert(
      {
        id: job.id,
        company_id: COMPANY_ID,
        title: job.title,
        description: `Dev expansion seed (${job.status}). Safe to re-run.`,
        status: job.status,
        start_at: job.startAt,
        end_at: job.endAt,
        project_lead_user_id: lead,
        customer_id: resolveCustomerId(job.customerKey),
        jobnr: job.jobnr,
        archived: false,
        transport_km_driven: job.km,
        invoice_basis: job.invoice ? 'offer' : null,
        // verified set after money items (trigger clears on ledger writes)
        money_verified_at: null,
        money_verified_by: null,
      },
      { onConflict: 'id' },
    )
    if (error) throw error
  }
}

async function seedMoneyItems(jobs) {
  let moneyIdx = 1
  for (const job of jobs) {
    if (job.money === 'none') continue

    const lines = []
    if (job.income > 0) {
      lines.push({
        type: 'income',
        description: `Invoice income — ${job.title}`,
        amount: job.income,
        source: job.invoice ? 'conta' : 'offer',
        category: 'other',
        reference: job.invoice ? `INV-${job.jobnr}` : `OFFER-${job.jobnr}`,
      })
    }
    if (job.crewCost > 0) {
      lines.push({
        type: 'expense',
        description: 'Crew cost (freelancer + employee)',
        amount: job.crewCost,
        source: 'crew',
        category: 'crew',
        reference: null,
      })
    }
    if (job.equipmentCost > 0) {
      lines.push({
        type: 'expense',
        description: 'Equipment / subrental',
        amount: job.equipmentCost,
        source: 'manual',
        category: 'equipment',
        reference: null,
      })
    }
    if (job.transportCost > 0) {
      lines.push({
        type: 'expense',
        description: 'Transport cost',
        amount: job.transportCost,
        source: 'manual',
        category: 'transport',
        reference: null,
      })
    }
    if (job.contaCost > 0) {
      lines.push({
        type: 'expense',
        description: 'Conta supplier invoice',
        amount: job.contaCost,
        source: 'conta',
        category: 'conta',
        reference: `SUP-${job.jobnr}`,
      })
    }
    if (job.money === 'partial' && job.income === 0 && job.crewCost > 0) {
      // already have crew line — enough for incomplete accounting UX
    }

    for (const line of lines) {
      const id = sid(3, moneyIdx++)
      const { error } = await admin.from('job_money_items').upsert(
        {
          id,
          job_id: job.id,
          company_id: COMPANY_ID,
          type: line.type,
          description: line.description,
          amount: line.amount,
          date: job.endAt,
          reference: line.reference,
          source: line.source,
          source_id: `${line.source}-${job.jobnr}`,
          category: line.category,
        },
        { onConflict: 'id' },
      )
      if (error) throw error
    }
  }
  return moneyIdx - 1
}

async function applyMoneyVerified(jobs, ownerId) {
  const verifiedIds = jobs.filter((j) => j.verified).map((j) => j.id)
  if (!verifiedIds.length) return 0
  const at = new Date().toISOString()
  const { error } = await admin
    .from('jobs')
    .update({ money_verified_at: at, money_verified_by: ownerId })
    .in('id', verifiedIds)
  if (error) throw error
  return verifiedIds.length
}

function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd
}

async function clearExpansionCrew(jobIds) {
  if (!jobIds.length) return
  const { data: periods } = await admin
    .from('time_periods')
    .select('id')
    .in('job_id', jobIds)
    .eq('category', 'crew')
  const periodIds = (periods ?? []).map((p) => p.id)
  if (periodIds.length) {
    await admin.from('reserved_crew').delete().in('time_period_id', periodIds)
    await admin.from('time_periods').delete().in('id', periodIds)
  }
}

async function seedCrewBookings(jobs, crewUserIds, ownerId) {
  // Drop prior expansion crew rows so re-runs do not hit overlap triggers
  // against stale periods from a previous attempt.
  await clearExpansionCrew(jobs.map((j) => j.id))

  let tpIdx = 1
  let crewIdx = 1
  let bookings = 0
  /** @type {Map<string, Array<{ start: number, end: number }>>} */
  const busy = new Map()

  const markBusy = (userId, startMs, endMs) => {
    const list = busy.get(userId) ?? []
    list.push({ start: startMs, end: endMs })
    busy.set(userId, list)
  }
  const isFree = (userId, startMs, endMs) => {
    const list = busy.get(userId) ?? []
    return !list.some((r) => rangesOverlap(r.start, r.end, startMs, endMs))
  }

  for (const job of jobs) {
    if (!job.crew) continue

    // Short on-job window so the same crew can cover many seeded jobs
    // without violating the no-overlap reserved_crew trigger.
    const slotStart = new Date(job.startAt)
    slotStart.setUTCMinutes(0, 0, 0)
    const slotEnd = new Date(slotStart)
    slotEnd.setUTCHours(slotStart.getUTCHours() + 3)
    const startMs = slotStart.getTime()
    const endMs = slotEnd.getTime()
    const startAt = slotStart.toISOString()
    const endAt = slotEnd.toISOString()

    const freeUsers = crewUserIds.filter((id) => isFree(id, startMs, endMs))
    const usersForJob = freeUsers.slice(0, 2)
    if (usersForJob.length === 0) {
      // Placeholder-only period still exercises crew UI when everyone is busy
      const tpId = sid(4, tpIdx++)
      const { error: tpError } = await admin.from('time_periods').upsert(
        {
          id: tpId,
          company_id: COMPANY_ID,
          job_id: job.id,
          title: 'Open role — tech',
          category: 'crew',
          role_category: 'technician',
          start_at: startAt,
          end_at: endAt,
          needed_count: 1,
          reserved_by_user_id: ownerId,
          deleted: false,
        },
        { onConflict: 'id' },
      )
      if (tpError) throw tpError
      const { error } = await admin.from('reserved_crew').upsert(
        {
          id: sid(5, crewIdx++),
          time_period_id: tpId,
          user_id: null,
          placeholder_name: 'Open tech',
          placeholder_email: 'open-tech@test.grid.local',
          status: 'planned',
          notes: 'Dev expansion placeholder (all crew busy)',
          forced: false,
        },
        { onConflict: 'id' },
      )
      if (error) throw error
      bookings += 1
      continue
    }

    const tpId = sid(4, tpIdx++)
    const { error: tpError } = await admin.from('time_periods').upsert(
      {
        id: tpId,
        company_id: COMPANY_ID,
        job_id: job.id,
        title: 'FOH / stage tech',
        category: 'crew',
        role_category: 'technician',
        start_at: startAt,
        end_at: endAt,
        needed_count: usersForJob.length,
        reserved_by_user_id: ownerId,
        deleted: false,
      },
      { onConflict: 'id' },
    )
    if (tpError) throw tpError

    for (const userId of usersForJob) {
      const { error } = await admin.from('reserved_crew').upsert(
        {
          id: sid(5, crewIdx++),
          time_period_id: tpId,
          user_id: userId,
          status: job.status === 'canceled' ? 'canceled' : 'confirmed',
          notes: 'Dev expansion crew booking',
          forced: false,
        },
        { onConflict: 'id' },
      )
      if (error) throw error
      if (job.status !== 'canceled') markBusy(userId, startMs, endMs)
      bookings += 1
    }
  }
  return bookings
}

async function seedJobInvoices(jobs, ownerId) {
  let invIdx = 1
  let count = 0
  for (const job of jobs) {
    if (!job.invoice || job.income <= 0) continue
    const id = sid(6, invIdx++)
    const net = job.income
    const vat = Math.round(net * 0.25 * 100) / 100
    const total = Math.round((net + vat) * 100) / 100
    const contaInvoiceId = String(700000 + job.jobnr)
    const { error } = await admin.from('job_invoices').upsert(
      {
        id,
        job_id: job.id,
        organization_id: CONTA_ORG_ID,
        invoice_basis: 'offer',
        status: job.status === 'paid' ? 'paid' : 'created',
        conta_customer_id: 424242,
        conta_invoice_id: contaInvoiceId,
        created_by_user_id: ownerId,
        invoice_data: {
          orgReference: 'Grid Test Company',
          customerReference: `PO-${job.jobnr}`,
          personalMessage: `Seed invoice for ${job.title}`,
          invoiceDate: job.endAt.slice(0, 10),
          invoiceLines: [
            {
              description: job.title,
              price: net,
              quantity: 1,
              sumNet: net,
            },
          ],
          sumNet: net,
          sumVAT: vat,
          sumTotal: total,
        },
        conta_response: {
          invoiceNo: Number(contaInvoiceId),
          status: job.status === 'paid' ? 'PAID' : 'SENT',
          sumNet: net,
          sumVAT: vat,
          sumTotal: total,
        },
      },
      { onConflict: 'id' },
    )
    if (error) throw error
    count += 1
  }
  return count
}

async function seedTimeEntries(jobs, userIds) {
  let teIdx = 1
  let count = 0
  for (const job of jobs) {
    if (!job.logging) continue
    for (let u = 0; u < Math.min(2, userIds.length); u++) {
      const start = new Date(job.startAt)
      start.setUTCHours(9 + u, 0, 0, 0)
      const end = new Date(start)
      end.setUTCHours(start.getUTCHours() + 4)
      const { error } = await admin.from('time_entries').upsert(
        {
          id: sid(7, teIdx++),
          company_id: COMPANY_ID,
          user_id: userIds[u],
          job_id: job.id,
          job_number: String(job.jobnr),
          title: job.title,
          note: 'Dev expansion logging entry',
          start_at: start.toISOString(),
          end_at: end.toISOString(),
        },
        { onConflict: 'id' },
      )
      if (error) throw error
      count += 1
    }
  }
  return count
}

async function countForCompany(table, column = 'company_id') {
  const { count, error } = await admin
    .from(table)
    .select('*', { count: 'exact', head: true })
    .eq(column, COMPANY_ID)
  if (error) throw error
  return count ?? 0
}

async function main() {
  console.log('Dev expansion seed…')
  console.log(`  URL host: ${new URL(SUPABASE_URL).host}`)
  console.log(`  Project ref: ${PROJECT_REF || '(from URL)'}`)
  console.log(`  Wipe namespace: ${WIPE ? 'yes' : 'no'}`)

  await assertCompany()

  const johnId = await seedJohnDevOwner()
  console.log(
    `  John Dev owner: ${JOHN_DEV_EMAIL} (auth id ${johnId}) — Dev password is NOT the Prod password`,
  )

  const ownerId = await findUserIdByEmail(OWNER_EMAIL)
  const freelancerId = await findUserIdByEmail(FREELANCER_EMAIL)
  const employeeId = await findUserIdByEmail(EMPLOYEE_EMAIL)

  // Enrich base freelancer with org number
  await upsertCompanyUser(freelancerId, 'freelancer', {
    rate: 750,
    rateType: 'daily',
    vatNumber: '911223344',
  })

  const extraFreelancerIds = []
  for (const fl of IDS.freelancers) {
    const id = await ensureAuthUser(fl.email, 'TestPassword123!', {
      display_name: fl.name,
    })
    await upsertProfile(id, fl.email, fl.name)
    await upsertCompanyUser(id, 'freelancer', {
      rate: fl.rate,
      rateType: 'daily',
      vatNumber: fl.vat,
    })
    extraFreelancerIds.push(id)
  }

  await seedCustomers()

  const jobs = buildJobCatalog()
  if (WIPE) await wipeSeedNamespace(jobs.map((j) => j.id))

  await seedJobs(jobs, ownerId, employeeId)
  const moneyCount = await seedMoneyItems(jobs)
  const verifiedCount = await applyMoneyVerified(jobs, ownerId)

  const crewUserIds = [freelancerId, employeeId, ownerId, ...extraFreelancerIds]
  const bookingCount = await seedCrewBookings(jobs, crewUserIds, ownerId)
  const invoiceCount = await seedJobInvoices(jobs, ownerId)
  const timeEntryCount = await seedTimeEntries(jobs, [
    ownerId,
    employeeId,
    freelancerId,
  ])

  const readyToInvoice = jobs.filter((j) => j.status === 'completed').length
  const readyToVerify = jobs.filter(
    (j) =>
      (j.status === 'invoiced' || j.status === 'paid') && j.verified === false,
  ).length

  const companyJobs = await countForCompany('jobs')
  const companyMoney = await countForCompany('job_money_items')
  const companyCustomers = await countForCompany('customers')

  console.log('Dev expansion seed complete.')
  console.log(`  Expansion jobs upserted: ${jobs.length}`)
  console.log(`  Money lines upserted:    ${moneyCount}`)
  console.log(`  Money-verified jobs:     ${verifiedCount}`)
  console.log(`  Crew bookings:           ${bookingCount}`)
  console.log(`  Conta-linked invoices:   ${invoiceCount}`)
  console.log(`  Time entries:            ${timeEntryCount}`)
  console.log(
    `  Extra freelancers:       ${IDS.freelancers.length} (with vat_number)`,
  )
  console.log(`  Ready-to-invoice (seed): ${readyToInvoice}`)
  console.log(`  Ready-to-verify (seed):  ${readyToVerify}`)
  console.log(
    `  Company totals — jobs: ${companyJobs}, money: ${companyMoney}, customers: ${companyCustomers}`,
  )
  console.log(`  Test login: ${OWNER_EMAIL} / TestPassword123!`)
  console.log(
    `  John login (Dev Auth): ${JOHN_DEV_EMAIL} / ${JOHN_DEV_PASSWORD}`,
  )
  console.log(
    '  Note: Dev Auth ≠ Prod Auth — use the Dev password above (override with DEV_JOHN_PASSWORD).',
  )
  console.log(
    '  Extra logins: freelancer2|3|4@test.grid.local / TestPassword123!',
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
