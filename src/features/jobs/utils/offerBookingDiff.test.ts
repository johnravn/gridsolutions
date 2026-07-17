import { describe, expect, it } from 'vitest'
import {
  computeOfferDiff,
  formatOfferDiffForPreview,
  type BookingsSnapshot,
  type SyncLineItems,
} from './offerBookingDiff'

const emptySnapshot: BookingsSnapshot = {
  equipment: [],
  crewPeriods: [],
  transport: [],
}

const baseDetail: SyncLineItems = {
  groups: [],
  crew_items: [],
  transport_items: [],
  transport_groups: [],
}

describe('computeOfferDiff', () => {
  it('detects equipment additions and removals', () => {
    const snapshot: BookingsSnapshot = {
      ...emptySnapshot,
      equipment: [
        {
          item_id: 'item-a',
          quantity: 2,
          source_kind: 'direct',
          source_group_id: null,
        },
        {
          item_id: 'item-b',
          quantity: 1,
          source_kind: 'direct',
          source_group_id: null,
        },
      ],
    }

    const detail: SyncLineItems = {
      ...baseDetail,
      groups: [
        {
          id: 'g1',
          offer_basis_id: 'basis-1',
          name: 'Group',
          sort_order: 0,
          items: [
            {
              id: 'i1',
              offer_group_id: 'g1',
              item_id: 'item-a',
              group_id: null,
              quantity: 1,
              unit_price: 0,
              total_price: 0,
              sort_order: 0,
            },
            {
              id: 'i2',
              offer_group_id: 'g1',
              item_id: 'item-c',
              group_id: null,
              quantity: 3,
              unit_price: 0,
              total_price: 0,
              sort_order: 1,
            },
          ],
        } as SyncLineItems['groups'][number],
      ],
    }

    const diff = computeOfferDiff(snapshot, detail, new Map())
    expect(diff.equipmentChanges).toHaveLength(3)

    const itemA = diff.equipmentChanges.find((c) => c.item_id === 'item-a')
    expect(itemA?.current).toBe(2)
    expect(itemA?.expected).toBe(1)

    const itemB = diff.equipmentChanges.find((c) => c.item_id === 'item-b')
    expect(itemB?.current).toBe(1)
    expect(itemB?.expected).toBe(0)

    const itemC = diff.equipmentChanges.find((c) => c.item_id === 'item-c')
    expect(itemC?.current).toBe(0)
    expect(itemC?.expected).toBe(3)
  })

  it('detects crew count changes', () => {
    const snapshot: BookingsSnapshot = {
      ...emptySnapshot,
      crewPeriods: [
        {
          title: 'Sound engineer',
          start_at: '2026-01-01',
          end_at: '2026-01-02',
          needed_count: 1,
          role_category: null,
        },
      ],
    }

    const detail: SyncLineItems = {
      ...baseDetail,
      crew_items: [
        {
          id: 'crew-1',
          offer_basis_id: 'basis-1',
          role_title: 'Sound engineer',
          crew_count: 0,
          start_date: '2026-01-01',
          end_date: '2026-01-02',
          daily_rate: 1000,
          total_price: 0,
          sort_order: 0,
        },
      ],
    }

    const diff = computeOfferDiff(snapshot, detail, new Map())
    expect(diff.crewChanges).toHaveLength(1)
    expect(diff.crewChanges[0].current).toBe(1)
    expect(diff.crewChanges[0].expected).toBe(0)
  })
})

describe('formatOfferDiffForPreview', () => {
  it('splits additions and removals for equipment and crew', () => {
    const diff = computeOfferDiff(
      {
        equipment: [
          {
            item_id: 'item-a',
            quantity: 2,
            source_kind: 'direct',
            source_group_id: null,
          },
        ],
        crewPeriods: [
          {
            title: 'Sound engineer',
            start_at: '2026-01-01',
            end_at: '2026-01-02',
            needed_count: 1,
            role_category: null,
          },
        ],
        transport: [],
      },
      {
        groups: [
          {
            id: 'g1',
            offer_basis_id: 'basis-1',
            name: 'Group',
            sort_order: 0,
            items: [
              {
                id: 'i1',
                offer_group_id: 'g1',
                item_id: 'item-b',
                group_id: null,
                quantity: 1,
                unit_price: 0,
                total_price: 0,
                sort_order: 0,
              },
            ],
          } as SyncLineItems['groups'][number],
        ],
        crew_items: [],
        transport_items: [],
        transport_groups: [],
      },
      new Map(),
    )

    const formatted = formatOfferDiffForPreview(diff, (id) => `Name-${id}`)

    expect(formatted.equipmentRemovals).toEqual(['Name-item-a (-2)'])
    expect(formatted.equipmentAdditions).toEqual(['Name-item-b (+1)'])
    expect(formatted.crewRemovals).toEqual(['Sound engineer (1 → 0)'])
    expect(formatted.crewAdditions).toEqual([])
    expect(formatted.hasChanges).toBe(true)
  })
})
