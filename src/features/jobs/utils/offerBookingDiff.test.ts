import { describe, expect, it } from 'vitest'
import {
  buildSyncPreviewViewModel,
  catalogFromOfferDetail,
  computeOfferDiff,
  formatOfferDiffForPreview,
  labelForId,
  namesFromOfferDetail,
  type BookingsSnapshot,
  type ItemCatalogEntry,
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

  it('treats equivalent crew timestamps as the same period', () => {
    const snapshot: BookingsSnapshot = {
      ...emptySnapshot,
      crewPeriods: [
        {
          title: 'Sound engineer',
          start_at: '2026-01-01T08:00:00+00:00',
          end_at: '2026-01-02T18:00:00+00:00',
          needed_count: 2,
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
          crew_count: 2,
          start_date: '2026-01-01T08:00:00.000Z',
          end_date: '2026-01-02T18:00:00.000Z',
          daily_rate: 1000,
          total_price: 0,
          sort_order: 0,
        },
      ],
    }

    const diff = computeOfferDiff(snapshot, detail, new Map())
    expect(diff.crewChanges).toEqual([])
  })

  it('diffs specified transport IDs as a multiset', () => {
    const snapshot: BookingsSnapshot = {
      ...emptySnapshot,
      transport: [{ vehicle_id: 'van-1' }, { vehicle_id: 'van-1' }],
    }
    const detail: SyncLineItems = {
      ...baseDetail,
      transport_items: [
        {
          id: 't1',
          offer_basis_id: 'basis-1',
          vehicle_name: 'Van A',
          vehicle_id: 'van-1',
          vehicle_category: null,
          distance_km: null,
          start_date: '2026-01-01',
          end_date: '2026-01-02',
          daily_rate: 0,
          total_price: 0,
          is_internal: true,
          sort_order: 0,
        },
        {
          id: 't2',
          offer_basis_id: 'basis-1',
          vehicle_name: 'Van B',
          vehicle_id: 'van-2',
          vehicle_category: null,
          distance_km: null,
          start_date: '2026-01-01',
          end_date: '2026-01-02',
          daily_rate: 0,
          total_price: 0,
          is_internal: true,
          sort_order: 1,
        },
      ],
    }

    const diff = computeOfferDiff(snapshot, detail, new Map())
    const formatted = formatOfferDiffForPreview(
      diff,
      (id) => id,
      (id) => id,
    )
    expect(formatted.transportAdditions).toEqual(['van-2'])
    expect(formatted.transportRemovals).toEqual(['van-1'])
    expect(formatted.hasChanges).toBe(true)
  })

  it('does not treat unassigned transport as incomparable when counts match', () => {
    const snapshot: BookingsSnapshot = {
      ...emptySnapshot,
      transport: [{ vehicle_id: 'auto-picked' }],
    }
    const detail: SyncLineItems = {
      ...baseDetail,
      transport_items: [
        {
          id: 't1',
          offer_basis_id: 'basis-1',
          vehicle_name: 'Crew van',
          vehicle_id: null,
          vehicle_category: 'van_medium',
          distance_km: null,
          start_date: '2026-01-01',
          end_date: '2026-01-02',
          daily_rate: 0,
          total_price: 0,
          is_internal: true,
          sort_order: 0,
        },
      ],
    }

    const diff = computeOfferDiff(snapshot, detail, new Map())
    expect(diff.expectedTransport).toEqual([])
    expect(diff.unassignedTransport).toEqual(['Crew van (assigned on sync)'])

    const formatted = formatOfferDiffForPreview(
      diff,
      (id) => id,
      (id) => id,
    )
    expect(formatted.transportAdditions).toEqual([])
    expect(formatted.transportRemovals).toEqual([])
    expect(formatted.hasChanges).toBe(false)
    expect(formatted.transportSummary).toBe('Transport matches')
  })

  it('lists unassigned transport as additions when nothing is booked', () => {
    const detail: SyncLineItems = {
      ...baseDetail,
      transport_items: [
        {
          id: 't1',
          offer_basis_id: 'basis-1',
          vehicle_name: '',
          vehicle_id: null,
          vehicle_category: 'van_medium',
          distance_km: null,
          start_date: '2026-01-01',
          end_date: '2026-01-02',
          daily_rate: 0,
          total_price: 0,
          is_internal: true,
          sort_order: 0,
        },
      ],
    }

    const diff = computeOfferDiff(emptySnapshot, detail, new Map())
    const formatted = formatOfferDiffForPreview(
      diff,
      (id) => id,
      (id) => id,
    )
    expect(formatted.transportAdditions).toEqual([
      'van medium (assigned on sync)',
    ])
    expect(formatted.hasChanges).toBe(true)
  })

  it('shows extra booked vehicles as removals when unassigned lines cannot cover them', () => {
    const snapshot: BookingsSnapshot = {
      ...emptySnapshot,
      transport: [{ vehicle_id: 'van-1' }, { vehicle_id: 'van-2' }],
    }
    const detail: SyncLineItems = {
      ...baseDetail,
      transport_items: [
        {
          id: 't1',
          offer_basis_id: 'basis-1',
          vehicle_name: 'Crew van',
          vehicle_id: null,
          vehicle_category: 'van_medium',
          distance_km: null,
          start_date: '2026-01-01',
          end_date: '2026-01-02',
          daily_rate: 0,
          total_price: 0,
          is_internal: true,
          sort_order: 0,
        },
      ],
    }

    const formatted = formatOfferDiffForPreview(
      computeOfferDiff(snapshot, detail, new Map()),
      (id) => id,
      (id) => `Name-${id}`,
    )
    expect(formatted.transportRemovals).toEqual(['Name-van-2'])
    expect(formatted.transportAdditions).toEqual([])
    expect(formatted.hasChanges).toBe(true)
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

  it('does not show raw UUIDs when a name is missing', () => {
    const formatted = formatOfferDiffForPreview(
      {
        equipmentChanges: [
          {
            key: 'direct::aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
            item_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
            source_kind: 'direct',
            source_group_id: null,
            expected: 1,
            current: 0,
          },
        ],
        crewChanges: [],
        expectedTransport: ['ffffffff-1111-2222-3333-444444444444'],
        currentTransport: [],
        unassignedTransport: [],
      },
      (id) => labelForId(id, undefined, 'Unknown item'),
      (id) => labelForId(id, undefined, 'Unknown vehicle'),
    )

    expect(formatted.equipmentAdditions).toEqual(['Unknown item (+1)'])
    expect(formatted.transportAdditions).toEqual(['Unknown vehicle'])
  })

  it('reads item and vehicle names off the offer detail', () => {
    const names = namesFromOfferDetail({
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
              item: { id: 'item-a', name: 'Shure SM58' },
            },
          ],
        } as SyncLineItems['groups'][number],
      ],
      transport_items: [
        {
          id: 't1',
          offer_basis_id: 'basis-1',
          vehicle_name: 'Sprinter',
          vehicle_id: 'van-1',
          vehicle_category: null,
          distance_km: null,
          start_date: '2026-01-01',
          end_date: '2026-01-02',
          daily_rate: 0,
          total_price: 0,
          is_internal: true,
          sort_order: 0,
        },
      ],
    })

    expect(names.itemNames.get('item-a')).toBe('Shure SM58')
    expect(names.vehicleNames.get('van-1')).toBe('Sprinter')
  })
})

