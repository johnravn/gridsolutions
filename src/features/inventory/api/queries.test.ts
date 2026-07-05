import { describe, expect, it } from 'vitest'
import {
  inventoryDetailKey,
  inventoryIndexKey,
  inventoryIndexKeyAll,
} from './queries'

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

  it('builds inventory index-all keys without pagination', () => {
    expect(
      inventoryIndexKeyAll(
        'company-1',
        '',
        true,
        true,
        true,
        true,
        false,
        true,
        true,
        null,
        'on_hand',
        'desc',
      ),
    ).toContain('inventory-index-all')
    expect(
      inventoryIndexKeyAll(
        'company-1',
        '',
        true,
        true,
        true,
        true,
        false,
        true,
        true,
        null,
        'on_hand',
        'desc',
      )[2],
    ).toBe('inventory-index-all')
  })

  it('builds inventory detail keys', () => {
    expect(inventoryDetailKey('company-1', 'item-1')).toEqual([
      'company',
      'company-1',
      'inventory-detail',
      'item-1',
    ])
  })
})
