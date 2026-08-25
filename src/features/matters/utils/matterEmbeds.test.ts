import { describe, expect, it } from 'vitest'
import { unwrapOne, unwrapProfile } from './matterEmbeds'

const ada = {
  user_id: 'ada',
  display_name: 'Ada',
  email: 'ada@example.com',
  avatar_url: 'ada.png',
}

const grace = {
  user_id: 'grace',
  display_name: 'Grace',
  email: 'grace@example.com',
  avatar_url: 'grace.png',
}

describe('unwrapOne', () => {
  it('returns the first element of an array embed', () => {
    expect(unwrapOne({ id: '1' })).toEqual({ id: '1' })
    expect(unwrapOne([{ id: '1' }, { id: '2' }])).toEqual({ id: '1' })
    expect(unwrapOne([])).toBeNull()
    expect(unwrapOne(null)).toBeNull()
  })
})

describe('unwrapProfile', () => {
  it('unwraps a single object or array', () => {
    expect(unwrapProfile(ada)).toEqual(ada)
    expect(unwrapProfile([ada])).toEqual(ada)
  })

  it('picks the profile that matches the expected user id', () => {
    expect(unwrapProfile([grace, ada], 'ada')).toEqual(ada)
  })

  it('returns null instead of the wrong person when ids do not match', () => {
    expect(unwrapProfile(grace, 'ada')).toBeNull()
    expect(unwrapProfile([grace], 'ada')).toBeNull()
  })
})
