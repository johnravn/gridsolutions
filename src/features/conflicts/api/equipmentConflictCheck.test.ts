import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeOfferDetail } from '@test/fixtures/offers'
import { buildOfferItemQuantityMap } from './equipmentConflictCheck'

const mockFrom = vi.fn()

vi.mock('@shared/api/supabase', () => ({
  supabase: {
    from: (...args: Array<unknown>) => mockFrom(...args),
  },
}))

describe('buildOfferItemQuantityMap', () => {
  beforeEach(() => {
    mockFrom.mockReset()
  })

  it('sums direct item quantities', async () => {
    const offer = makeOfferDetail({
      groups: [
        {
          id: 'g1',
          offer_id: 'o1',
          group_name: 'Gear',
          sort_order: 0,
          created_at: '2026-01-01T00:00:00.000Z',
          items: [
            {
              id: 'i1',
              offer_group_id: 'g1',
              item_id: 'item-a',
              group_id: null,
              quantity: 2,
              unit_price: 100,
              total_price: 200,
              is_internal: true,
              sort_order: 0,
            },
            {
              id: 'i2',
              offer_group_id: 'g1',
              item_id: 'item-a',
              group_id: null,
              quantity: 3,
              unit_price: 100,
              total_price: 300,
              is_internal: true,
              sort_order: 1,
            },
          ],
        },
      ],
    })

    const map = await buildOfferItemQuantityMap(offer)
    expect(map.get('item-a')).toBe(5)
  })

  it('expands group items via supabase lookup', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({
          data: [
            { group_id: 'grp-1', item_id: 'item-x', quantity: 2 },
            { group_id: 'grp-1', item_id: 'item-y', quantity: 1 },
          ],
          error: null,
        }),
      }),
    })

    const offer = makeOfferDetail({
      groups: [
        {
          id: 'g1',
          offer_id: 'o1',
          group_name: 'Gear',
          sort_order: 0,
          created_at: '2026-01-01T00:00:00.000Z',
          items: [
            {
              id: 'i1',
              offer_group_id: 'g1',
              item_id: null,
              group_id: 'grp-1',
              quantity: 3,
              unit_price: 100,
              total_price: 300,
              is_internal: true,
              sort_order: 0,
            },
          ],
        },
      ],
    })

    const map = await buildOfferItemQuantityMap(offer)
    expect(map.get('item-x')).toBe(6)
    expect(map.get('item-y')).toBe(3)
  })

  it('returns empty map for offer with no items', async () => {
    const map = await buildOfferItemQuantityMap(makeOfferDetail({ groups: [] }))
    expect(map.size).toBe(0)
    expect(mockFrom).not.toHaveBeenCalled()
  })
})
