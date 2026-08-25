import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@shared/api/supabase'
import { myProfileQueryKey } from '@shared/api/myProfileQuery'
import { APP_VERSION } from '@app/config/releaseNotes'
import type { MyProfile } from '@shared/api/myProfileQuery'

export function shouldShowWhatsNew({
  userId,
  profileLoaded,
  lastSeenReleaseVersion,
  appVersion,
}: {
  userId: string | undefined
  profileLoaded: boolean
  lastSeenReleaseVersion: string | null | undefined
  appVersion: string
}) {
  if (!userId || !profileLoaded) return false
  // `undefined` means the cached profile row is missing this field (usually a
  // query-key collision with a narrower select). Don't treat that as unseen.
  if (lastSeenReleaseVersion === undefined) return false
  return lastSeenReleaseVersion !== appVersion
}

export function useWhatsNew({
  userId,
  profileLoaded,
  lastSeenReleaseVersion,
}: {
  userId: string | undefined
  profileLoaded: boolean
  lastSeenReleaseVersion: string | null | undefined
}) {
  const queryClient = useQueryClient()

  const shouldShow = shouldShowWhatsNew({
    userId,
    profileLoaded,
    lastSeenReleaseVersion,
    appVersion: APP_VERSION,
  })

  const dismissMutation = useMutation({
    mutationFn: async () => {
      if (!userId) return
      const { error } = await supabase
        .from('profiles')
        .update({ last_seen_release_version: APP_VERSION })
        .eq('user_id', userId)
      if (error) throw error
    },
    onMutate: async () => {
      if (!userId) return
      const queryKey = myProfileQueryKey(userId)
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData(queryKey)
      queryClient.setQueryData(queryKey, (old: MyProfile | null | undefined) =>
        old ? { ...old, last_seen_release_version: APP_VERSION } : old,
      )
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (!userId || !context?.previous) return
      queryClient.setQueryData(myProfileQueryKey(userId), context.previous)
    },
    onSettled: () => {
      if (!userId) return
      void queryClient.invalidateQueries({
        queryKey: myProfileQueryKey(userId),
      })
    },
  })

  return {
    shouldShow,
    dismiss: () => dismissMutation.mutate(),
    isDismissing: dismissMutation.isPending,
  }
}
