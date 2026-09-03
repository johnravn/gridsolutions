import type { QueryClient, QueryKey } from '@tanstack/react-query'
import type { Matter } from '../types'

type MatterLike = {
  id: string
  is_unread?: boolean
}

function isMatterList(data: unknown): data is Array<MatterLike> {
  return (
    Array.isArray(data) &&
    (data.length === 0 ||
      (typeof data[0] === 'object' &&
        data[0] !== null &&
        'id' in data[0] &&
        typeof (data[0] as MatterLike).id === 'string'))
  )
}

function isMatterDetail(data: unknown): data is MatterLike {
  return (
    typeof data === 'object' &&
    data !== null &&
    'id' in data &&
    typeof (data as MatterLike).id === 'string' &&
    !Array.isArray(data)
  )
}

export type OptimisticMatterReadSnapshot = {
  listEntries: Array<[QueryKey, unknown]>
  detailEntries: Array<[QueryKey, unknown]>
  unreadCountEntries: Array<[QueryKey, unknown]>
}

function snapshotMatterCaches(qc: QueryClient): OptimisticMatterReadSnapshot {
  return {
    listEntries: qc.getQueriesData({ queryKey: ['matters', 'index'] }),
    detailEntries: qc.getQueriesData({ queryKey: ['matters', 'detail'] }),
    unreadCountEntries: qc.getQueriesData({
      queryKey: ['matters', 'unread-count'],
    }),
  }
}

export function restoreOptimisticMatterReadSnapshot(
  qc: QueryClient,
  snapshot: OptimisticMatterReadSnapshot | undefined,
) {
  if (!snapshot) return
  for (const [key, data] of snapshot.listEntries) {
    qc.setQueryData(key, data)
  }
  for (const [key, data] of snapshot.detailEntries) {
    qc.setQueryData(key, data)
  }
  for (const [key, data] of snapshot.unreadCountEntries) {
    qc.setQueryData(key, data)
  }
}

/** Flip is_unread on cached matter lists/details and adjust unread-count caches. */
export function applyOptimisticMatterReadState(
  qc: QueryClient,
  {
    matterIds,
    isUnread,
  }: {
    matterIds: Array<string>
    isUnread: boolean
  },
): OptimisticMatterReadSnapshot {
  const ids = [...new Set(matterIds.filter(Boolean))]
  const snapshot = snapshotMatterCaches(qc)
  if (ids.length === 0) return snapshot

  const idSet = new Set(ids)
  let delta = 0
  const counted = new Set<string>()

  const consider = (matter: MatterLike) => {
    if (!idSet.has(matter.id) || counted.has(matter.id)) return
    counted.add(matter.id)
    if (isUnread && !matter.is_unread) delta += 1
    if (!isUnread && matter.is_unread) delta -= 1
  }

  for (const [, data] of snapshot.listEntries) {
    if (!isMatterList(data)) continue
    for (const matter of data) consider(matter)
  }
  for (const [, data] of snapshot.detailEntries) {
    if (!isMatterDetail(data)) continue
    consider(data)
  }
  for (const id of ids) {
    if (!counted.has(id)) {
      // Not in cache — assume flip matches the requested state.
      delta += isUnread ? 1 : -1
    }
  }

  qc.setQueriesData({ queryKey: ['matters', 'index'] }, (old) => {
    if (!isMatterList(old)) return old
    let changed = false
    const next = old.map((matter) => {
      if (!idSet.has(matter.id) || matter.is_unread === isUnread) return matter
      changed = true
      return { ...matter, is_unread: isUnread }
    })
    return changed ? next : old
  })

  for (const id of ids) {
    qc.setQueryData(
      ['matters', 'detail', id],
      (old: Matter | null | undefined) => {
        if (!old || old.is_unread === isUnread) return old
        return { ...old, is_unread: isUnread }
      },
    )
  }

  qc.setQueriesData({ queryKey: ['matters', 'unread-count'] }, (old) => {
    if (typeof old !== 'number') return old
    return Math.max(0, old + delta)
  })

  return snapshot
}

/** Mark every cached matter as read and zero unread counts. */
export function applyOptimisticMarkAllMattersRead(
  qc: QueryClient,
): OptimisticMatterReadSnapshot {
  const snapshot = snapshotMatterCaches(qc)

  qc.setQueriesData({ queryKey: ['matters', 'index'] }, (old) => {
    if (!isMatterList(old)) return old
    let changed = false
    const next = old.map((matter) => {
      if (!matter.is_unread) return matter
      changed = true
      return { ...matter, is_unread: false }
    })
    return changed ? next : old
  })

  qc.setQueriesData({ queryKey: ['matters', 'detail'] }, (old) => {
    if (!isMatterDetail(old) || !old.is_unread) return old
    return { ...old, is_unread: false }
  })

  qc.setQueriesData({ queryKey: ['matters', 'unread-count'] }, (old) => {
    if (typeof old !== 'number') return old
    return 0
  })

  return snapshot
}

export function invalidateMattersInBackground(qc: QueryClient) {
  void Promise.all([
    qc.invalidateQueries({ queryKey: ['matters'] }),
    qc.invalidateQueries({ queryKey: ['notifications'] }),
  ])
}
