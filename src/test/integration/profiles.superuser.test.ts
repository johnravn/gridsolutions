import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  createServiceClient,
  integrationEnabled,
  isSupabaseReachable,
  signInTestUser,
} from './supabaseClient'

const OWNER_EMAIL = process.env.E2E_TEST_EMAIL ?? 'owner@test.grid.local'
const OWNER_PASSWORD = process.env.E2E_TEST_PASSWORD ?? 'TestPassword123!'
const FREELANCER_EMAIL = 'freelancer@test.grid.local'
const FREELANCER_PASSWORD = 'TestPassword123!'

const describeIntegration = integrationEnabled ? describe : describe.skip

describeIntegration('profiles.superuser lock', () => {
  let ownerId: string
  let freelancerId: string
  let ownerDisplayName: string | null
  let freelancerDisplayName: string | null
  let freelancerSuperuser = false

  beforeAll(async () => {
    const reachable = await isSupabaseReachable()
    if (!reachable) {
      throw new Error(
        'Local Supabase is not reachable. Run `supabase start` and `npm run db:seed-test-users`.',
      )
    }

    const service = createServiceClient()
    const { data: profiles, error } = await service
      .from('profiles')
      .select('user_id, email, display_name, superuser')
      .in('email', [OWNER_EMAIL, FREELANCER_EMAIL])

    if (error) throw error

    const owner = profiles?.find(
      (p) => p.email.toLowerCase() === OWNER_EMAIL.toLowerCase(),
    )
    const freelancer = profiles?.find(
      (p) => p.email.toLowerCase() === FREELANCER_EMAIL.toLowerCase(),
    )
    if (!owner) throw new Error('Seed owner profile not found')
    if (!freelancer) throw new Error('Seed freelancer profile not found')

    ownerId = owner.user_id
    freelancerId = freelancer.user_id
    ownerDisplayName = owner.display_name
    freelancerDisplayName = freelancer.display_name
    freelancerSuperuser = freelancer.superuser

    const { error: resetError } = await service
      .from('profiles')
      .update({ superuser: false })
      .in('user_id', [ownerId, freelancerId])
    if (resetError) throw resetError
  })

  afterAll(async () => {
    const service = createServiceClient()
    await service
      .from('profiles')
      .update({
        display_name: ownerDisplayName,
        superuser: false,
      })
      .eq('user_id', ownerId)
    await service
      .from('profiles')
      .update({
        display_name: freelancerDisplayName,
        superuser: freelancerSuperuser,
      })
      .eq('user_id', freelancerId)
  })

  it('blocks a non-superuser from setting superuser on their own profile', async () => {
    const { client } = await signInTestUser(OWNER_EMAIL, OWNER_PASSWORD)
    const { error } = await client
      .from('profiles')
      .update({ superuser: true })
      .eq('user_id', ownerId)

    expect(error).toBeTruthy()

    const service = createServiceClient()
    const { data } = await service
      .from('profiles')
      .select('superuser')
      .eq('user_id', ownerId)
      .single()
    expect(data?.superuser).toBe(false)
  })

  it('still allows a user to update other columns on their own profile', async () => {
    const marker = `rls-superuser-${Date.now()}`
    const { client } = await signInTestUser(OWNER_EMAIL, OWNER_PASSWORD)
    const { error } = await client
      .from('profiles')
      .update({ display_name: marker })
      .eq('user_id', ownerId)

    expect(error).toBeNull()

    const service = createServiceClient()
    const { data } = await service
      .from('profiles')
      .select('display_name, superuser')
      .eq('user_id', ownerId)
      .single()
    expect(data?.display_name).toBe(marker)
    expect(data?.superuser).toBe(false)
  })

  it('rejects admin_update_profile for a non-superuser', async () => {
    const { client } = await signInTestUser(OWNER_EMAIL, OWNER_PASSWORD)
    const { error } = await client.rpc('admin_update_profile', {
      p_user_id: freelancerId,
      p_display_name: freelancerDisplayName ?? '',
      p_first_name: 'Nope',
      p_last_name: 'Nope',
      p_phone: '',
      p_superuser: true,
    })

    expect(error).toBeTruthy()

    const service = createServiceClient()
    const { data } = await service
      .from('profiles')
      .select('superuser')
      .eq('user_id', freelancerId)
      .single()
    expect(data?.superuser).toBe(false)
  })

  it('lets an existing superuser change another user via admin_update_profile', async () => {
    const service = createServiceClient()
    const { error: promoteError } = await service
      .from('profiles')
      .update({ superuser: true })
      .eq('user_id', ownerId)
    if (promoteError) throw promoteError

    try {
      const { client } = await signInTestUser(OWNER_EMAIL, OWNER_PASSWORD)
      const { data, error } = await client.rpc('admin_update_profile', {
        p_user_id: freelancerId,
        p_display_name: freelancerDisplayName ?? 'Freelancer',
        p_first_name: 'Freelance',
        p_last_name: 'User',
        p_phone: '+4712345678',
        p_superuser: true,
      })

      expect(error).toBeNull()
      expect(data?.superuser).toBe(true)
      expect(data?.user_id).toBe(freelancerId)

      const { data: stored } = await service
        .from('profiles')
        .select('superuser')
        .eq('user_id', freelancerId)
        .single()
      expect(stored?.superuser).toBe(true)

      const { error: demoteError } = await client.rpc('admin_update_profile', {
        p_user_id: freelancerId,
        p_display_name: freelancerDisplayName ?? 'Freelancer',
        p_first_name: 'Freelance',
        p_last_name: 'User',
        p_phone: '+4712345678',
        p_superuser: false,
      })
      expect(demoteError).toBeNull()
    } finally {
      await service
        .from('profiles')
        .update({ superuser: false })
        .eq('user_id', ownerId)
      await service
        .from('profiles')
        .update({ superuser: false })
        .eq('user_id', freelancerId)
    }
  })
})
