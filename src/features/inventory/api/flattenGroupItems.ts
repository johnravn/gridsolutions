import { supabase } from '@shared/api/supabase'

export const GROUP_FLATTEN_MAX_DEPTH = 10

export type GroupItemRow = {
  group_id: string
  item_id: string | null
  child_group_id: string | null
  quantity: number
}

export type GroupLeafItem = {
  item_id: string
  quantity: number
}

export type FlattenedGroupContents = {
  leafItemsByGroupId: Map<string, Array<GroupLeafItem>>
  descendantGroupIdsByRoot: Map<string, Array<string>>
}

export function indexGroupItemRows(rows: Array<GroupItemRow>): {
  rowsByGroupId: Map<string, Array<GroupItemRow>>
  parentIdsByChild: Map<string, Array<string>>
} {
  const rowsByGroupId = new Map<string, Array<GroupItemRow>>()
  const parentIdsByChild = new Map<string, Array<string>>()

  for (const row of rows) {
    const list = rowsByGroupId.get(row.group_id) ?? []
    list.push(row)
    rowsByGroupId.set(row.group_id, list)

    if (row.child_group_id) {
      const parents = parentIdsByChild.get(row.child_group_id) ?? []
      if (!parents.includes(row.group_id)) parents.push(row.group_id)
      parentIdsByChild.set(row.child_group_id, parents)
    }
  }

  return { rowsByGroupId, parentIdsByChild }
}

function walkLeaves(
  groupId: string,
  multiplier: number,
  depth: number,
  maxDepth: number,
  rowsByGroupId: Map<string, Array<GroupItemRow>>,
  path: Set<string>,
  leafQty: Map<string, number>,
  descendants: Set<string>,
) {
  if (depth > maxDepth) return
  if (path.has(groupId)) return

  const nextPath = new Set(path)
  nextPath.add(groupId)

  for (const row of rowsByGroupId.get(groupId) ?? []) {
    const qty = (row.quantity ?? 1) * multiplier
    if (row.item_id) {
      leafQty.set(row.item_id, (leafQty.get(row.item_id) ?? 0) + qty)
      continue
    }
    if (!row.child_group_id) continue
    descendants.add(row.child_group_id)
    walkLeaves(
      row.child_group_id,
      qty,
      depth + 1,
      maxDepth,
      rowsByGroupId,
      nextPath,
      leafQty,
      descendants,
    )
  }
}

export function flattenGroupItemsFromRows(
  rootGroupIds: Array<string>,
  rowsByGroupId: Map<string, Array<GroupItemRow>>,
  maxDepth = GROUP_FLATTEN_MAX_DEPTH,
): FlattenedGroupContents {
  const leafItemsByGroupId = new Map<string, Array<GroupLeafItem>>()
  const descendantGroupIdsByRoot = new Map<string, Array<string>>()

  for (const rootId of rootGroupIds) {
    const leafQty = new Map<string, number>()
    const descendants = new Set<string>()
    walkLeaves(
      rootId,
      1,
      1,
      maxDepth,
      rowsByGroupId,
      new Set(),
      leafQty,
      descendants,
    )
    leafItemsByGroupId.set(
      rootId,
      Array.from(leafQty.entries()).map(([item_id, quantity]) => ({
        item_id,
        quantity,
      })),
    )
    descendantGroupIdsByRoot.set(rootId, Array.from(descendants))
  }

  return { leafItemsByGroupId, descendantGroupIdsByRoot }
}

export function lineageIdsFromRows(
  groupId: string,
  rowsByGroupId: Map<string, Array<GroupItemRow>>,
  parentIdsByChild: Map<string, Array<string>>,
  maxDepth = GROUP_FLATTEN_MAX_DEPTH,
): Array<string> {
  const ids = new Set<string>([groupId])

  const walkDown = (id: string, depth: number, path: Set<string>) => {
    if (depth > maxDepth || path.has(id)) return
    const nextPath = new Set(path)
    nextPath.add(id)
    for (const row of rowsByGroupId.get(id) ?? []) {
      if (!row.child_group_id) continue
      ids.add(row.child_group_id)
      walkDown(row.child_group_id, depth + 1, nextPath)
    }
  }

  const walkUp = (id: string, depth: number, path: Set<string>) => {
    if (depth > maxDepth || path.has(id)) return
    const nextPath = new Set(path)
    nextPath.add(id)
    for (const parentId of parentIdsByChild.get(id) ?? []) {
      ids.add(parentId)
      walkUp(parentId, depth + 1, nextPath)
    }
  }

  walkDown(groupId, 1, new Set())
  walkUp(groupId, 1, new Set())
  return Array.from(ids)
}

