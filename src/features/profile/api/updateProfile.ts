import { supabase } from '@shared/api/supabase'
import type { BibleVersion } from '@shared/lib/bibleVersion'
import type { GeometricBackgroundPreset } from '@shared/ui/components/AnimatedBackground'
import type { Json } from '@shared/types/database.types'

export type ProfileAddressForm = {
  id: string | null
  name: string
  address_line: string
  zip_code: string
  city: string
  country: string
}

export type ProfilePageForm = {
  display_name: string
  first_name: string
  last_name: string
  phone: string
  bio: string
  avatarPath: string | null
  date_of_birth: string
  drivers_license: string
  licensesCsv: string
  certificatesCsv: string
  notes: string
  animatedBackground: boolean
  backgroundIntensity: number
  backgroundPreset: GeometricBackgroundPreset
  dailyInspirationType: 'quote' | 'bibleverse'
  bibleVersion: BibleVersion
}

export type ProfilePreferencesFields = {
  date_of_birth?: string | null
  drivers_license?: string | null
  licenses?: Array<string> | null
  certificates?: Array<string> | null
  notes?: string | null
  animated_background_enabled?: boolean | null
  animated_background_intensity?: number | null
  animated_background_shape_type?: string | null
  daily_inspiration_type?: 'quote' | 'bibleverse' | null
  bible_version?: BibleVersion | null
}

export function prefsAsRecord(
  prefs: Json | null | undefined,
): Record<string, unknown> {
  if (prefs != null && typeof prefs === 'object' && !Array.isArray(prefs)) {
    return prefs as Record<string, unknown>
  }
  return {}
}

export type SaveProfilePageInput = {
  userId: string
  form: ProfilePageForm
  addr: ProfileAddressForm
  previousPreferences: Json | null | undefined
  previousDisplayName: string | null | undefined
}

export type SaveProfilePageResult = {
  addressId: string | null
}

export async function saveProfilePage({
  userId,
  form,
  addr,
  previousPreferences,
  previousDisplayName,
}: SaveProfilePageInput): Promise<SaveProfilePageResult> {
  const licenses = form.licensesCsv
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const certificates = form.certificatesCsv
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  const ownerLabel =
    form.display_name.trim() || previousDisplayName?.trim() || 'My'
  const addressName = `${ownerLabel}'s home`

  let addressId = addr.id
  const cleanAddress = {
    name: addressName,
    address_line: addr.address_line,
    zip_code: addr.zip_code,
    city: addr.city,
    country: addr.country,
    is_personal: true,
    company_id: null,
  }

  if (addressId) {
    const { error: updErr } = await supabase
      .from('addresses')
      .update(cleanAddress)
      .eq('id', addressId)
    if (updErr) throw updErr
  } else if (addr.address_line && addr.city && addr.zip_code && addr.country) {
    const newAddressId = crypto.randomUUID()
    const { error: insErr } = await supabase
      .from('addresses')
      .insert([{ id: newAddressId, ...cleanAddress }])
    if (insErr) throw insErr
    addressId = newAddressId
  }

  if (addressId) {
    const { error: linkErr } = await supabase
      .from('profiles')
      .update({ primary_address_id: addressId })
      .eq('user_id', userId)
    if (linkErr) throw linkErr
  }

  const preferences: Record<string, unknown> = {
    ...prefsAsRecord(previousPreferences),
    date_of_birth: form.date_of_birth || null,
    drivers_license: form.drivers_license || null,
    licenses: licenses.length ? licenses : null,
    certificates: certificates.length ? certificates : null,
    notes: form.notes || null,
    animated_background_enabled: form.animatedBackground,
    animated_background_intensity: form.backgroundIntensity,
    animated_background_shape_type: form.backgroundPreset,
    daily_inspiration_type: form.dailyInspirationType,
    bible_version: form.bibleVersion,
  }
  delete preferences.prefer_reduced_motion
  delete preferences.daily_inspiration_show_attribution
  delete preferences.daily_inspiration_large_text

  const { error: rpcErr } = await supabase.rpc('update_my_profile', {
    p_display_name: form.display_name || '',
    p_first_name: form.first_name || '',
    p_last_name: form.last_name || '',
    p_phone: form.phone || '',
    p_bio: form.bio || '',
    p_avatar_path: form.avatarPath || '',
    p_preferences: preferences as Json,
  })
  if (rpcErr) throw rpcErr

  return { addressId }
}
