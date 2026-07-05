import { describe, expect, it } from 'vitest'
import { MOBILE_CARD_HEIGHT } from '@app/layout/mobileLayout'

describe('MOBILE_CARD_HEIGHT', () => {
  it('uses app chrome CSS variable', () => {
    expect(MOBILE_CARD_HEIGHT).toBe('calc(100dvh - var(--app-chrome-height))')
  })
})
