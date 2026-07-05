import { describe, expect, it } from 'vitest'
import { hapticTap } from './haptic'

describe('hapticTap', () => {
  it('does not throw when vibrate is unavailable', () => {
    expect(() => hapticTap()).not.toThrow()
  })
})
