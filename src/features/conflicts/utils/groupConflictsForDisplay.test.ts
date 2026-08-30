import { describe, expect, it } from 'vitest'
import { makeOverlapConflict } from '@test/fixtures/conflicts'
import {
  conflictDisplayCounts,
  groupConflictsForDisplay,
} from './groupConflictsForDisplay'

describe('groupConflictsForDisplay', () => {
  it('keeps ungrouped items as direct rows', () => {
    const mic = makeOverlapConflict({ itemName: 'SM58' })
    expect(groupConflictsForDisplay([mic])).toEqual([
      { kind: 'direct', conflict: mic },
    ])
  })

  it('nests group members under one expandable group', () => {
    const mic = makeOverlapConflict({
      itemId: 'mic',
      itemName: 'SM58',
      quantity: 2,
      sourceGroupId: 'kit-1',
      sourceGroupName: 'Vocal package',
      sourceGroupQuantity: 2,
    })
    const cable = makeOverlapConflict({
      itemId: 'cable',
      itemName: 'XLR',
      quantity: 4,
      sourceGroupId: 'kit-1',
      sourceGroupName: 'Vocal package',
      sourceGroupQuantity: 2,
    })
    const extra = makeOverlapConflict({ itemName: 'PAR can' })

    const entries = groupConflictsForDisplay([mic, cable, extra])
    expect(entries).toEqual([
      {
        kind: 'group',
        groupId: 'kit-1',
        groupName: 'Vocal package',
        quantity: 2,
        items: [mic, cable],
      },
      { kind: 'direct', conflict: extra },
    ])
    expect(conflictDisplayCounts(entries)).toEqual({
      groupCount: 1,
      itemCount: 1,
    })
  })
})
