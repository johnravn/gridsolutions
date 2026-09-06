import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { TEST_CONFLICT_IDS } from '@test/fixtures/conflicts'
import {
  createAnonClient,
  createServiceClient,
  integrationEnabled,
  isSupabaseReachable,
  signInTestUser,
} from './supabaseClient'

const TEST_EMAIL = process.env.E2E_TEST_EMAIL ?? 'owner@test.grid.local'
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD ?? 'TestPassword123!'
const TEST_COMPANY_ID = TEST_CONFLICT_IDS.companyId
const OTHER_COMPANY_ID = '99999999-9999-4999-8999-999999999999'
const TEST_CUSTOMER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

const OWN_COMPANY_PATH = `companies/${TEST_COMPANY_ID}/logo_light.png`
const OTHER_COMPANY_PATH = `companies/${OTHER_COMPANY_ID}/logo_light.png`
const OWN_CUSTOMER_PATH = `customers/${TEST_COMPANY_ID}/${TEST_CUSTOMER_ID}/logo.jpg`
const OTHER_CUSTOMER_PATH = `customers/${OTHER_COMPANY_ID}/${TEST_CUSTOMER_ID}/logo.jpg`

const describeIntegration = integrationEnabled ? describe : describe.skip

function tinyPng(): Blob {
  const bytes = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  )
  return new Blob([bytes], { type: 'image/png' })
}

describeIntegration('logos storage policies', () => {
  beforeAll(async () => {
    const reachable = await isSupabaseReachable()
    if (!reachable) {
      throw new Error(
        'Local Supabase is not reachable. Run `supabase start` and `npm run db:seed-test-users`.',
      )
    }

    const service = createServiceClient()
    await service.storage
      .from('logos')
      .remove([
        OWN_COMPANY_PATH,
        OTHER_COMPANY_PATH,
        OWN_CUSTOMER_PATH,
        OTHER_CUSTOMER_PATH,
      ])

    const { error } = await service.storage
      .from('logos')
      .upload(OTHER_COMPANY_PATH, tinyPng(), {
        upsert: true,
        contentType: 'image/png',
      })
    if (error) throw error
  })

  afterAll(async () => {
    const service = createServiceClient()
    await service.storage
      .from('logos')
      .remove([
        OWN_COMPANY_PATH,
        OTHER_COMPANY_PATH,
        OWN_CUSTOMER_PATH,
        OTHER_CUSTOMER_PATH,
      ])
  })

  it('lets company staff upload and replace their own company logo', async () => {
    const { client } = await signInTestUser(TEST_EMAIL, TEST_PASSWORD)
    const { error } = await client.storage
      .from('logos')
      .upload(OWN_COMPANY_PATH, tinyPng(), {
        upsert: true,
        contentType: 'image/png',
      })

    expect(error).toBeNull()
  })

  it('lets company staff upload a customer logo under their company', async () => {
    const { client } = await signInTestUser(TEST_EMAIL, TEST_PASSWORD)
    const { error } = await client.storage
      .from('logos')
      .upload(OWN_CUSTOMER_PATH, tinyPng(), {
        upsert: true,
        contentType: 'image/png',
      })

    expect(error).toBeNull()
  })

  it('blocks a user from overwriting another company logo path', async () => {
    const { client } = await signInTestUser(TEST_EMAIL, TEST_PASSWORD)
    const { error } = await client.storage
      .from('logos')
      .upload(OTHER_COMPANY_PATH, tinyPng(), {
        upsert: true,
        contentType: 'image/png',
      })

    expect(error).toBeTruthy()
  })

  it('blocks a user from writing a customer logo under another company', async () => {
    const { client } = await signInTestUser(TEST_EMAIL, TEST_PASSWORD)
    const { error } = await client.storage
      .from('logos')
      .upload(OTHER_CUSTOMER_PATH, tinyPng(), {
        upsert: true,
        contentType: 'image/png',
      })

    expect(error).toBeTruthy()
  })

  it('blocks a user from deleting another company logo', async () => {
    const { client } = await signInTestUser(TEST_EMAIL, TEST_PASSWORD)
    await client.storage.from('logos').remove([OTHER_COMPANY_PATH])

    // Storage may return error=null when RLS filters the row out.
    // The other company's object must still exist.
    const service = createServiceClient()
    const folder = OTHER_COMPANY_PATH.slice(
      0,
      OTHER_COMPANY_PATH.lastIndexOf('/'),
    )
    const filename = OTHER_COMPANY_PATH.slice(
      OTHER_COMPANY_PATH.lastIndexOf('/') + 1,
    )
    const { data: remaining, error: listError } = await service.storage
      .from('logos')
      .list(folder)

    expect(listError).toBeNull()
    expect(remaining?.some((object) => object.name === filename)).toBe(true)
  })

  it('serves uploaded logos on the public URL', async () => {
    const { client } = await signInTestUser(TEST_EMAIL, TEST_PASSWORD)
    const { error } = await client.storage
      .from('logos')
      .upload(OWN_COMPANY_PATH, tinyPng(), {
        upsert: true,
        contentType: 'image/png',
      })
    expect(error).toBeNull()

    const anon = createAnonClient()
    const { data } = anon.storage.from('logos').getPublicUrl(OWN_COMPANY_PATH)
    const response = await fetch(data.publicUrl)

    expect(response.ok).toBe(true)
    expect(response.headers.get('content-type')).toMatch(/image\/png/)
  })
})
