import { beforeAll, describe, expect, it } from 'vitest'
import { makeRecurringJobTemplate } from '@test/fixtures/recurringJobs'
import {
  createServiceClient,
  integrationEnabled,
  isSupabaseReachable,
  signInTestUser,
} from './supabaseClient'

const TEST_EMAIL = process.env.E2E_TEST_EMAIL ?? 'owner@test.grid.local'
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD ?? 'TestPassword123!'
const TEST_COMPANY_ID = '11111111-1111-4111-8111-111111111111'

const describeIntegration = integrationEnabled ? describe : describe.skip

describeIntegration('recurring jobs CRUD', () => {
  let createdRecurringJobId: string | null = null

  beforeAll(async () => {
    const reachable = await isSupabaseReachable()
    if (!reachable) {
      throw new Error(
        'Local Supabase is not reachable. Run `supabase start` and `npm run db:seed-test-users`.',
      )
    }
  })

  it('allows owner to list recurring jobs', async () => {
    const { client } = await signInTestUser(TEST_EMAIL, TEST_PASSWORD)
    const { data, error } = await client
      .from('recurring_jobs')
      .select('id, title, company_id')
      .eq('company_id', TEST_COMPANY_ID)

    expect(error).toBeNull()
    expect(Array.isArray(data)).toBe(true)
  })

  it('allows owner to create and read a recurring job', async () => {
    const { client } = await signInTestUser(TEST_EMAIL, TEST_PASSWORD)
    const title = `Integration Recurring ${Date.now()}`

    const { data, error } = await client
      .from('recurring_jobs')
      .insert({
        company_id: TEST_COMPANY_ID,
        title,
        description: 'Integration test series',
      })
      .select('id, title')
      .single()

    expect(error).toBeNull()
    expect(data?.title).toBe(title)
    createdRecurringJobId = data?.id ?? null
  })

  it('allows owner to update a recurring job', async () => {
    expect(createdRecurringJobId).toBeTruthy()
    const { client } = await signInTestUser(TEST_EMAIL, TEST_PASSWORD)

    const { data, error } = await client
      .from('recurring_jobs')
      .update({ description: 'Updated description' })
      .eq('id', createdRecurringJobId!)
      .select('description')
      .single()

    expect(error).toBeNull()
    expect(data?.description).toBe('Updated description')
  })

  it('cleans up created recurring job', async () => {
    if (!createdRecurringJobId) return
    const admin = createServiceClient()
    const { error } = await admin
      .from('recurring_jobs')
      .delete()
      .eq('id', createdRecurringJobId)
    expect(error).toBeNull()
  })
})

describeIntegration('recurring job templates', () => {
  let recurringJobId: string | null = null
  let templateId: string | null = null

  beforeAll(async () => {
    const reachable = await isSupabaseReachable()
    if (!reachable) {
      throw new Error(
        'Local Supabase is not reachable. Run `supabase start` and `npm run db:seed-test-users`.',
      )
    }
  })

  it('allows owner to create a recurring job for template tests', async () => {
    const { client } = await signInTestUser(TEST_EMAIL, TEST_PASSWORD)
    const { data, error } = await client
      .from('recurring_jobs')
      .insert({
        company_id: TEST_COMPANY_ID,
        title: `Template Parent ${Date.now()}`,
        description: 'Template CRUD parent',
      })
      .select('id')
      .single()

    expect(error).toBeNull()
    recurringJobId = data?.id ?? null
  })

  it('allows owner to create and read a template', async () => {
    expect(recurringJobId).toBeTruthy()
    const { client } = await signInTestUser(TEST_EMAIL, TEST_PASSWORD)
    const template = makeRecurringJobTemplate({
      recurring_job_id: recurringJobId!,
      company_id: TEST_COMPANY_ID,
      name: 'Integration Template',
      title: 'Integration Template',
    })

    const { data, error } = await client
      .from('recurring_job_templates')
      .insert({
        recurring_job_id: template.recurring_job_id,
        company_id: template.company_id,
        name: template.name,
        title: template.title,
        description: template.description,
        status: template.status,
        duration_hours: template.duration_hours,
        start_time: template.start_time,
        crew_roles: template.crew_roles,
        sort_order: template.sort_order,
      })
      .select('id, title, recurring_job_id')
      .single()

    expect(error).toBeNull()
    expect(data?.title).toBe('Integration Template')
    expect(data?.recurring_job_id).toBe(recurringJobId)
    templateId = data?.id ?? null
  })

  it('allows owner to update a template title', async () => {
    expect(templateId).toBeTruthy()
    const { client } = await signInTestUser(TEST_EMAIL, TEST_PASSWORD)

    const { data, error } = await client
      .from('recurring_job_templates')
      .update({ title: 'Updated Template Title' })
      .eq('id', templateId!)
      .select('title')
      .single()

    expect(error).toBeNull()
    expect(data?.title).toBe('Updated Template Title')
  })

  it('cleans up template and recurring job', async () => {
    const admin = createServiceClient()
    if (templateId) {
      const { error } = await admin
        .from('recurring_job_templates')
        .delete()
        .eq('id', templateId)
      expect(error).toBeNull()
    }
    if (recurringJobId) {
      const { error } = await admin
        .from('recurring_jobs')
        .delete()
        .eq('id', recurringJobId)
      expect(error).toBeNull()
    }
  })
})
