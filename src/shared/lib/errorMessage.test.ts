import { describe, expect, it } from 'vitest'
import { errorMessage } from './errorMessage'

describe('errorMessage', () => {
  it('reads Error.message', () => {
    expect(errorMessage(new Error('boom'))).toBe('boom')
  })

  it('reads string and object.message', () => {
    expect(errorMessage('plain')).toBe('plain')
    expect(errorMessage({ message: 'obj' })).toBe('obj')
  })

  it('falls back', () => {
    expect(errorMessage(null, 'fallback')).toBe('fallback')
  })
})
