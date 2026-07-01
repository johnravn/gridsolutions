import { describe, expect, it } from 'vitest'
import {
  motionDurationReveal,
  motionFadeTransition,
  motionRevealTransition,
} from './motion'

describe('motion', () => {
  it('motionRevealTransition uses CSS duration variable', () => {
    expect(motionRevealTransition()).toBe(
      'opacity var(--motion-duration-reveal) var(--motion-ease-reveal), transform var(--motion-duration-reveal) var(--motion-ease-reveal)',
    )
  })

  it('motionRevealTransition supports custom properties and delay', () => {
    expect(
      motionRevealTransition(['max-width'], {
        ease: 'ease-out',
        delay: '60ms',
      }),
    ).toBe('max-width var(--motion-duration-reveal) ease-out 60ms')
  })

  it('motionFadeTransition uses CSS duration variable', () => {
    expect(motionFadeTransition()).toBe(
      'opacity var(--motion-duration-reveal) var(--motion-ease-reveal)',
    )
  })

  it('exports duration token for staggered delays', () => {
    expect(motionDurationReveal).toBe('var(--motion-duration-reveal)')
  })
})
