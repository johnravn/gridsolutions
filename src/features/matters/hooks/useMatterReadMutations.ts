import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  markAllMattersAsRead,
  markMatterAsRead,
  markMatterAsUnread,
  markMattersAsRead,
  markMattersAsUnread,
} from '../api/queries'
import {
  applyOptimisticMarkAllMattersRead,
  applyOptimisticMatterReadState,
  invalidateMattersInBackground,
  restoreOptimisticMatterReadSnapshot,
} from '../utils/optimisticMatterRead'

export function useMatterReadMutations() {
  const qc = useQueryClient()

  const invalidate = () => {
    invalidateMattersInBackground(qc)
  }

  const markRead = useMutation({
    mutationFn: markMatterAsRead,
    onMutate: async (matterId) => {
      await qc.cancelQueries({ queryKey: ['matters'] })
      const snapshot = applyOptimisticMatterReadState(qc, {
        matterIds: [matterId],
        isUnread: false,
      })
      return { snapshot }
    },
    onError: (_err, _id, ctx) => {
      restoreOptimisticMatterReadSnapshot(qc, ctx?.snapshot)
    },
    onSettled: invalidate,
  })

  const markUnread = useMutation({
    mutationFn: markMatterAsUnread,
    onMutate: async (matterId) => {
      await qc.cancelQueries({ queryKey: ['matters'] })
      const snapshot = applyOptimisticMatterReadState(qc, {
        matterIds: [matterId],
        isUnread: true,
      })
      return { snapshot }
    },
    onError: (_err, _id, ctx) => {
      restoreOptimisticMatterReadSnapshot(qc, ctx?.snapshot)
    },
    onSettled: invalidate,
  })

  const markSelectedRead = useMutation({
    mutationFn: markMattersAsRead,
    onMutate: async (matterIds) => {
      await qc.cancelQueries({ queryKey: ['matters'] })
      const snapshot = applyOptimisticMatterReadState(qc, {
        matterIds,
        isUnread: false,
      })
      return { snapshot }
    },
    onError: (_err, _ids, ctx) => {
      restoreOptimisticMatterReadSnapshot(qc, ctx?.snapshot)
    },
    onSettled: invalidate,
  })

  const markSelectedUnread = useMutation({
    mutationFn: markMattersAsUnread,
    onMutate: async (matterIds) => {
      await qc.cancelQueries({ queryKey: ['matters'] })
      const snapshot = applyOptimisticMatterReadState(qc, {
        matterIds,
        isUnread: true,
      })
      return { snapshot }
    },
    onError: (_err, _ids, ctx) => {
      restoreOptimisticMatterReadSnapshot(qc, ctx?.snapshot)
    },
    onSettled: invalidate,
  })

  const markAllRead = useMutation({
    mutationFn: markAllMattersAsRead,
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ['matters'] })
      const snapshot = applyOptimisticMarkAllMattersRead(qc)
      return { snapshot }
    },
    onError: (_err, _vars, ctx) => {
      restoreOptimisticMatterReadSnapshot(qc, ctx?.snapshot)
    },
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
