import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  markAllMattersAsRead,
  markMatterAsRead,
  markMatterAsUnread,
  markMattersAsRead,
  markMattersAsUnread,
} from '../api/queries'

export function useMatterReadMutations() {
  const qc = useQueryClient()

  const invalidate = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['matters'] }),
      qc.invalidateQueries({ queryKey: ['notifications'] }),
    ])
  }

  const markRead = useMutation({
    mutationFn: markMatterAsRead,
    onSettled: invalidate,
  })

  const markUnread = useMutation({
    mutationFn: markMatterAsUnread,
    onSettled: invalidate,
  })

  const markSelectedRead = useMutation({
    mutationFn: markMattersAsRead,
    onSettled: invalidate,
  })

  const markSelectedUnread = useMutation({
    mutationFn: markMattersAsUnread,
    onSettled: invalidate,
  })

  const markAllRead = useMutation({
    mutationFn: markAllMattersAsRead,
    onSettled: invalidate,
  })

  return {
    markRead,
    markUnread,
    markSelectedRead,
    markSelectedUnread,
    markAllRead,
    invalidate,
  }
}