describe('buildSyncPreviewViewModel', () => {
  const formatItem = (id: string) => `Name-${id}`
  const catalog = new Map<string, ItemCatalogEntry>([
    [
      'item-a',
      {
        name: 'QL1',
        brand: 'Yamaha',
        model: 'QL1',
        category: 'Audio',
      },
    ],
    [
      'item-mic',
      {
        name: 'SM58',
        brand: 'Shure',
        model: 'SM58',
        category: 'Audio',
      },
    ],
    [
      'item-cable',
      {
        name: 'XLR',
        brand: 'Klotz',
        model: 'M1A',
        category: 'Cables',
      },
    ],
    [
      'item-extra',
      {
        name: 'Extra PAR',
        brand: 'Chauvet',
        model: 'SlimPAR',
        category: 'Lighting',
      },
    ],
  ])

  it('nests additions under offer groups with name, brand, and model', () => {
    const detail: SyncLineItems = {
      ...baseDetail,
      groups: [
        {
          id: 'g1',
          offer_basis_id: 'basis-1',
          group_name: 'FOH',
          sort_order: 0,
          created_at: '2026-01-01',
          items: [
            {
              id: 'i1',
              offer_group_id: 'g1',
              item_id: 'item-a',
              group_id: null,
              quantity: 2,
              unit_price: 0,
              total_price: 0,
              is_internal: false,
              sort_order: 0,
              item: {
                id: 'item-a',
                name: 'QL1',
                brand: { id: 'b1', name: 'Yamaha' },
                model: 'QL1',
              },
            },
          ],
        } as SyncLineItems['groups'][number],
      ],
    }

    const diff = computeOfferDiff(emptySnapshot, detail, new Map())
    const preview = buildSyncPreviewViewModel(
      diff,
      detail,
      catalog,
      new Map(),
      formatItem,
    )

    expect(preview.additionGroups).toHaveLength(1)
    expect(preview.additionGroups[0]?.name).toBe('FOH')
    expect(preview.additionGroups[0]?.lines).toEqual([
      {
        kind: 'direct',
        item: {
          key: 'direct::item-a',
          item_id: 'item-a',
          name: 'QL1',
          brand: 'Yamaha',
          model: 'QL1',
          category: 'Audio',
          quantity: 2,
        },
      },
    ])
    expect(preview.additionUngrouped).toEqual([])
    expect(preview.additionCompact.equipmentByCategory).toEqual([
      { categoryName: 'Audio', quantity: 2 },
    ])
  })

  it('expands inventory group leaves under the offer group', () => {
    const detail: SyncLineItems = {
      ...baseDetail,
      groups: [
        {
          id: 'g1',
          offer_basis_id: 'basis-1',
          group_name: 'Stage',
          sort_order: 0,
          created_at: '2026-01-01',
          items: [
            {
              id: 'i1',
              offer_group_id: 'g1',
              item_id: null,
              group_id: 'inv-group',
              quantity: 1,
              unit_price: 0,
              total_price: 0,
              is_internal: false,
              sort_order: 0,
              group: { id: 'inv-group', name: 'Vocal package' },
            },
          ],
        } as SyncLineItems['groups'][number],
      ],
    }
    const leafItemsByGroupId = new Map([
      [
        'inv-group',
        [
          { item_id: 'item-mic', quantity: 2 },
          { item_id: 'item-cable', quantity: 4 },
        ],
      ],
    ])

    const diff = computeOfferDiff(emptySnapshot, detail, leafItemsByGroupId)
    const preview = buildSyncPreviewViewModel(
      diff,
      detail,
      catalog,
      leafItemsByGroupId,
      formatItem,
    )

    expect(preview.additionGroups[0]?.name).toBe('Stage')
    expect(preview.additionGroups[0]?.lines).toEqual([
      {
        kind: 'group',
        group_id: 'inv-group',
        groupName: 'Vocal package',
        category: 'Audio',
        quantity: 1,
        items: [
          {
            key: 'group:inv-group:item-mic',
            item_id: 'item-mic',
            name: 'SM58',
            brand: 'Shure',
            model: 'SM58',
            category: 'Audio',
            quantity: 2,
          },
          {
            key: 'group:inv-group:item-cable',
            item_id: 'item-cable',
            name: 'XLR',
            brand: 'Klotz',
            model: 'M1A',
            category: 'Cables',
            quantity: 4,
          },
        ],
      },
    ])
    expect(preview.additionCompact.equipmentByCategory).toEqual([
      { categoryName: 'Audio', quantity: 1 },
    ])
  })

  it('counts two booked groups as 2× the group category, not leaf items', () => {
    const detail: SyncLineItems = {
      ...baseDetail,
      groups: [
        {
          id: 'g1',
          offer_basis_id: 'basis-1',
          group_name: 'Stage',
          sort_order: 0,
          created_at: '2026-01-01',
          items: [
            {
              id: 'i1',
              offer_group_id: 'g1',
              item_id: null,
              group_id: 'lyd-kit',
              quantity: 2,
              unit_price: 0,
              total_price: 0,
              is_internal: false,
              sort_order: 0,
              group: { id: 'lyd-kit', name: 'LYD package' },
            },
          ],
        } as SyncLineItems['groups'][number],
      ],
    }
    const leafItemsByGroupId = new Map([
      [
        'lyd-kit',
        Array.from({ length: 10 }, (_, index) => ({
          item_id: `item-lyd-${index}`,
          quantity: 1,
        })),
      ],
    ])
    const groupCatalog = new Map([
      ...catalog,
      ...Array.from(
        { length: 10 },
        (_, index) =>
          [
            `item-lyd-${index}`,
            {
              name: `Mic ${index + 1}`,
              brand: 'Shure',
              model: 'SM58',
              category: 'Audio',
            },
          ] as const,
      ),
    ])

    const diff = computeOfferDiff(emptySnapshot, detail, leafItemsByGroupId)
    const preview = buildSyncPreviewViewModel(
      diff,
      detail,
      groupCatalog,
      leafItemsByGroupId,
      formatItem,
      undefined,
      undefined,
      new Map([['lyd-kit', 'LYD']]),
    )

    expect(preview.additionGroups[0]?.lines[0]).toMatchObject({
      kind: 'group',
      groupName: 'LYD package',
      category: 'LYD',
      quantity: 2,
    })
    expect(preview.additionCompact.equipmentByCategory).toEqual([
      { categoryName: 'LYD', quantity: 2 },
    ])
  })

  it('puts booked extras not on the offer into ungrouped removals', () => {
    const snapshot: BookingsSnapshot = {
      ...emptySnapshot,
      equipment: [
        {
          item_id: 'item-extra',
          quantity: 3,
          source_kind: 'direct',
          source_group_id: null,
        },
      ],
    }
    const diff = computeOfferDiff(snapshot, baseDetail, new Map())
    const preview = buildSyncPreviewViewModel(
      diff,
      baseDetail,
      catalog,
      new Map(),
      formatItem,
    )

    expect(preview.removalGroups).toEqual([])
    expect(preview.removalUngrouped).toEqual([
      {
        key: 'direct::item-extra',
        item_id: 'item-extra',
        name: 'Extra PAR',
        brand: 'Chauvet',
        model: 'SlimPAR',
        category: 'Lighting',
        quantity: 3,
      },
    ])
    expect(preview.removalCompact.equipmentByCategory).toEqual([
      { categoryName: 'Lighting', quantity: 3 },
    ])
  })

  it('uses offer-detail catalog fallbacks when the lookup map is empty', () => {
    const detail: SyncLineItems = {
      ...baseDetail,
      groups: [
        {
          id: 'g1',
          offer_basis_id: 'basis-1',
          group_name: 'FOH',
          sort_order: 0,
          created_at: '2026-01-01',
          items: [
            {
              id: 'i1',
              offer_group_id: 'g1',
              item_id: 'item-a',
              group_id: null,
              quantity: 1,
              unit_price: 0,
              total_price: 0,
              is_internal: false,
              sort_order: 0,
              item: {
                id: 'item-a',
                name: 'QL1',
                brand: { id: 'b1', name: 'Yamaha' },
                model: 'QL1',
              },
            },
          ],
        } as SyncLineItems['groups'][number],
      ],
    }

    const seeded = catalogFromOfferDetail(detail)
    expect(seeded.get('item-a')).toEqual({
      name: 'QL1',
      brand: 'Yamaha',
      model: 'QL1',
      category: 'Other',
    })

    const diff = computeOfferDiff(emptySnapshot, detail, new Map())
    const preview = buildSyncPreviewViewModel(
      diff,
      detail,
      seeded,
      new Map(),
      formatItem,
    )
    expect(preview.additionGroups[0]?.lines[0]).toMatchObject({
      kind: 'direct',
      item: { name: 'QL1', brand: 'Yamaha', model: 'QL1', quantity: 1 },
    })
  })

  it('expands crew rows with title, category, times, and confirmation', () => {
    const detail: SyncLineItems = {
      ...baseDetail,
      crew_items: [
        {
          id: 'crew-1',
          offer_basis_id: 'basis-1',
          role_title: 'Sound engineer',
          role_category: 'audio',
          crew_count: 2,
          start_date: '2026-08-12T08:00:00.000Z',
          end_date: '2026-08-13T18:00:00.000Z',
          daily_rate: 0,
          total_price: 0,
          sort_order: 0,
        },
      ],
    }
    const snapshot: BookingsSnapshot = {
      ...emptySnapshot,
      crewPeriods: [
        {
          title: 'Sound engineer',
          start_at: '2026-08-12T08:00:00.000Z',
          end_at: '2026-08-13T18:00:00.000Z',
          needed_count: 1,
          role_category: 'audio',
          confirmedCount: 1,
        },
      ],
    }

    const diff = computeOfferDiff(snapshot, detail, new Map())
    const preview = buildSyncPreviewViewModel(
      diff,
      detail,
      catalog,
      new Map(),
      formatItem,
      undefined,
      snapshot,
    )

    expect(preview.additionCrew).toEqual([
      {
        key: expect.any(String),
        title: 'Sound engineer',
        category: 'audio',
        quantity: 1,
        start_at: '2026-08-12T08:00:00.000Z',
        end_at: '2026-08-13T18:00:00.000Z',
        confirmedCount: 1,
      },
    ])
    expect(preview.removalCrew).toEqual([])
  })
})
