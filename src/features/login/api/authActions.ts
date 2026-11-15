import { supabase } from '@shared/api/supabase'
import { fetchProfileCompleteness, isProfileComplete } from '@shared/auth/oauth'

export type SignUpInput = {
  email: string
  password: string
  firstName: string
  lastName: string
  phone: string
}

export type SignUpResult =
  | { kind: 'session'; userId: string }
  | { kind: 'confirm_email' }

/** Email/password sign-up; returns whether a session exists immediately. */
export async function signUpWithPassword(
  input: SignUpInput,
): Promise<SignUpResult> {
  const { error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      emailRedirectTo: `${window.location.origin}/auth/callback`,
      data: {
        full_name: `${input.firstName} ${input.lastName}`.trim(),
        first_name: input.firstName,
        last_name: input.lastName,
        phone: input.phone,
      },
    },
  })
  if (error) throw error

  const { data: sessionData } = await supabase.auth.getSession()
  const userId = sessionData.session?.user?.id
  if (userId) return { kind: 'session', userId }
  return { kind: 'confirm_email' }
}

export type SignInResult =
  | { kind: 'complete' }
  | { kind: 'incomplete_profile' }
  | { kind: 'no_session' }

/** Email/password sign-in + profile-completeness gate. */
export async function signInWithPassword(input: {
  email: string
  password: string
}): Promise<SignInResult> {
  const { error } = await supabase.auth.signInWithPassword({
    email: input.email,
    password: input.password,
  })
  if (error) throw error

  const { data: sessionData } = await supabase.auth.getSession()
  const userId = sessionData.session?.user?.id
  if (!userId) return { kind: 'no_session' }

  const profile = await fetchProfileCompleteness(userId)
  if (!isProfileComplete(profile)) return { kind: 'incomplete_profile' }
  return { kind: 'complete' }
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function completeRequiredProfile(input: {
  userId: string
  firstName: string
  lastName: string
  phone: string
}): Promise<void> {
  const { data: existing, error: loadError } = await supabase
    .from('profiles')
    .select('display_name, bio, avatar_url, preferences')
    .eq('user_id', input.userId)
    .maybeSingle()
  if (loadError) throw loadError

  const displayName =
    existing?.display_name?.trim() ||
    `${input.firstName} ${input.lastName}`.trim()
  const { error: rpcError } = await supabase.rpc('update_my_profile', {
    p_display_name: displayName,
    p_first_name: input.firstName.trim(),
    p_last_name: input.lastName.trim(),
    p_phone: input.phone.trim(),
    p_bio: existing?.bio ?? '',
    p_avatar_path: existing?.avatar_url ?? '',
    p_preferences: existing?.preferences ?? {},
  })
  if (rpcError) throw rpcError
}
