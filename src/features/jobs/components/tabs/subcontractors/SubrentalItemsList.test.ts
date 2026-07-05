import { describe, expect, it } from 'vitest'
import {
  allSubrentalItemsUnassigned,
  countUnassignedSubrentalItems,
  subrentalItemsForSubcontractor,
} from '@features/jobs/components/tabs/subcontractors/SubrentalItemsList'
import type { SubrentalBookingRow } from '@features/jobs/api/subcontractorQueries'

function row(
  overrides: Partial<SubrentalBookingRow> & Pick<SubrentalBookingRow, 'id'>,
): SubrentalBookingRow {
  return {
    quantity: 1,
    external_status: 'planned',
    external_note: null,
    subcontractor_id: null,
    subcontractor_name: null,
    item_id: 'item-1',
    item_name: 'Camera',
    time_period_id: 'tp-1',
    period_title: 'Period',
    period_start_at: null,
    period_end_at: null,
    ...overrides,
  }
}

describe('countUnassignedSubrentalItems', () => {
  it('counts rows without subcontractor_id', () => {
    expect(
      countUnassignedSubrentalItems([
        row({ id: 'a' }),
        row({ id: 'b', subcontractor_id: 'sub-1' }),
        row({ id: 'c' }),
      ]),
    ).toBe(2)
  })

  it('returns 0 when all items are assigned', () => {
    expect(
      countUnassignedSubrentalItems([
        row({ id: 'a', subcontractor_id: 'sub-1' }),
      ]),
    ).toBe(0)
  })
})

describe('allSubrentalItemsUnassigned', () => {
  it('is true when every item is unassigned', () => {
    expect(
      allSubrentalItemsUnassigned([row({ id: 'a' }), row({ id: 'b' })]),
    ).toBe(true)
  })

  it('is false when any item is assigned', () => {
    expect(
      allSubrentalItemsUnassigned([
        row({ id: 'a' }),
        row({ id: 'b', subcontractor_id: 'sub-1' }),
      ]),
    ).toBe(false)
  })

  it('is false for an empty list', () => {
    expect(allSubrentalItemsUnassigned([])).toBe(false)
  })
})

describe('subrentalItemsForSubcontractor', () => {
  it('returns items assigned to the given customer', () => {
    expect(
      subrentalItemsForSubcontractor(
        [
          row({ id: 'a', subcontractor_id: 'cust-1' }),
          row({ id: 'b', subcontractor_id: 'cust-2' }),
          row({ id: 'c' }),
        ],
        'cust-1',
      ).map((item) => item.id),
    ).toEqual(['a'])
  })
})
