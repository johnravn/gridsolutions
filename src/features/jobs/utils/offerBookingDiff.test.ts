import { describe, expect, it } from 'vitest'
import {
  activeIgnoresAgainstDiff,
  buildSyncPreviewViewModel,
  catalogFromOfferDetail,
  classifyOfferBasisSyncStatus,
  computeOfferDiff,
  emptyBookingSyncIgnoreSets,
  formatOfferDiffForPreview,
  labelForId,
  makeEquipmentKey,
  namesFromOfferDetail,
  parseBookingSyncIgnores,
  pruneBookingSyncIgnores,
  bookingSyncIgnoreSetsIsEmpty,
  reservationMatchesKeepKeys,
  serializeBookingSyncIgnores,
  setIgnoreNode,
  splitSyncPreviewByIgnores,
  subtractIgnoresFromDiff,
  syncPreviewRemovalEquipmentKeys,
  type BookingsSnapshot,
  type ItemCatalogEntry,
  type SyncLineItems,
  type SyncPreviewViewModel,
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
          key: 'direct::item-a:',
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
            key: 'group:inv-group:item-mic:',
            item_id: 'item-mic',
            name: 'SM58',
            brand: 'Shure',
            model: 'SM58',
            category: 'Audio',
            quantity: 2,
          },
          {
            key: 'group:inv-group:item-cable:',
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
        key: 'direct::item-extra:',
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

describe('multi-period equipment keys', () => {
  it('treats the same item on two periods as distinct', () => {
    const snapshot: BookingsSnapshot = {
      ...emptySnapshot,
      equipment: [
        {
          item_id: 'mixer',
          quantity: 1,
          source_kind: 'direct',
          source_group_id: null,
          time_period_id: 'period-3d',
        },
        {
          item_id: 'mixer',
          quantity: 1,
          source_kind: 'direct',
          source_group_id: null,
          time_period_id: 'period-2d',
        },
      ],
    }

    const detail: SyncLineItems = {
      ...baseDetail,
      groups: [
        {
          id: 'g1',
          offer_basis_id: 'b1',
          group_name: 'PA',
          sort_order: 0,
          created_at: '',
          items: [
            {
              id: 'l1',
              offer_group_id: 'g1',
              item_id: 'mixer',
              group_id: null,
              quantity: 1,
              unit_price: 100,
              total_price: 100,
              is_internal: true,
              sort_order: 0,
              time_period_id: 'period-3d',
            },
            {
              id: 'l2',
              offer_group_id: 'g1',
              item_id: 'mixer',
              group_id: null,
              quantity: 1,
              unit_price: 100,
              total_price: 100,
              is_internal: true,
              sort_order: 1,
              time_period_id: 'period-2d',
            },
          ],
        },
      ],
    }

    const diff = computeOfferDiff(snapshot, detail, new Map())
    expect(diff.equipmentChanges).toHaveLength(0)
  })

  it('flags a missing period window as an addition', () => {
    const snapshot: BookingsSnapshot = {
      ...emptySnapshot,
      equipment: [
        {
          item_id: 'mixer',
          quantity: 1,
          source_kind: 'direct',
          source_group_id: null,
          time_period_id: 'period-3d',
        },
      ],
    }

    const detail: SyncLineItems = {
      ...baseDetail,
      groups: [
        {
          id: 'g1',
          offer_basis_id: 'b1',
          group_name: 'PA',
          sort_order: 0,
          created_at: '',
          items: [
            {
              id: 'l1',
              offer_group_id: 'g1',
              item_id: 'mixer',
              group_id: null,
              quantity: 1,
              unit_price: 100,
              total_price: 100,
              is_internal: true,
              sort_order: 0,
              time_period_id: 'period-3d',
            },
            {
              id: 'l2',
              offer_group_id: 'g1',
              item_id: 'mixer',
              group_id: null,
              quantity: 1,
              unit_price: 100,
              total_price: 100,
              is_internal: true,
              sort_order: 1,
              time_period_id: 'period-2d',
            },
          ],
        },
      ],
    }

    const diff = computeOfferDiff(snapshot, detail, new Map())
    expect(diff.equipmentChanges).toHaveLength(1)
    expect(diff.equipmentChanges[0].time_period_id).toBe('period-2d')
    expect(diff.equipmentChanges[0].expected).toBe(1)
    expect(diff.equipmentChanges[0].current).toBe(0)
  })
})

describe('reservationMatchesKeepKeys', () => {
  it('returns false when nothing is marked to keep', () => {
    expect(
      reservationMatchesKeepKeys(
        {
          item_id: 'item-a',
          source_kind: 'direct',
          source_group_id: null,
          time_period_id: 'p1',
        },
        new Set(),
      ),
    ).toBe(false)
  })

  it('matches a full equipment key including the time period', () => {
    const key = makeEquipmentKey({
      item_id: 'item-a',
      source_kind: 'direct',
      source_group_id: null,
      time_period_id: 'p1',
    })
    expect(
      reservationMatchesKeepKeys(
        {
          item_id: 'item-a',
          source_kind: 'direct',
          source_group_id: null,
          time_period_id: 'p1',
        },
        new Set([key]),
      ),
    ).toBe(true)
  })

  it('matches preview keys that omit the time period', () => {
    const previewKey = makeEquipmentKey({
      item_id: 'item-a',
      source_kind: 'group',
      source_group_id: 'g1',
    })
    expect(
      reservationMatchesKeepKeys(
        {
          item_id: 'item-a',
          source_kind: 'group',
          source_group_id: 'g1',
          time_period_id: 'p1',
        },
        new Set([previewKey]),
      ),
    ).toBe(true)
  })
})

describe('syncPreviewRemovalEquipmentKeys', () => {
  it('collects keys from offer groups, inventory groups, and ungrouped items', () => {
    expect(
      syncPreviewRemovalEquipmentKeys({
        removalGroups: [
          {
            id: 'og1',
            name: 'PA',
            lines: [
              {
                kind: 'direct',
                item: {
                  key: 'direct::mixer:',
                  item_id: 'mixer',
                  name: 'Mixer',
                  brand: null,
                  model: null,
                  category: 'Audio',
                  quantity: 1,
                },
              },
              {
                kind: 'group',
                group_id: 'ig1',
                groupName: 'Mics',
                category: 'Audio',
                quantity: 1,
                items: [
                  {
                    key: 'group:ig1:mic:',
                    item_id: 'mic',
                    name: 'Mic',
                    brand: null,
                    model: null,
                    category: 'Audio',
                    quantity: 2,
                  },
                ],
              },
            ],
          },
        ],
        removalUngrouped: [
          {
            key: 'direct::extra:',
            item_id: 'extra',
            name: 'Extra',
            brand: null,
            model: null,
            category: 'Other',
            quantity: 1,
          },
        ],
      }),
    ).toEqual(['direct::mixer:', 'group:ig1:mic:', 'direct::extra:'])
  })
})

function previewFixture(): SyncPreviewViewModel {
  return {
    equipmentAdditions: ['Mixer (+1)'],
    equipmentRemovals: ['Extra (-1)'],
    crewAdditions: ['Sound (0 → 1)'],
    crewRemovals: ['Driver (1 → 0)'],
    transportAdditions: ['Van'],
    transportRemovals: ['Truck'],
    transportSummary: null,
    hasChanges: true,
    additionCompact: {
      equipmentByCategory: [{ categoryName: 'Audio', quantity: 1 }],
      vehicleNames: ['Van'],
      crewLabels: ['Sound'],
    },
    removalCompact: {
      equipmentByCategory: [{ categoryName: 'Other', quantity: 1 }],
      vehicleNames: ['Truck'],
      crewLabels: ['Driver'],
    },
    additionGroups: [
      {
        id: 'og1',
        name: 'PA',
        lines: [
          {
            kind: 'direct',
            item: {
              key: 'direct::mixer:',
              item_id: 'mixer',
              name: 'Mixer',
              brand: null,
              model: null,
              category: 'Audio',
              quantity: 1,
            },
          },
          {
            kind: 'group',
            group_id: 'ig1',
            groupName: 'Mics',
            category: 'Audio',
            quantity: 1,
            items: [
              {
                key: 'group:ig1:mic:',
                item_id: 'mic',
                name: 'Mic',
                brand: null,
                model: null,
                category: 'Audio',
                quantity: 2,
              },
              {
                key: 'group:ig1:stand:',
                item_id: 'stand',
                name: 'Stand',
                brand: null,
                model: null,
                category: 'Audio',
                quantity: 1,
              },
            ],
          },
        ],
      },
    ],
    removalGroups: [],
    additionUngrouped: [],
    removalUngrouped: [
      {
        key: 'direct::extra:',
        item_id: 'extra',
        name: 'Extra',
        brand: null,
        model: null,
        category: 'Other',
        quantity: 1,
      },
    ],
    additionCrew: [
      {
        key: 'crew-sound',
        title: 'Sound',
        category: 'tech',
        quantity: 1,
        start_at: '2026-01-01T00:00:00.000Z',
        end_at: '2026-01-02T00:00:00.000Z',
        confirmedCount: 0,
      },
    ],
    removalCrew: [
      {
        key: 'crew-driver',
        title: 'Driver',
        category: 'logistics',
        quantity: 1,
        start_at: '2026-01-01T00:00:00.000Z',
        end_at: '2026-01-02T00:00:00.000Z',
        confirmedCount: 1,
      },
    ],
    additionVehicles: [{ key: 'van-1', name: 'Van' }],
    removalVehicles: [{ key: 'truck-1', name: 'Truck' }],
  }
}

describe('booking sync ignores', () => {
  it('round-trips serialize and parse', () => {
    const sets = emptyBookingSyncIgnoreSets()
    sets.equipment.remove.add('direct::extra:')
    sets.crew.add.add('crew-sound')
    expect(parseBookingSyncIgnores(serializeBookingSyncIgnores(sets))).toEqual(
      sets,
    )
  })

  it('ignores malformed stored json', () => {
    expect(bookingSyncIgnoreSetsIsEmpty(parseBookingSyncIgnores(null))).toBe(
      true,
    )
    expect(
      parseBookingSyncIgnores([{ kind: 'nope', side: 'add', key: 'x' }])
        .equipment.add.size,
    ).toBe(0)
  })

  it('splits a parent node so only ignored leaves move right', () => {
    const preview = previewFixture()
    const ignores = setIgnoreNode(
      emptyBookingSyncIgnoreSets(),
      {
        side: 'add',
        equipmentKeys: ['group:ig1:mic:'],
        crewKeys: [],
        transportKeys: [],
        label: 'Mic',
      },
      true,
    )
    const { remaining, ignored } = splitSyncPreviewByIgnores(preview, ignores)
    expect(remaining.additionGroups[0]?.lines).toHaveLength(2)
    const remainingGroup = remaining.additionGroups[0]?.lines.find(
      (line) => line.kind === 'group',
    )
    expect(remainingGroup?.kind === 'group' && remainingGroup.items).toEqual([
      expect.objectContaining({ key: 'group:ig1:stand:' }),
    ])
    const ignoredGroup = ignored.additionGroups[0]?.lines.find(
      (line) => line.kind === 'group',
    )
    expect(ignoredGroup?.kind === 'group' && ignoredGroup.items).toEqual([
      expect.objectContaining({ key: 'group:ig1:mic:' }),
    ])
    expect(remaining.hasChanges).toBe(true)
    expect(ignored.hasChanges).toBe(true)
  })

  it('moves a whole removal item to the ignored column', () => {
    const preview = previewFixture()
    const ignores = setIgnoreNode(
      emptyBookingSyncIgnoreSets(),
      {
        side: 'remove',
        equipmentKeys: ['direct::extra:'],
        crewKeys: [],
        transportKeys: [],
        label: 'Extra',
      },
      true,
    )
    const { remaining, ignored } = splitSyncPreviewByIgnores(preview, ignores)
    expect(remaining.removalUngrouped).toEqual([])
    expect(ignored.removalUngrouped.map((item) => item.key)).toEqual([
      'direct::extra:',
    ])
  })

  it('prunes stale ignore keys that are no longer in the preview', () => {
    const ignores = emptyBookingSyncIgnoreSets()
    ignores.equipment.remove.add('direct::extra:')
    ignores.equipment.remove.add('direct::gone:')
    const pruned = pruneBookingSyncIgnores(
      ignores,
      parseBookingSyncIgnores([
        { kind: 'equipment', side: 'remove', key: 'direct::extra:' },
      ]),
    )
    expect([...pruned.equipment.remove]).toEqual(['direct::extra:'])
  })

  it('subtracts ignored additions and removals from a live diff', () => {
    const mixerKey = makeEquipmentKey({
      item_id: 'mixer',
      source_kind: 'direct',
      source_group_id: null,
    })
    const extraKey = makeEquipmentKey({
      item_id: 'extra',
      source_kind: 'direct',
      source_group_id: null,
    })
    const diff = {
      equipmentChanges: [
        {
          key: mixerKey,
          item_id: 'mixer',
          source_kind: 'direct' as const,
          source_group_id: null,
          time_period_id: null,
          expected: 3,
          current: 1,
        },
        {
          key: extraKey,
          item_id: 'extra',
          source_kind: 'direct' as const,
          source_group_id: null,
          time_period_id: null,
          expected: 0,
          current: 1,
        },
      ],
      crewChanges: [],
      expectedTransport: ['van-1'],
      currentTransport: ['truck-1'],
      unassignedTransport: [],
    }
    const ignores = emptyBookingSyncIgnoreSets()
    ignores.equipment.add.add(mixerKey)
    ignores.equipment.remove.add(extraKey)
    ignores.transport.add.add('van-1')
    ignores.transport.remove.add('truck-1')

    const remaining = subtractIgnoresFromDiff(diff, ignores)
    expect(remaining.equipmentChanges).toEqual([])
    expect(remaining.expectedTransport).toEqual([])
    expect(remaining.currentTransport).toEqual([])
    expect(formatOfferDiffForPreview(remaining, (id) => id).hasChanges).toBe(
      false,
    )
    expect(
      bookingSyncIgnoreSetsIsEmpty(activeIgnoresAgainstDiff(ignores, diff)),
    ).toBe(false)
    expect(
      classifyOfferBasisSyncStatus({
        remainingHasChanges: false,
        hasActiveIgnores: true,
      }),
    ).toEqual(
      expect.objectContaining({
        label: 'Partially synced',
        color: 'amber',
      }),
    )
  })

  it('treats an ignored quantity increase as still currently booked', () => {
    const key = makeEquipmentKey({
      item_id: 'mixer',
      source_kind: 'direct',
      source_group_id: null,
      time_period_id: 'p1',
    })
    const previewKey = makeEquipmentKey({
      item_id: 'mixer',
      source_kind: 'direct',
      source_group_id: null,
    })
    const ignores = emptyBookingSyncIgnoreSets()
    ignores.equipment.add.add(previewKey)
    expect(
      reservationMatchesKeepKeys(
        {
          item_id: 'mixer',
          source_kind: 'direct',
          source_group_id: null,
          time_period_id: 'p1',
        },
        ignores.equipment.add,
      ),
    ).toBe(true)
    expect(
      subtractIgnoresFromDiff(
        {
          equipmentChanges: [
            {
              key,
              item_id: 'mixer',
              source_kind: 'direct',
              source_group_id: null,
              time_period_id: 'p1',
              expected: 3,
              current: 1,
            },
          ],
          crewChanges: [],
          expectedTransport: [],
          currentTransport: [],
          unassignedTransport: [],
        },
        ignores,
      ).equipmentChanges,
    ).toEqual([])
  })
})
