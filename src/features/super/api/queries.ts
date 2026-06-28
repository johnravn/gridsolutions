// src/features/super/api/queries.ts
import { supabase } from '@shared/api/supabase'

export type UserIndexRow = {
  user_id: string
  email: string
  display_name: string | null
  first_name: string | null
  last_name: string | null
  phone: string | null
  superuser: boolean
  created_at: string
}

export function usersIndexQuery() {
  return {
    queryKey: ['users', 'index'] as const,
    queryFn: async (): Promise<Array<UserIndexRow>> => {
      const { data, error } = await supabase
        .from('profiles')
        .select(
          `
          user_id,
          email,
          display_name,
          first_name,
          last_name,
          phone,
          superuser,
          created_at
        `,
        )
        .order('created_at', { ascending: false })

      if (error) throw error

      return data as Array<UserIndexRow>
    },
  }
}

export type UserDetail = {
  user_id: string
  email: string
  display_name: string | null
  first_name: string | null
  last_name: string | null
  phone: string | null
  superuser: boolean
  bio: string | null
  locale: string | null
  timezone: string | null
  avatar_url: string | null
  created_at: string
  preferences: {
    date_of_birth?: string
    drivers_license?: string
    licenses?: Array<string>
    certificates?: Array<string>
    notes?: string
  } | null
  primary_address_id: string | null
  primary_address: {
    id: string
    name: string | null
    address_line: string
    zip_code: string
    city: string
    country: string
  } | null
}

export function userDetailQuery({ userId }: { userId: string }) {
  return {
    queryKey: ['users', 'detail', userId] as const,
    queryFn: async (): Promise<UserDetail | null> => {
      const { data, error } = await supabase
        .from('profiles')
        .select(
          `
          user_id,
          email,
          display_name,
          first_name,
          last_name,
          phone,
          superuser,
          bio,
          locale,
          timezone,
          avatar_url,
          created_at,
          preferences,
          primary_address_id,
          primary_address:primary_address_id (
            id,
            name,
            address_line,
            zip_code,
            city,
            country
          )
        `,
        )
        .eq('user_id', userId)
        .maybeSingle()

      if (error) throw error

      if (!data) return null

      // Normalize the address relation
      const address =
        (Array.isArray((data as any).primary_address)
          ? (data as any).primary_address[0]
          : (data as any).primary_address) ?? null

      return {
        user_id: data.user_id,
        email: data.email,
        display_name: data.display_name ?? null,
        first_name: data.first_name ?? null,
        last_name: data.last_name ?? null,
        phone: data.phone ?? null,
        superuser: data.superuser,
        bio: data.bio ?? null,
        locale: data.locale ?? null,
        timezone: data.timezone ?? null,
        avatar_url: data.avatar_url ?? null,
        created_at: data.created_at,
        preferences: (data.preferences ?? null) as {
          date_of_birth?: string
          drivers_license?: string
          licenses?: Array<string>
          certificates?: Array<string>
          notes?: string
        } | null,
        primary_address_id: data.primary_address_id ?? null,
        primary_address: address,
      }
    },
  }
}

export type UserCompanyMembership = {
  company_id: string
  company_name: string
  role: 'owner' | 'employee' | 'freelancer' | 'super_user'
}

export function userCompanyMembershipsQuery({ userId }: { userId: string }) {
  return {
    queryKey: ['users', 'companies', userId] as const,
    queryFn: async (): Promise<Array<UserCompanyMembership>> => {
      const { data, error } = await supabase
        .from('company_users')
        .select(
          `
          company_id,
          role,
          companies (
            id,
            name
          )
        `,
        )
        .eq('user_id', userId)

      if (error) throw error

      return data.map((row) => ({
        company_id: row.company_id,
        company_name: (row.companies as any).name,
        role: row.role,
      }))
    },
  }
}

// Get all users in a company with their roles
export type CompanyUserRow = {
  user_id: string
  email: string
  display_name: string | null
  first_name: string | null
  last_name: string | null
  role: 'owner' | 'employee' | 'freelancer' | 'super_user'
  superuser: boolean
}

export function companyUsersQuery({ companyId }: { companyId: string }) {
  return {
    queryKey: ['companies', companyId, 'users'] as const,
    queryFn: async (): Promise<Array<CompanyUserRow>> => {
      // Step 1: Get company_users for this company
      const { data: companyUsersData, error: cuError } = await supabase
        .from('company_users')
        .select('user_id, role')
        .eq('company_id', companyId)

      if (cuError) throw cuError

      if (!companyUsersData || companyUsersData.length === 0) return []

      // Step 2: Get profiles for all these user_ids
      const userIds = companyUsersData.map((cu) => cu.user_id)
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select(
          'user_id, email, display_name, first_name, last_name, superuser',
        )
        .in('user_id', userIds)

      if (profilesError) throw profilesError

      // Step 3: Combine the data
      const profilesMap = new Map(
        (profilesData ?? []).map((p) => [p.user_id, p]),
      )

      const result = companyUsersData
        .map((cu) => {
          const profile = profilesMap.get(cu.user_id)
          return {
            user_id: cu.user_id,
            email: profile?.email ?? '',
            display_name: profile?.display_name ?? null,
            first_name: profile?.first_name ?? null,
            last_name: profile?.last_name ?? null,
            role: cu.role,
            superuser: profile?.superuser ?? false,
          }
        })
        .filter((row) => row.email) // Filter out rows with no email (shouldn't happen, but safety)
        .sort((a, b) => {
          // Sort by role first, then by email
          if (a.role !== b.role) {
            return a.role.localeCompare(b.role)
          }
          return a.email.localeCompare(b.email)
        })

      return result
    },
  }
}

// Assign user to company with role (for superusers)
export async function assignUserToCompany({
  companyId,
  userId,
  role,
}: {
  companyId: string
  userId: string
  role: 'owner' | 'employee' | 'freelancer' | 'super_user'
}) {
  const { data: auth, error: authErr } = await supabase.auth.getUser()
  if (authErr) throw authErr
  const actorId = auth.user.id
  if (!actorId) throw new Error('Not authenticated')

  // Use the existing RPC function
  const { data, error } = await supabase.rpc('set_company_user_role', {
    p_company_id: companyId,
    p_target_user_id: userId,
    p_new_role: role,
    p_actor_user_id: actorId,
  })
  if (error) throw error
  return data
}

// Remove user from company (for superusers)
export async function removeUserFromCompany({
  companyId,
  userId,
}: {
  companyId: string
  userId: string
}) {
  const { error } = await supabase
    .from('company_users')
    .delete()
    .eq('company_id', companyId)
    .eq('user_id', userId)

  if (error) throw error
}
