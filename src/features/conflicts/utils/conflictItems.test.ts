import { describe, expect, it } from 'vitest'
import {
  CONFLICT_KIND_LABEL,
  DEFAULT_CONFLICT_LIST_FILTERS,
  buildConflictCards,
  conflictInvolvesProjectLead,
  conflictItemId,
  conflictJobLabels,
  conflictJobsLine,
  conflictKindLabel,
  conflictListFooterLabel,
  conflictOverlap,
  conflictOpenJobs,
  conflictResourceName,
  conflictWhyCopy,
  countProjectLeadConflicts,
  filterConflictItems,
  sortConflictItems,
} from './conflictItems'
import type {
  CrewConflictRow,
  EquipmentConflictRow,
  GroupConflictRow,
} from '../api/queries'

const crew: CrewConflictRow = {
  user_id: 'u1',
  user_display_name: 'Anna',
  period_id_1: 'p1',
  period_id_2: 'p2',
  job_id_1: 'j1',
  job_id_2: null,
  job_title_1: 'Job A',
  job_title_2: null,
  start_1: '2026-01-01T08:00:00.000Z',
  end_1: '2026-01-01T18:00:00.000Z',
  start_2: '2026-01-01T10:00:00.000Z',
  end_2: '2026-01-01T20:00:00.000Z',
  forced_1: false,
  forced_2: false,
}

const equipment: EquipmentConflictRow = {
  item_id: 'item-1',
  item_name: 'Mic',
  capacity: 8,
  total_reserved: 12,
  start_at: '2026-01-01T08:00:00.000Z',
  end_at: '2026-01-01T12:00:00.000Z',
  job_ids: ['j1', 'j2', 'j3'],
  job_titles: ['Job A', 'Job B', 'Job C'],
  has_forced: false,
}

const group: GroupConflictRow = {
  group_id_1: 'g1',
  group_id_2: 'g2',
  group_name_1: 'Vocal package',
  group_name_2: 'Vocal package',
  period_id_1: 'p1',
  period_id_2: 'p2',
  job_id_1: 'j1',
  job_id_2: 'j2',
  job_title_1: 'Job A',
  job_title_2: 'Job B',
  start_1: '2026-01-01T08:00:00.000Z',
  end_1: '2026-01-01T18:00:00.000Z',
  start_2: '2026-01-01T10:00:00.000Z',
  end_2: '2026-01-01T20:00:00.000Z',
  forced_1: false,
  forced_2: false,
}

describe('conflictItemId', () => {
  it('is stable without a list index', () => {
    expect(conflictItemId('crew', 'red', crew)).toBe('crew-red-u1-p1-p2')
    expect(conflictItemId('equipment', 'red', equipment)).toBe(
      'equipment-red-item-1-j1|j2|j3-2026-01-01T08:00:00.000Z-2026-01-01T12:00:00.000Z',
    )
  })
})

describe('buildConflictCards', () => {
  it('uses the same id on repeated builds', () => {
    const first = buildConflictCards([crew], [], [], [])
    const second = buildConflictCards([crew], [], [], [])
    expect(first[0]?.key).toBe(second[0]?.key)
    expect(first[0]?.key).toBe('crew-red-u1-p1-p2')
  })
})

describe('conflict overview copy', () => {
  it('names a personal booking on the missing job side', () => {
    const item = buildConflictCards([crew], [], [], [])[0]
    expect(item).toBeDefined()
    if (!item) return
    expect(conflictResourceName(item)).toBe('Anna')
    expect(conflictJobLabels(item)).toEqual(['Job A', 'a personal booking'])
    expect(conflictJobsLine(item)).toBe('Job A and a personal booking')
    expect(conflictOverlap(item)?.durationMs).toBe(8 * 60 * 60 * 1000)
    expect(conflictOpenJobs(item)).toEqual([{ jobId: 'j1', title: 'Job A' }])
  })

  it('lists every equipment job', () => {
    const item = buildConflictCards([], [], [equipment], [])[0]
    expect(item).toBeDefined()
    if (!item) return
    expect(conflictJobLabels(item)).toEqual(['Job A', 'Job B', 'Job C'])
    expect(conflictJobsLine(item)).toBe('Job A, Job B, and Job C')
  })
})

