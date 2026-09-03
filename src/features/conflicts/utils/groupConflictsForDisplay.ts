import { dedupeOverlapConflicts } from '../api/overlapChecks'
import type { OverlapConflict } from '../api/overlapChecks'

export type ConflictDisplayEntry =
  | { kind: 'direct'; conflict: OverlapConflict }
  | {
      kind: 'group'
      groupId: string
      groupName: string
      quantity: number
      items: Array<OverlapConflict>
    }

function periodsOverlap(
  start1: string,
  end1: string,
  start2: string,
  end2: string,
): boolean {
  return start1 < end2 && end1 > start2
}

function conflictIdentity(conflict: OverlapConflict): string {
  return [
    conflict.itemId ?? conflict.itemName ?? '',
    conflict.jobId ?? conflict.jobTitle ?? '',
  ].join(':')
}

function isSameListedConflict(
  left: OverlapConflict,
  right: OverlapConflict,
): boolean {
  return (
    conflictIdentity(left) === conflictIdentity(right) &&
    periodsOverlap(left.startAt, left.endAt, right.startAt, right.endAt)
  )
}

function isPlaceholderGroupItem(
  groupName: string,
  conflict: OverlapConflict,
): boolean {
  if (conflict.itemId) return false
  const itemName = conflict.itemName?.trim()
  return !itemName || itemName === groupName
}

function pruneGroupItems(
  groupName: string,
  items: Array<OverlapConflict>,
): Array<OverlapConflict> {
  const members = items.filter(
    (item) => !isPlaceholderGroupItem(groupName, item),
  )
  return members.length > 0 ? members : items
}

/** Nest item conflicts that belong to the same inventory group. */
export function groupConflictsForDisplay(
  conflicts: Array<OverlapConflict>,
): Array<ConflictDisplayEntry> {
  const groups = new Map<
    string,
    Extract<ConflictDisplayEntry, { kind: 'group' }>
  >()
  const entries: Array<ConflictDisplayEntry> = []

  for (const conflict of conflicts) {
    const groupId = conflict.sourceGroupId
    if (!groupId) {
      entries.push({ kind: 'direct', conflict })
      continue
    }

    const existing = groups.get(groupId)
    if (existing) {
      existing.items.push(conflict)
      existing.quantity = Math.max(
        existing.quantity,
        conflict.sourceGroupQuantity ?? existing.quantity,
      )
      continue
    }

    const entry: Extract<ConflictDisplayEntry, { kind: 'group' }> = {
      kind: 'group',
      groupId,
      groupName: conflict.sourceGroupName?.trim() || 'Group',
      quantity: Math.max(1, conflict.sourceGroupQuantity ?? 1),
      items: [conflict],
    }
    groups.set(groupId, entry)
    entries.push(entry)
  }

  for (const entry of entries) {
    if (entry.kind !== 'group') continue
    entry.items = pruneGroupItems(
      entry.groupName,
      dedupeOverlapConflicts(entry.items),
    )
  }

  const groupedItems = entries.flatMap((entry) =>
    entry.kind === 'group' ? entry.items : [],
  )

  return entries.filter((entry) => {
    if (entry.kind !== 'direct') return true
    return !groupedItems.some((item) =>
      isSameListedConflict(item, entry.conflict),
    )
  })
}

export function conflictDisplayCounts(entries: Array<ConflictDisplayEntry>): {
  groupCount: number
  itemCount: number
} {
  let groupCount = 0
  let itemCount = 0
  for (const entry of entries) {
    if (entry.kind === 'group') groupCount += 1
    else itemCount += 1
  }
  return { groupCount, itemCount }
}