async function fetchGroupItemRows(
  groupIds: Array<string>,
  byChild = false,
): Promise<Array<GroupItemRow>> {
  if (groupIds.length === 0) return []
  const query = supabase
    .from('group_items')
    .select('group_id, item_id, child_group_id, quantity')
  const { data, error } = byChild
    ? await query.in('child_group_id', groupIds)
    : await query.in('group_id', groupIds)
  if (error) throw error
  return (data ?? []).map((row) => ({
    group_id: row.group_id,
    item_id: row.item_id,
    child_group_id: row.child_group_id,
    quantity: row.quantity ?? 1,
  }))
}

async function fetchGroupTreeRows(
  rootGroupIds: Array<string>,
): Promise<Array<GroupItemRow>> {
  const allRows: Array<GroupItemRow> = []
  const seenGroupIds = new Set<string>()
  let frontier = Array.from(new Set(rootGroupIds.filter(Boolean)))
  let depth = 0

  while (frontier.length > 0 && depth < GROUP_FLATTEN_MAX_DEPTH) {
    const toFetch = frontier.filter((id) => !seenGroupIds.has(id))
    for (const id of toFetch) seenGroupIds.add(id)
    if (toFetch.length === 0) break

    const rows = await fetchGroupItemRows(toFetch)
    allRows.push(...rows)
    frontier = rows
      .map((row) => row.child_group_id)
      .filter((id): id is string => !!id && !seenGroupIds.has(id))
    depth += 1
  }

  return allRows
}

export async function flattenGroupItems(
  groupIds: Array<string>,
): Promise<FlattenedGroupContents> {
  const uniqueIds = Array.from(new Set(groupIds.filter(Boolean)))
  if (uniqueIds.length === 0) {
    return {
      leafItemsByGroupId: new Map(),
      descendantGroupIdsByRoot: new Map(),
    }
  }

  const rows = await fetchGroupTreeRows(uniqueIds)
  const { rowsByGroupId } = indexGroupItemRows(rows)
  return flattenGroupItemsFromRows(uniqueIds, rowsByGroupId)
}

export async function flattenGroupLeafItems(
  groupIds: Array<string>,
): Promise<Map<string, Array<GroupLeafItem>>> {
  const flattened = await flattenGroupItems(groupIds)
  return flattened.leafItemsByGroupId
}

export function emptyGroupNames(
  groups: Array<{ group_id: string; name: string }>,
  leafItemsByGroupId: Map<string, Array<GroupLeafItem>>,
): Array<string> {
  return groups
    .filter(
      (group) => (leafItemsByGroupId.get(group.group_id) ?? []).length === 0,
    )
    .map((group) => group.name.trim() || 'Group')
}

export function emptyGroupBookingMessage(groupNames: Array<string>): string {
  if (groupNames.length === 1) {
    return `Cannot book ${groupNames[0]}: the group has no items. Add items to it in inventory first.`
  }
  return `Cannot book ${groupNames.join(', ')}: these groups have no items. Add items to them in inventory first.`
}

export async function fetchGroupLineageIds(
  groupIds: Array<string>,
): Promise<Map<string, Array<string>>> {
  const uniqueIds = Array.from(new Set(groupIds.filter(Boolean)))
  const result = new Map<string, Array<string>>()
  if (uniqueIds.length === 0) return result

  const allRows: Array<GroupItemRow> = []
  const seenGroupIds = new Set<string>()
  const seenAsChild = new Set<string>()
  let downFrontier = [...uniqueIds]
  let upFrontier = [...uniqueIds]
  let depth = 0

  while (
    (downFrontier.length > 0 || upFrontier.length > 0) &&
    depth < GROUP_FLATTEN_MAX_DEPTH
  ) {
    const toFetchDown = downFrontier.filter((id) => !seenGroupIds.has(id))
    const toFetchUp = upFrontier.filter((id) => !seenAsChild.has(id))
    for (const id of toFetchDown) seenGroupIds.add(id)
    for (const id of toFetchUp) seenAsChild.add(id)

    const [downRows, upRows] = await Promise.all([
      fetchGroupItemRows(toFetchDown),
      fetchGroupItemRows(toFetchUp, true),
    ])
    allRows.push(...downRows, ...upRows)

    downFrontier = downRows
      .map((row) => row.child_group_id)
      .filter((id): id is string => !!id && !seenGroupIds.has(id))
    upFrontier = upRows
      .map((row) => row.group_id)
      .filter((id) => !!id && !seenAsChild.has(id))
    depth += 1
  }

  const { rowsByGroupId, parentIdsByChild } = indexGroupItemRows(allRows)
  for (const groupId of uniqueIds) {
    result.set(
      groupId,
      lineageIdsFromRows(groupId, rowsByGroupId, parentIdsByChild),
    )
  }
  return result
}
