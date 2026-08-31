import { describe, expect, it } from 'vitest'
import {
  addCrewActionLabels,
  selectedUserIdsToInvite,
} from './addCrewActionLabels'

describe('addCrewActionLabels', () => {
  it('uses singular labels when none or one person is selected', () => {
    expect(addCrewActionLabels(0)).toEqual({
      add: 'Add crew member',
      addAndInvite: 'Add and invite crew member',
    })
    expect(addCrewActionLabels(1)).toEqual({
      add: 'Add crew member',
      addAndInvite: 'Add and invite crew member',
    })
  })

  it('includes the count when several people are selected', () => {
    expect(addCrewActionLabels(3)).toEqual({
      add: 'Add 3 crew members',
      addAndInvite: 'Add and invite 3 crew members',
    })
  })
})

describe('selectedUserIdsToInvite', () => {
  it('drops the current user so they are not sent a crew invite', () => {
    expect(selectedUserIdsToInvite(['me', 'a', 'b'], 'me')).toEqual(['a', 'b'])
  })

  it('returns everyone when the current user is unknown', () => {
    expect(selectedUserIdsToInvite(['a', 'b'], null)).toEqual(['a', 'b'])
  })
})
