// src/features/company/api/queries.ts
import { supabase } from '@shared/api/supabase'

export type CompanyRole = 'owner' | 'employee' | 'freelancer' | 'super_user'

export async function setCompanyUserRole({
  companyId,
  userId,
  role,
}: {
  companyId: string
  userId: string
  role: CompanyRole
}) {
  const { data: auth, error: authErr } = await supabase.auth.getUser()
  if (authErr) throw authErr
  const actorId = auth.user.id
  if (!actorId) throw new Error('Not authenticated')

  const { data, error } = await supabase.rpc('set_company_user_role', {
    p_company_id: companyId,
    p_target_user_id: userId,
    p_new_role: role,
    p_actor_user_id: actorId,
  })
  if (error) throw error
  return data
}

export async function removeCompanyUser({
  companyId,
  userId,
}: {
  companyId: string
  userId: string
}) {
  const { data: auth, error: authErr } = await supabase.auth.getUser()
  if (authErr) throw authErr
  const actorId = auth.user.id
  if (!actorId) throw new Error('Not authenticated')

  const { error } = await supabase
    .from('company_users')
    .delete()
    .eq('company_id', companyId)
    .eq('user_id', userId)

  if (error) throw error
}

export type CompanyIndexRow = {
  id: string
  name: string
  created_at: string
  address: string | null
  vat_number: string | null
  general_email: string | null
  contact_person_id: string | null
  contact_person: {
    user_id: string
    display_name: string | null
    email: string
  } | null
}

export function companiesIndexQuery() {
  return {
    queryKey: ['companies', 'index'] as const,
    queryFn: async (): Promise<Array<CompanyIndexRow>> => {
      const { data, error } = await supabase
        .from('companies')
        .select(
          `
          id,
          name,
          created_at,
          address,
          vat_number,
          general_email,
          contact_person_id,
          contact_person:profiles!companies_contact_person_id_fkey (
            user_id,
            display_name,
            email
          )
        `,
        )
        .order('name', { ascending: true })

      if (error) throw error

      return (data as Array<any>).map((row) => {
        const person = Array.isArray(row.contact_person)
          ? row.contact_person[0]
          : row.contact_person

        return {
          id: row.id as string,
          name: row.name as string,
          created_at: row.created_at as string,
          address: (row.address ?? null) as string | null,
          vat_number: (row.vat_number ?? null) as string | null,
          general_email: (row.general_email ?? null) as string | null,
          contact_person_id: (row.contact_person_id ?? null) as string | null,
          contact_person: person as {
            user_id: string
            display_name: string | null
            email: string
          } | null,
        }
      })
    },
  }
}

// Radix Accent Color Type (used for company theme)
export type RadixAccentColor =
  | 'gray'
  | 'gold'
  | 'bronze'
  | 'brown'
  | 'yellow'
  | 'amber'
  | 'orange'
  | 'tomato'
  | 'red'
  | 'ruby'
  | 'pink'
  | 'plum'
  | 'purple'
  | 'violet'
  | 'iris'
  | 'indigo'
  | 'blue'
  | 'cyan'
  | 'teal'
  | 'jade'
  | 'green'
  | 'grass'
  | 'mint'
  | 'lime'
  | 'sky'

// Radix Theme Property Types
export type RadixRadius = 'none' | 'small' | 'medium' | 'large' | 'full'
export type RadixGrayColor =
  | 'gray'
  | 'mauve'
  | 'slate'
  | 'sage'
  | 'olive'
  | 'sand'
export type RadixPanelBackground = 'solid' | 'translucent'
export type RadixScaling = '90%' | '95%' | '100%' | '105%' | '110%'

export type CompanyDetail = {
  id: string
  name: string
  created_at: string
  address: string | null
  vat_number: string | null
  general_email: string | null
  contact_person_id: string | null
  accent_color: RadixAccentColor | null
  theme_radius: RadixRadius | null
  theme_gray_color: RadixGrayColor | null
  theme_panel_background: RadixPanelBackground | null
  theme_scaling: RadixScaling | null
  logo_path: string | null
  logo_light_path: string | null
  logo_dark_path: string | null
  contact_person: {
    user_id: string
    display_name: string | null
    email: string
    phone: string | null
  } | null
}

