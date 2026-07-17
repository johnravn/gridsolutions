import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@shared/api/supabase'
import { useToast } from '@shared/ui/toast/ToastProvider'
import {
  DEFAULT_SHORTCUTS,
  SHORTCUT_BY_ID,
  parseShortcutOverrides,
  resolveShortcuts,
} from './shortcutRegistry'
import type {
  ResolvedShortcuts,
  ShortcutId,
  ShortcutOverrides,
} from './shortcutRegistry'
import type { Json } from '@shared/types/database.types'

type ShortcutPreferencesContextValue = {
  overrides: ShortcutOverrides
  resolved: ResolvedShortcuts
  isLoading: boolean
  setOverride: (id: ShortcutId, hotkey: string) => Promise<void>
  resetOverride: (id: ShortcutId) => Promise<void>
  resetAll: () => Promise<void>
}

const ShortcutPreferencesContext =
  React.createContext<ShortcutPreferencesContextValue | null>(null)

type ProfilePrefsRow = {
  display_name: string | null
  first_name: string | null
  last_name: string | null
  phone: string | null
  bio: string | null
  avatar_url: string | null
  preferences: Record<string, unknown>
}

async function fetchMyProfileForPrefs(): Promise<ProfilePrefsRow | null> {
  const { data: userData, error: userErr } = await supabase.auth.getUser()
  if (userErr) throw userErr
  const userId = userData.user.id
  if (!userId) return null

  const { data, error } = await supabase
    .from('profiles')
    .select(
      'display_name, first_name, last_name, phone, bio, avatar_url, preferences',
    )
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null

  const prefs =
    data.preferences != null &&
    typeof data.preferences === 'object' &&
    !Array.isArray(data.preferences)
      ? (data.preferences as Record<string, unknown>)
      : {}

  return {
    display_name: data.display_name,
    first_name: data.first_name,
    last_name: data.last_name,
    phone: data.phone,
    bio: data.bio,
    avatar_url: data.avatar_url,
    preferences: prefs,
  }
}

async function saveKeyboardShortcuts(
  nextOverrides: ShortcutOverrides,
): Promise<void> {
  const profile = await fetchMyProfileForPrefs()
  if (!profile) throw new Error('Not signed in')

  const preferences: Record<string, unknown> = {
    ...profile.preferences,
    keyboard_shortcuts: nextOverrides,
  }

  const { error } = await supabase.rpc('update_my_profile', {
    p_display_name: profile.display_name ?? '',
    p_first_name: profile.first_name ?? '',
    p_last_name: profile.last_name ?? '',
    p_phone: profile.phone ?? '',
    p_bio: profile.bio ?? '',
    p_avatar_path: profile.avatar_url ?? '',
    p_preferences: preferences as Json,
  })
  if (error) throw error
}

export function ShortcutPreferencesProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const qc = useQueryClient()
  const { success, error: toastError } = useToast()

  const prefsQuery = useQuery({
    queryKey: ['profile', 'preferences', 'keyboard_shortcuts'],
    queryFn: async () => {
      const profile = await fetchMyProfileForPrefs()
      return profile?.preferences ?? {}
    },
    staleTime: 60_000,
  })

  const overrides = React.useMemo(
    () => parseShortcutOverrides(prefsQuery.data ?? {}),
    [prefsQuery.data],
  )

  const resolved = React.useMemo(() => resolveShortcuts(overrides), [overrides])

  const saveMut = useMutation({
    mutationFn: saveKeyboardShortcuts,
    onSuccess: async () => {
      await qc.invalidateQueries({
        queryKey: ['profile', 'preferences', 'keyboard_shortcuts'],
      })
      await qc.invalidateQueries({ queryKey: ['profile'], exact: false })
    },
  })

  const setOverride = React.useCallback(
    async (id: ShortcutId, hotkey: string) => {
      const next = { ...overrides, [id]: hotkey.trim() }
      try {
        await saveMut.mutateAsync(next)
        success(
          'Shortcut updated',
          `${SHORTCUT_BY_ID[id].label}: ${hotkey.trim()}`,
        )
      } catch (e) {
        toastError(
          'Could not save shortcut',
          e instanceof Error ? e.message : 'Unknown error',
        )
        throw e
      }
    },
    [overrides, saveMut, success, toastError],
  )

  const resetOverride = React.useCallback(
    async (id: ShortcutId) => {
      const next = { ...overrides }
      delete next[id]
      try {
        await saveMut.mutateAsync(next)
        success(
          'Shortcut reset',
          SHORTCUT_BY_ID[id].defaultHotkey
            ? `${SHORTCUT_BY_ID[id].label} restored to default`
            : `${SHORTCUT_BY_ID[id].label} binding removed`,
        )
      } catch (e) {
        toastError(
          'Could not reset shortcut',
          e instanceof Error ? e.message : 'Unknown error',
        )
        throw e
      }
    },
    [overrides, saveMut, success, toastError],
  )

  const resetAll = React.useCallback(async () => {
    try {
      await saveMut.mutateAsync({})
      success('Shortcuts reset', 'All shortcuts restored to defaults')
    } catch (e) {
      toastError(
        'Could not reset shortcuts',
        e instanceof Error ? e.message : 'Unknown error',
      )
      throw e
    }
  }, [saveMut, success, toastError])

  const value = React.useMemo(
    (): ShortcutPreferencesContextValue => ({
      overrides,
      resolved,
      isLoading: prefsQuery.isLoading,
      setOverride,
      resetOverride,
      resetAll,
    }),
    [
      overrides,
      resolved,
      prefsQuery.isLoading,
      setOverride,
      resetOverride,
      resetAll,
    ],
  )

  return (
    <ShortcutPreferencesContext.Provider value={value}>
      {children}
    </ShortcutPreferencesContext.Provider>
  )
}

export function useShortcutPreferences(): ShortcutPreferencesContextValue {
  const ctx = React.useContext(ShortcutPreferencesContext)
  if (!ctx) {
    throw new Error(
      'useShortcutPreferences must be used within ShortcutPreferencesProvider',
    )
  }
  return ctx
}

/** Safe hook for places that may render outside the provider (falls back to defaults). */
export function useResolvedShortcuts(): ResolvedShortcuts {
  const ctx = React.useContext(ShortcutPreferencesContext)
  return ctx?.resolved ?? DEFAULT_SHORTCUTS
}