describe('filterConflictItems', () => {
  it('filters by kind and unresolved vs forced', () => {
    const forcedCrew = { ...crew, forced_1: true }
    const items = buildConflictCards([crew, forcedCrew], [], [equipment], [])
    expect(
      filterConflictItems(items, {
        ...DEFAULT_CONFLICT_LIST_FILTERS,
        status: 'unresolved',
        kind: 'all',
      }).map((item) => item.kind),
    ).toEqual(['crew', 'equipment'])
    expect(
      filterConflictItems(items, {
        ...DEFAULT_CONFLICT_LIST_FILTERS,
        status: 'all',
        kind: 'crew',
      }),
    ).toHaveLength(2)
    expect(
      filterConflictItems(items, {
        ...DEFAULT_CONFLICT_LIST_FILTERS,
        status: 'forced',
        kind: 'crew',
      }),
    ).toHaveLength(1)
  })

  it('keeps group conflicts as a separate type and filter', () => {
    const items = buildConflictCards([crew], [], [equipment], [group])
    const groupItem = items.find((item) => item.kind === 'group')
    expect(groupItem).toBeDefined()
    if (!groupItem) return
    expect(conflictKindLabel(groupItem.kind)).toBe('Equipment group')
    expect(Object.keys(CONFLICT_KIND_LABEL)).toEqual([
      'crew',
      'vehicle',
      'equipment',
      'group',
    ])
    expect(
      filterConflictItems(items, {
        ...DEFAULT_CONFLICT_LIST_FILTERS,
        status: 'all',
        kind: 'equipment',
      }).map((item) => item.kind),
    ).toEqual(['equipment'])
    expect(
      filterConflictItems(items, {
        ...DEFAULT_CONFLICT_LIST_FILTERS,
        status: 'all',
        kind: 'group',
      }).map((item) => item.kind),
    ).toEqual(['group'])
  })

  it('scopes to my lead jobs when requested', () => {
    const items = buildConflictCards([crew], [], [equipment], [group])
    expect(
      filterConflictItems(
        items,
        { ...DEFAULT_CONFLICT_LIST_FILTERS, status: 'all', scope: 'my_leads' },
        ['j3'],
      ).map((item) => item.kind),
    ).toEqual(['equipment'])
  })
})

describe('sortConflictItems', () => {
  it('orders by soonest unresolved, then severity', () => {
    const laterEquipment = {
      ...equipment,
      start_at: '2026-01-02T08:00:00.000Z',
      end_at: '2026-01-02T12:00:00.000Z',
      total_reserved: 20,
      capacity: 1,
    }
    const soonerEquipment = {
      ...equipment,
      item_id: 'item-2',
      start_at: '2026-01-01T07:00:00.000Z',
      end_at: '2026-01-01T09:00:00.000Z',
      total_reserved: 9,
      capacity: 8,
    }
    const items = buildConflictCards(
      [],
      [],
      [laterEquipment, soonerEquipment],
      [],
    )
    expect(sortConflictItems(items).map((item) => item.row)).toMatchObject([
      { item_id: 'item-2' },
      { item_id: 'item-1' },
    ])
  })
})

describe('conflictWhyCopy', () => {
  it('explains crew and equipment conflicts', () => {
    const crewItem = buildConflictCards([crew], [], [], [])[0]
    const equipmentItem = buildConflictCards([], [], [equipment], [])[0]
    expect(crewItem).toBeDefined()
    expect(equipmentItem).toBeDefined()
    if (!crewItem || !equipmentItem) return
    expect(conflictWhyCopy(crewItem)).toMatch(
      /Anna is double-booked for 8 hours/,
    )
    expect(conflictWhyCopy(equipmentItem)).toMatch(/short by 4/)
  })
})

describe('conflictListFooterLabel', () => {
  it('uses singular and plural conflict copy', () => {
    expect(conflictListFooterLabel(1)).toBe('1 conflict')
    expect(conflictListFooterLabel(13)).toBe('13 conflicts')
  })
})

describe('conflictInvolvesProjectLead', () => {
  it('is true when any involved job is in the project-lead set', () => {
    const items = buildConflictCards([crew], [], [equipment], [group])
    const crewItem = items.find((item) => item.kind === 'crew')
    const equipmentItem = items.find((item) => item.kind === 'equipment')
    expect(crewItem).toBeDefined()
    expect(equipmentItem).toBeDefined()
    if (!crewItem || !equipmentItem) return
    expect(conflictInvolvesProjectLead(crewItem, ['j1'])).toBe(true)
    expect(conflictInvolvesProjectLead(crewItem, ['other'])).toBe(false)
    expect(countProjectLeadConflicts(items, ['j3'])).toBe(1)
    expect(countProjectLeadConflicts(items, ['j1'])).toBe(3)
  })
})