export function companyDetailQuery({ companyId }: { companyId: string }) {
  return {
    queryKey: ['company', companyId, 'company-detail'] as const,
    queryFn: async (): Promise<CompanyDetail> => {
      const { data, error } = await supabase
        .from('companies')
        .select(
          `
          id,
          name,
          created_at,
          address,
          vat_number,
          general_email,
          contact_person_id,
          accent_color,
          theme_radius,
          theme_gray_color,
          theme_panel_background,
          theme_scaling,
          logo_path,
          logo_light_path,
          logo_dark_path,
          contact_person:profiles!companies_contact_person_id_fkey (
            user_id,
            display_name,
            email,
            phone
          )
        `,
        )
        .eq('id', companyId)
        // optional: cap the nested array at 1
        .limit(1, { foreignTable: 'profiles' })
        .single()

      if (error) throw error

      // 🔧 normalize embedded relation to a single object (or null)
      const person =
        (Array.isArray((data as any).contact_person)
          ? (data as any).contact_person[0]
          : (data as any).contact_person) ?? null

      return {
        id: data.id,
        name: data.name,
        created_at: data.created_at,
        address: (data.address ?? null),
        vat_number: (data.vat_number ?? null),
        general_email: (data.general_email ?? null),
        contact_person_id: (data.contact_person_id ?? null),
        accent_color: (data.accent_color as RadixAccentColor | null) ?? null,
        theme_radius: (data.theme_radius as RadixRadius | null) ?? null,
        theme_gray_color:
          (data.theme_gray_color as RadixGrayColor | null) ?? null,
        theme_panel_background:
          (data.theme_panel_background as RadixPanelBackground | null) ?? null,
        theme_scaling: (data.theme_scaling as RadixScaling | null) ?? null,
        logo_path: (data.logo_path) ?? null,
        logo_light_path: (data.logo_light_path) ?? null,
        logo_dark_path: (data.logo_dark_path) ?? null,
        contact_person: person as {
          user_id: string
          display_name: string | null
          email: string
          phone: string | null
        } | null,
      }
    },
  }
}

export async function updateCompany({
  companyId,
  id,
  name,
  address,
  vat_number,
  general_email,
  contact_person_id,
  logo_path,
  logo_light_path,
  logo_dark_path,
}: {
  companyId: string
  id: string
  name: string
  address?: string | null
  vat_number?: string | null
  general_email?: string | null
  contact_person_id?: string | null
  logo_path?: string | null
  logo_light_path?: string | null
  logo_dark_path?: string | null
}) {
  const { data: auth, error: authErr } = await supabase.auth.getUser()
  if (authErr) throw authErr
  const actorId = auth.user.id
  if (!actorId) throw new Error('Not authenticated')

  // Validate that id matches companyId for security
  if (id !== companyId) {
    throw new Error('Company ID mismatch')
  }

  const updates: Record<string, any> = {
    name,
    address: address || null,
    vat_number: vat_number || null,
    general_email: general_email || null,
    contact_person_id: contact_person_id || null,
  }

  if (logo_path !== undefined) updates.logo_path = logo_path
  if (logo_light_path !== undefined) updates.logo_light_path = logo_light_path
  if (logo_dark_path !== undefined) updates.logo_dark_path = logo_dark_path

  const { error } = await supabase
    .from('companies')
    .update(updates)
    .eq('id', id)

  if (error) throw error
}

// Update company accent color
export async function updateCompanyAccentColor({
  companyId,
  accentColor,
}: {
  companyId: string
  accentColor: RadixAccentColor | null
}) {
  const { data: auth, error: authErr } = await supabase.auth.getUser()
  if (authErr) throw authErr
  const actorId = auth.user.id
  if (!actorId) throw new Error('Not authenticated')

  const { error } = await supabase
    .from('companies')
    .update({ accent_color: accentColor })
    .eq('id', companyId)

  if (error) throw error
}

// Update company theme properties
export async function updateCompanyTheme({
  companyId,
  accentColor,
  radius,
  grayColor,
  panelBackground,
  scaling,
}: {
  companyId: string
  accentColor?: RadixAccentColor | null
  radius?: RadixRadius | null
  grayColor?: RadixGrayColor | null
  panelBackground?: RadixPanelBackground | null
  scaling?: RadixScaling | null
}) {
  const { data: auth, error: authErr } = await supabase.auth.getUser()
  if (authErr) throw authErr
  const actorId = auth.user.id
  if (!actorId) throw new Error('Not authenticated')

  const updates: Record<string, any> = {}
  if (accentColor !== undefined) updates.accent_color = accentColor
  if (radius !== undefined) updates.theme_radius = radius
  if (grayColor !== undefined) updates.theme_gray_color = grayColor
  if (panelBackground !== undefined)
    updates.theme_panel_background = panelBackground
  if (scaling !== undefined) updates.theme_scaling = scaling

  const { error } = await supabase
    .from('companies')
    .update(updates)
    .eq('id', companyId)

  if (error) throw error
}

// Company Expansions API

export type RentalFactorConfig = Record<number, number>

