import { describe, expect, it } from 'vitest'
import { MOBILE_CARD_HEIGHT } from '@app/layout/mobileLayout'

describe('MOBILE_CARD_HEIGHT', () => {
  it('uses the shared split height CSS variable', () => {
    expect(MOBILE_CARD_HEIGHT).toBe('var(--app-split-height)')
  })
})
