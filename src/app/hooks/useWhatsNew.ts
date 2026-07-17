import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@shared/api/supabase'
import { APP_VERSION } from '@app/config/releaseNotes'

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

  const shouldShow =
    !!userId &&
    profileLoaded &&
    (lastSeenReleaseVersion ?? null) !== APP_VERSION

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
      await queryClient.cancelQueries({ queryKey: ['my-profile', userId] })
      const previous = queryClient.getQueryData(['my-profile', userId] as const)
      queryClient.setQueryData(
        ['my-profile', userId],
        (old: { last_seen_release_version?: string | null } | undefined) =>
          old ? { ...old, last_seen_release_version: APP_VERSION } : old,
      )
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (!userId || !context?.previous) return
      queryClient.setQueryData(['my-profile', userId], context.previous)
    },
    onSettled: () => {
      if (!userId) return
      void queryClient.invalidateQueries({ queryKey: ['my-profile', userId] })
    },
  })

  return {
    shouldShow,
    dismiss: () => dismissMutation.mutate(),
    isDismissing: dismissMutation.isPending,
  }
}
