import { describe, expect, it } from 'vitest'
import { unionJobIds } from './myJobIdsQuery'

describe('unionJobIds', () => {
  it('unions lead and crew ids, drops empties, and sorts', () => {
    expect(unionJobIds(['b', 'a', null], [undefined, 'a', 'c'], [])).toEqual([
      'a',
      'b',
      'c',
    ])
  })
})