export type CompanyExpansion = {
  id: string
  company_id: string
  accounting_software: 'none' | 'conta' | null
  accounting_api_key_encrypted: string | null
  accounting_api_key_sandbox_encrypted: string | null
  accounting_api_environment: 'production' | 'sandbox' | null
  accounting_organization_id: string | null
  accounting_api_read_only: boolean
  crew_rate_per_day: number | null
  crew_rate_per_hour: number | null
  vehicle_daily_rate: number | null
  vehicle_distance_rate: number | null
  vehicle_distance_increment: number | null
  customer_discount_percent: number | null
  partner_discount_percent: number | null
  rental_factor_config: RentalFactorConfig | string | null // JSON string or object
  fixed_rate_start_day: number | null
  fixed_rate_per_day: number | null
  created_at: string
  updated_at: string
}

export function companyExpansionQuery({ companyId }: { companyId: string }) {
  return {
    queryKey: ['company', companyId, 'expansion'] as const,
    queryFn: async (): Promise<CompanyExpansion | null> => {
      if (!companyId || typeof companyId !== 'string') {
        return null
      }
      const { data, error } = await supabase
        .from('company_expansions')
        .select(
          'id, company_id, accounting_software, accounting_api_key_encrypted, accounting_api_key_sandbox_encrypted, accounting_api_environment, accounting_organization_id, accounting_api_read_only, crew_rate_per_day, crew_rate_per_hour, vehicle_daily_rate, vehicle_distance_rate, vehicle_distance_increment, customer_discount_percent, partner_discount_percent, rental_factor_config, fixed_rate_start_day, fixed_rate_per_day, created_at, updated_at',
        )
        .eq('company_id', companyId)
        .maybeSingle()

      if (error) throw error
      if (!data) return null

      // Parse rental_factor_config if it's a string
      let rentalFactorConfig = data.rental_factor_config
      if (typeof rentalFactorConfig === 'string') {
        try {
          rentalFactorConfig = JSON.parse(rentalFactorConfig)
        } catch {
          rentalFactorConfig = null
        }
      }

      return {
        ...data,
        rental_factor_config: rentalFactorConfig,
      } as CompanyExpansion
    },
  }
}

export async function updateCompanyExpansion({
  companyId,
  accountingSoftware,
  apiKey,
  sandboxApiKey,
  apiEnvironment,
  organizationId,
  readOnly,
}: {
  companyId: string
  accountingSoftware?: 'none' | 'conta'
  apiKey?: string | null
  sandboxApiKey?: string | null
  apiEnvironment?: 'production' | 'sandbox'
  organizationId?: string | null
  readOnly?: boolean
}) {
  const { data: auth, error: authErr } = await supabase.auth.getUser()
  if (authErr) throw authErr
  const actorId = auth.user.id
  if (!actorId) throw new Error('Not authenticated')

  // Encrypt the API key(s) if provided
  let encryptedKey: string | null = null
  if (apiKey && accountingSoftware !== 'none') {
    const { data, error } = await supabase.rpc('encrypt_api_key', {
      p_company_id: companyId,
      p_api_key: apiKey,
    })
    if (error) throw error
    encryptedKey = data as string | null
  }

  let encryptedSandboxKey: string | null = null
  if (sandboxApiKey && accountingSoftware !== 'none') {
    const { data, error } = await supabase.rpc('encrypt_api_key', {
      p_company_id: companyId,
      p_api_key: sandboxApiKey,
    })
    if (error) throw error
    encryptedSandboxKey = data as string | null
  }

  // Get current expansion to preserve existing values if not provided
  const { data: current } = await supabase
    .from('company_expansions')
    .select('*')
    .eq('company_id', companyId)
    .maybeSingle()

  // Upsert the expansion record
  // Use onConflict to specify the unique constraint column to avoid duplicate key errors
  const { data, error } = await supabase
    .from('company_expansions')
    .upsert(
      {
        company_id: companyId,
        accounting_software:
          accountingSoftware !== undefined
            ? accountingSoftware
            : (current?.accounting_software ?? 'none'),
        accounting_api_key_encrypted:
          apiKey !== undefined
            ? encryptedKey
            : (current?.accounting_api_key_encrypted ?? null),
        accounting_api_key_sandbox_encrypted:
          sandboxApiKey !== undefined
            ? encryptedSandboxKey
            : ((current as any)?.accounting_api_key_sandbox_encrypted ?? null),
        accounting_api_environment:
          apiEnvironment !== undefined
            ? apiEnvironment
            : ((current as any)?.accounting_api_environment ?? 'production'),
        accounting_organization_id:
          organizationId !== undefined
            ? organizationId
            : ((current as any)?.accounting_organization_id ?? null),
        accounting_api_read_only:
          readOnly !== undefined
            ? readOnly
            : (current?.accounting_api_read_only ?? true),
      },
      { onConflict: 'company_id' },
    )
    .select()
    .single()

  if (error) throw error
  return data
}
