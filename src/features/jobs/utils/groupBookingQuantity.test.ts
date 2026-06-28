import { describe, expect, it } from 'vitest'
import { impliedBookedGroupCount } from './groupBookingQuantity'

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
