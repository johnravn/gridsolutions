import { describe, expect, it } from 'vitest'
import { inventoryDetailKey, inventoryIndexKey } from './queries'

describe('inventory query keys', () => {
  it('builds stable inventory index keys', () => {
    expect(
      inventoryIndexKey(
        'company-1',
        2,
        25,
        'mic',
        true,
        false,
        true,
        true,
        false,
        true,
        true,
        'audio',
        'name',
        'asc',
      ),
    ).toEqual([
      'company',
      'company-1',
      'inventory-index',
      2,
      25,
      'mic',
      true,
      false,
      true,
      true,
      false,
      true,
      true,
      'audio',
      'name',
      'asc',
    ])
  })

  it('builds inventory detail keys', () => {
    expect(inventoryDetailKey('company-1', 'item-9')).toEqual([
      'company',
      'company-1',
      'inventory-detail',
      'item-9',
    ])
  })
})
