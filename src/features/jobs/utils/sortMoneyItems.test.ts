import { describe, expect, it } from 'vitest'
import { compareMoneyItems, sortMoneyItems } from './sortMoneyItems'

describe('compareMoneyItems', () => {
  it('orders by type first', () => {
    expect(
      compareMoneyItems(
        { type: 'income', source: 'crew', amount: 1 },
        { type: 'expense', source: 'crew', amount: 1 },
      ),
    ).toBeGreaterThan(0)
  })

  it('orders by source when type matches', () => {
    expect(
      compareMoneyItems(
        { type: 'expense', source: 'manual', amount: 1 },
        { type: 'expense', source: 'crew', amount: 1 },
      ),
    ).toBeGreaterThan(0)
  })

  it('orders by amount when type and source match', () => {
    expect(
      compareMoneyItems(
        { type: 'expense', source: 'crew', amount: 10 },
        { type: 'expense', source: 'crew', amount: 5 },
      ),
    ).toBeGreaterThan(0)
  })
})

describe('sortMoneyItems', () => {
  it('sorts type → source → amount without mutating input', () => {
    const input = [
      { id: 'd', type: 'income', source: 'offer', amount: 100 },
      { id: 'a', type: 'expense', source: 'crew', amount: 50 },
      { id: 'c', type: 'expense', source: 'manual', amount: 10 },
      { id: 'b', type: 'expense', source: 'crew', amount: 20 },
      { id: 'e', type: 'income', source: 'conta', amount: 200 },
    ]
    const snapshot = [...input]
    expect(sortMoneyItems(input).map((i) => i.id)).toEqual([
      'b',
      'a',
      'c',
      'e',
      'd',
    ])
    expect(input).toEqual(snapshot)
  })
})
