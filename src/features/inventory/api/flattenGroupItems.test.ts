import { describe, expect, it } from 'vitest'
import {
  flattenGroupItemsFromRows,
  GROUP_FLATTEN_MAX_DEPTH,
  indexGroupItemRows,
  lineageIdsFromRows,
} from './flattenGroupItems'
import type { GroupItemRow } from './flattenGroupItems'

function rows(
  entries: Array<{
    group_id: string
    item_id?: string | null
    child_group_id?: string | null
    quantity: number
  }>,
): Array<GroupItemRow> {
  return entries.map((entry) => ({
    group_id: entry.group_id,
    item_id: entry.item_id ?? null,
    child_group_id: entry.child_group_id ?? null,
    quantity: entry.quantity,
  }))
}

describe('flattenGroupItemsFromRows', () => {
  it('flattens a group of direct items', () => {
    const { rowsByGroupId } = indexGroupItemRows(
      rows([
        { group_id: 'kit', item_id: 'mic', quantity: 2 },
        { group_id: 'kit', item_id: 'stand', quantity: 1 },
      ]),
    )
    const result = flattenGroupItemsFromRows(['kit'], rowsByGroupId)
    expect(result.leafItemsByGroupId.get('kit')).toEqual([
      { item_id: 'mic', quantity: 2 },
      { item_id: 'stand', quantity: 1 },
    ])
    expect(result.descendantGroupIdsByRoot.get('kit')).toEqual([])
  })

  it('multiplies nested group quantities', () => {
    const { rowsByGroupId } = indexGroupItemRows(
      rows([
        { group_id: 'a', child_group_id: 'b', quantity: 2 },
        { group_id: 'b', item_id: 'xlr', quantity: 3 },
      ]),
    )
    const result = flattenGroupItemsFromRows(['a'], rowsByGroupId)
    expect(result.leafItemsByGroupId.get('a')).toEqual([
      { item_id: 'xlr', quantity: 6 },
    ])
    expect(result.descendantGroupIdsByRoot.get('a')).toEqual(['b'])
  })

  it('mixes direct items and nested groups', () => {
    const { rowsByGroupId } = indexGroupItemRows(
      rows([
        { group_id: 'a', item_id: 'case', quantity: 1 },
        { group_id: 'a', child_group_id: 'b', quantity: 2 },
        { group_id: 'b', item_id: 'xlr', quantity: 3 },
      ]),
    )
    const result = flattenGroupItemsFromRows(['a'], rowsByGroupId)
    expect(result.leafItemsByGroupId.get('a')).toEqual([
      { item_id: 'case', quantity: 1 },
      { item_id: 'xlr', quantity: 6 },
    ])
  })

  it('sums the same leaf reached through two nested paths', () => {
    const { rowsByGroupId } = indexGroupItemRows(
      rows([
        { group_id: 'a', child_group_id: 'b', quantity: 1 },
        { group_id: 'a', child_group_id: 'c', quantity: 1 },
        { group_id: 'b', item_id: 'xlr', quantity: 2 },
        { group_id: 'c', item_id: 'xlr', quantity: 3 },
      ]),
    )
    const result = flattenGroupItemsFromRows(['a'], rowsByGroupId)
    expect(result.leafItemsByGroupId.get('a')).toEqual([
      { item_id: 'xlr', quantity: 5 },
    ])
    expect(result.descendantGroupIdsByRoot.get('a')?.sort()).toEqual(['b', 'c'])
  })

  it('returns empty leaves for a group with only empty nested groups', () => {
    const { rowsByGroupId } = indexGroupItemRows(
      rows([{ group_id: 'a', child_group_id: 'b', quantity: 1 }]),
    )
    const result = flattenGroupItemsFromRows(['a'], rowsByGroupId)
    expect(result.leafItemsByGroupId.get('a')).toEqual([])
    expect(result.descendantGroupIdsByRoot.get('a')).toEqual(['b'])
  })

  it('stops at the depth cap', () => {
    const chain: Array<GroupItemRow> = []
    for (let i = 0; i < GROUP_FLATTEN_MAX_DEPTH + 2; i += 1) {
      chain.push({
        group_id: `g${i}`,
        item_id: null,
        child_group_id: `g${i + 1}`,
        quantity: 1,
      })
    }
    chain.push({
      group_id: `g${GROUP_FLATTEN_MAX_DEPTH + 2}`,
      item_id: 'leaf',
      child_group_id: null,
      quantity: 1,
    })
    const { rowsByGroupId } = indexGroupItemRows(chain)
    const result = flattenGroupItemsFromRows(['g0'], rowsByGroupId)
    expect(
      result.leafItemsByGroupId
        .get('g0')
        ?.some((row) => row.item_id === 'leaf'),
    ).toBe(false)
  })

  it('does not infinite-loop on circular nested groups', () => {
    const { rowsByGroupId } = indexGroupItemRows(
      rows([
        { group_id: 'a', child_group_id: 'b', quantity: 1 },
        { group_id: 'b', child_group_id: 'a', quantity: 1 },
        { group_id: 'b', item_id: 'mic', quantity: 1 },
      ]),
    )
    const result = flattenGroupItemsFromRows(['a'], rowsByGroupId)
    expect(result.leafItemsByGroupId.get('a')).toEqual([
      { item_id: 'mic', quantity: 1 },
    ])
  })
})

describe('lineageIdsFromRows', () => {
  it('includes self, ancestors, and descendants', () => {
    const { rowsByGroupId, parentIdsByChild } = indexGroupItemRows(
      rows([
        { group_id: 'parent', child_group_id: 'mid', quantity: 1 },
        { group_id: 'mid', child_group_id: 'child', quantity: 1 },
        { group_id: 'child', item_id: 'mic', quantity: 1 },
      ]),
    )
    expect(
      lineageIdsFromRows('mid', rowsByGroupId, parentIdsByChild).sort(),
    ).toEqual(['child', 'mid', 'parent'])
  })
})
