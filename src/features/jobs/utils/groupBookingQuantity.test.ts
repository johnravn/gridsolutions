import { describe, expect, it } from 'vitest'
import {
  bookedGroupQuantitiesByGroupAndPeriod,
  bookedGroupQuantitiesByGroupId,
  impliedBookedGroupCount,
} from './groupBookingQuantity'

describe('impliedBookedGroupCount', () => {
  it('returns 1 when template is empty', () => {
    expect(impliedBookedGroupCount([], [{ item_id: 'a', quantity: 5 }])).toBe(1)
  })

  it('computes minimum whole groups from booked lines', () => {
    const template = [
      { item_id: 'mic', quantity: 2 },
      { item_id: 'stand', quantity: 1 },
    ]
    const booked = [
      { item_id: 'mic', quantity: 4 },
      { item_id: 'stand', quantity: 2 },
    ]
    expect(impliedBookedGroupCount(template, booked)).toBe(2)
  })

  it('floors partial groups and never returns below 1', () => {
    const template = [{ item_id: 'mic', quantity: 3 }]
    const booked = [{ item_id: 'mic', quantity: 2 }]
    expect(impliedBookedGroupCount(template, booked)).toBe(1)
  })
})

describe('bookedGroupQuantitiesByGroupId', () => {
  const template = [
    { item_id: 'mic', quantity: 2 },
    { item_id: 'stand', quantity: 1 },
  ]
  const groupItemsMap = new Map([['kit-a', template]])

  it('counts one group once, not once per member row', () => {
    const quantities = bookedGroupQuantitiesByGroupId(
      [
        {
          source_group_id: 'kit-a',
          time_period_id: 'p1',
          item_id: 'mic',
          quantity: 2,
        },
        {
          source_group_id: 'kit-a',
          time_period_id: 'p1',
          item_id: 'stand',
          quantity: 1,
        },
      ],
      groupItemsMap,
    )
    expect(quantities.get('kit-a')).toBe(1)
  })

  it('infers multiple copies of the same group in one period', () => {
    const quantities = bookedGroupQuantitiesByGroupId(
      [
        {
          source_group_id: 'kit-a',
          time_period_id: 'p1',
          item_id: 'mic',
          quantity: 4,
        },
        {
          source_group_id: 'kit-a',
          time_period_id: 'p1',
          item_id: 'stand',
          quantity: 2,
        },
      ],
      groupItemsMap,
    )
    expect(quantities.get('kit-a')).toBe(2)
  })

  it('sums implied counts across time periods', () => {
    const quantities = bookedGroupQuantitiesByGroupId(
      [
        {
          source_group_id: 'kit-a',
          time_period_id: 'p1',
          item_id: 'mic',
          quantity: 2,
        },
        {
          source_group_id: 'kit-a',
          time_period_id: 'p1',
          item_id: 'stand',
          quantity: 1,
        },
        {
          source_group_id: 'kit-a',
          time_period_id: 'p2',
          item_id: 'mic',
          quantity: 2,
        },
        {
          source_group_id: 'kit-a',
          time_period_id: 'p2',
          item_id: 'stand',
          quantity: 1,
        },
      ],
      groupItemsMap,
    )
    expect(quantities.get('kit-a')).toBe(2)
  })
})

describe('bookedGroupQuantitiesByGroupAndPeriod', () => {
  const template = [
    { item_id: 'mic', quantity: 2 },
    { item_id: 'stand', quantity: 1 },
  ]
  const groupItemsMap = new Map([['kit-a', template]])

  it('keeps separate quantities per period', () => {
    const quantities = bookedGroupQuantitiesByGroupAndPeriod(
      [
        {
          source_group_id: 'kit-a',
          time_period_id: 'p1',
          item_id: 'mic',
          quantity: 2,
        },
        {
          source_group_id: 'kit-a',
          time_period_id: 'p1',
          item_id: 'stand',
          quantity: 1,
        },
        {
          source_group_id: 'kit-a',
          time_period_id: 'p2',
          item_id: 'mic',
          quantity: 4,
        },
        {
          source_group_id: 'kit-a',
          time_period_id: 'p2',
          item_id: 'stand',
          quantity: 2,
        },
      ],
      groupItemsMap,
    )
    expect(quantities.get('kit-a:p1')?.quantity).toBe(1)
    expect(quantities.get('kit-a:p2')?.quantity).toBe(2)
  })
})
