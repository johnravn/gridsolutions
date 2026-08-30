import { describe, expect, it } from 'vitest'
import {
  categoryBookingIds,
  countSelectedBookingRows,
  selectionState,
  setIdsSelected,
} from './equipmentBookingSelection'

const audio = {
  groupEntries: [
    { rows: [{ id: 'g1a' }, { id: 'g1b' }] },
    { rows: [{ id: 'g2a' }] },
  ],
  directRows: [{ id: 'd1' }, { id: 'd2' }],
}

describe('categoryBookingIds', () => {
  it('collects group member and direct row ids', () => {
    expect(categoryBookingIds(audio)).toEqual(['g1a', 'g1b', 'g2a', 'd1', 'd2'])
  })
})

describe('countSelectedBookingRows', () => {
  it('counts a group once even if several member rows are selected', () => {
    expect(
      countSelectedBookingRows([audio], new Set(['g1a', 'g1b', 'd1'])),
    ).toBe(2)
  })

  it('counts a group if any member is selected', () => {
    expect(countSelectedBookingRows([audio], new Set(['g2a']))).toBe(1)
  })
})

describe('selectionState', () => {
  it('returns false when nothing is selected', () => {
    expect(selectionState(new Set(), ['a', 'b'])).toBe(false)
  })

  it('returns true when every id is selected', () => {
    expect(selectionState(new Set(['a', 'b']), ['a', 'b'])).toBe(true)
  })

  it('returns indeterminate when some ids are selected', () => {
    expect(selectionState(new Set(['a']), ['a', 'b'])).toBe('indeterminate')
  })
})

describe('setIdsSelected', () => {
  it('adds and removes ids without mutating the previous set', () => {
    const prev = new Set(['a'])
    const added = setIdsSelected(prev, ['b', 'c'], true)
    expect(Array.from(added).sort()).toEqual(['a', 'b', 'c'])
    expect(prev.has('b')).toBe(false)

    const removed = setIdsSelected(added, ['a', 'c'], false)
    expect(Array.from(removed)).toEqual(['b'])
  })
})
