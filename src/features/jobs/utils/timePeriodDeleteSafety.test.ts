import { describe, expect, it } from 'vitest'
import { timePeriodIdsSafeToDelete } from './timePeriodDeleteSafety'

describe('timePeriodIdsSafeToDelete', () => {
  it('keeps periods still referenced by offer lines', () => {
    expect(
      timePeriodIdsSafeToDelete(
        ['equip-1', 'crew-1', 'transport-1'],
        ['equip-1', null, undefined],
      ),
    ).toEqual(['crew-1', 'transport-1'])
  })

  it('allows deleting every candidate when nothing references them', () => {
    expect(timePeriodIdsSafeToDelete(['equip-1', 'crew-1'], [])).toEqual([
      'equip-1',
      'crew-1',
    ])
  })

  it('returns no ids when every candidate is still linked', () => {
    expect(
      timePeriodIdsSafeToDelete(['equip-1'], ['equip-1', 'equip-1']),
    ).toEqual([])
  })
})
