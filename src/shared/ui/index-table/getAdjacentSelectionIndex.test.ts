import { describe, expect, it } from 'vitest'
import { getAdjacentSelectionIndex } from './getAdjacentSelectionIndex'

describe('getAdjacentSelectionIndex', () => {
  const ids = ['a', 'b', 'c']

  it('returns null for an empty list', () => {
    expect(
      getAdjacentSelectionIndex({
        ids: [],
        selectedId: 'a',
        delta: 1,
      }),
    ).toBe(null)
  })

  it('moves to the next and previous index', () => {
    expect(
      getAdjacentSelectionIndex({ ids, selectedId: 'a', delta: 1 }),
    ).toBe(1)
    expect(
      getAdjacentSelectionIndex({ ids, selectedId: 'b', delta: -1 }),
    ).toBe(0)
  })

  it('returns null at the list boundary', () => {
    expect(
      getAdjacentSelectionIndex({ ids, selectedId: 'c', delta: 1 }),
    ).toBe(null)
    expect(
      getAdjacentSelectionIndex({ ids, selectedId: 'a', delta: -1 }),
    ).toBe(null)
  })

  it('skips non-selectable rows', () => {
    expect(
      getAdjacentSelectionIndex({
        ids,
        selectedId: 'a',
        delta: 1,
        isIndexSelectable: (i) => i !== 1,
      }),
    ).toBe(2)
  })

  it('picks first or last when selection is missing from the list', () => {
    expect(
      getAdjacentSelectionIndex({ ids, selectedId: 'missing', delta: 1 }),
    ).toBe(0)
    expect(
      getAdjacentSelectionIndex({ ids, selectedId: 'missing', delta: -1 }),
    ).toBe(2)
  })
})
