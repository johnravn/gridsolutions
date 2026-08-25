import { describe, expect, it } from 'vitest'
import { MY_PROFILE_SELECT, myProfileQueryKey } from './myProfileQuery'

describe('myProfileQuery', () => {
  it('keeps last_seen_release_version on the shared cache row', () => {
    expect(MY_PROFILE_SELECT).toContain('last_seen_release_version')
    expect(myProfileQueryKey('user-1')).toEqual(['my-profile', 'user-1'])
  })
})
