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

  return entries
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
