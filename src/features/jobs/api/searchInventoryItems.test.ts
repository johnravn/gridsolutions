import { beforeEach, describe, expect, it, vi } from 'vitest'
import { searchInventoryItems } from './searchInventoryItems'

const limit = vi.fn()
const orDeleted = vi.fn(() => ({
  or: vi.fn(() => ({ or: vi.fn(() => ({ limit })) })),
}))
const orBooking = vi.fn(() => orDeleted())
const eqActive = vi.fn(() => ({ or: orBooking }))
const eqCompany = vi.fn(() => ({ eq: eqActive }))
const select = vi.fn(() => ({ eq: eqCompany }))

vi.mock('@shared/api/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({ select })),
  },
}))

vi.mock('@shared/lib/generalFunctions', () => ({
  fuzzySearch: vi.fn(
    (
      items: Array<{ name: string }>,
      _term: string,
      _fields: unknown,
      _threshold: number,
    ) => items,
  ),
}))

describe('searchInventoryItems', () => {
  beforeEach(() => {
    limit.mockReset()
  })

  it('returns an empty list for a blank query', async () => {
    await expect(searchInventoryItems('company-1', '   ')).resolves.toEqual([])
    expect(select).not.toHaveBeenCalled()
  })

  it('maps inventory_index rows and ranks them', async () => {
    limit.mockResolvedValue({
      data: [
        {
          id: 'item-1',
          name: 'Shure SM58',
          is_group: false,
          on_hand: 4,
          current_price: 120,
          item_kind: 'stock',
          brand_name: 'Shure',
          model: 'SM58',
          nicknames: 'share',
          category_name: 'Mics',
        },
      ],
      error: null,
    })

    const results = await searchInventoryItems('company-1', 'share')
    expect(results).toEqual([
      {
        id: 'item-1',
        name: 'Shure SM58',
        is_group: false,
        on_hand: 4,
        price: 120,
        item_kind: 'stock',
        brand_name: 'Shure',
        model: 'SM58',
        nicknames: 'share',
        category_name: 'Mics',
      },
    ])
  })
})
