import { describe, expect, it } from 'vitest'
import { unwrapRelation } from './unwrapRelation'

describe('unwrapRelation', () => {
  it('returns null for nullish', () => {
    expect(unwrapRelation(null)).toBeNull()
    expect(unwrapRelation(undefined)).toBeNull()
  })

  it('unwraps a one-element array and empty arrays', () => {
    expect(unwrapRelation([{ id: '1' }])).toEqual({ id: '1' })
    expect(unwrapRelation([])).toBeNull()
    expect(unwrapRelation([null])).toBeNull()
  })

  it('passes through a plain object', () => {
    expect(unwrapRelation({ id: '1' })).toEqual({ id: '1' })
  })
})
