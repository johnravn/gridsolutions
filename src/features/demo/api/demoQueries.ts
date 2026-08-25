import { supabase } from '@shared/api/supabase'

export const DEMO_COMPANY_ID = '00000000-0000-4000-8000-000000000001'

export async function enterDemo(): Promise<string> {
  const { data: sessionData } = await supabase.auth.getSession()

  if (!sessionData.session) {
    const { error: anonError } = await supabase.auth.signInAnonymously()
    if (anonError) {
      if (
        anonError.code === 'anonymous_provider_disabled' ||
        /anonymous sign-ins are disabled/i.test(anonError.message)
      ) {
        throw new Error(
          'Demo mode is unavailable: anonymous sign-ins are disabled on this project. Enable Anonymous under Authentication → Providers in the Supabase dashboard.',
        )
      }
      throw anonError
    }
  } else if (!sessionData.session.user.is_anonymous) {
    throw new Error(
      'Demo mode is only available when not signed in to a real account',
    )
  }

  const { data, error } = await supabase.rpc('enter_demo')
  if (error) throw error
  if (!data) throw new Error('Demo company not configured')

  return data
}
