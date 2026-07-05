import { describe, expect, it } from 'vitest'
import {
  buildPublicPrettyModule,
  isPrettyModuleStoryComplete,
  resolveModuleCustomerPrice,
  validatePrettyOfferModules,
} from './prettyOfferCalculations'

const completeModule = {
  id: 'mod-1',
  title: 'Audio',
  story_body_1: 'Crystal-clear sound for every seat.',
  hero_media_type: 'image' as const,
  hero_media_url: 'company/offer/hero.jpg',
  show_price: true,
  display_price: null,
  computed_cost: 12500,
}

describe('validatePrettyOfferModules', () => {
  it('returns no issues for a complete module', () => {
    expect(validatePrettyOfferModules([completeModule])).toEqual([])
    expect(isPrettyModuleStoryComplete(completeModule)).toBe(true)
  })

  it('flags missing story paragraph', () => {
    const issues = validatePrettyOfferModules([
      { ...completeModule, story_body_1: null },
    ])
    expect(issues.some((i) => i.field === 'story_body_1')).toBe(true)
  })

  it('flags missing hero media url', () => {
    const issues = validatePrettyOfferModules([
      { ...completeModule, hero_media_url: null },
    ])
    expect(issues.some((i) => i.field === 'hero_media_url')).toBe(true)
  })
})

describe('resolveModuleCustomerPrice', () => {
  it('uses display_price when set', () => {
    expect(
      resolveModuleCustomerPrice({
        show_price: true,
        display_price: 9000,
        computed_cost: 12500,
      }),
    ).toBe(9000)
  })

  it('falls back to computed_cost when display_price is null', () => {
    expect(resolveModuleCustomerPrice(completeModule)).toBe(12500)
  })

  it('returns null when show_price is false', () => {
    expect(
      resolveModuleCustomerPrice({ ...completeModule, show_price: false }),
    ).toBeNull()
  })
})

describe('buildPublicPrettyModule', () => {
  it('shows module price when showPricePerLine is on and module has computed cost', () => {
    const publicModule = buildPublicPrettyModule(
      {
        ...completeModule,
        sort_order: 0,
        show_price: false,
        display_price: null,
      },
      true,
    )
    expect(publicModule.show_price).toBe(true)
    expect(publicModule.display_price).toBe(12500)
    expect(resolveModuleCustomerPrice(publicModule)).toBe(12500)
  })

  it('hides module prices when showPricePerLine is off', () => {
    const publicModule = buildPublicPrettyModule(
      {
        ...completeModule,
        sort_order: 0,
      },
      false,
    )
    expect(publicModule.show_price).toBe(false)
    expect(resolveModuleCustomerPrice(publicModule)).toBeNull()
  })
})
