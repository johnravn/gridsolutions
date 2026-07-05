import { describe, expect, it } from 'vitest'
import {
  buildPublicPrettyModule,
  getPrettyOfferModuleCompletionStats,
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

describe('getPrettyOfferModuleCompletionStats', () => {
  it('reports remaining required fields across modules', () => {
    expect(getPrettyOfferModuleCompletionStats([])).toEqual({
      moduleCount: 0,
      totalRequired: 0,
      remaining: 0,
      completed: 0,
      isComplete: false,
    })

    expect(getPrettyOfferModuleCompletionStats([completeModule])).toEqual({
      moduleCount: 1,
      totalRequired: 4,
      remaining: 0,
      completed: 4,
      isComplete: true,
    })

    const stats = getPrettyOfferModuleCompletionStats([
      completeModule,
      {
        ...completeModule,
        id: 'mod-2',
        story_body_1: null,
        hero_media_url: null,
      },
    ])
    expect(stats).toEqual({
      moduleCount: 2,
      totalRequired: 8,
      remaining: 2,
      completed: 6,
      isComplete: false,
    })
  })
})

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

  it('validates timeline modules require imported items', () => {
    expect(
      validatePrettyOfferModules([
        {
          id: 'timeline-1',
          module_type: 'timeline',
          title: 'Program timeline',
          timeline_items: [],
        },
      ]),
    ).toEqual([
      expect.objectContaining({ field: 'timeline_items' }),
    ])
    expect(
      isPrettyModuleStoryComplete({
        id: 'timeline-1',
        module_type: 'timeline',
        title: 'Program timeline',
        timeline_items: [
          {
            id: 'item-1',
            module_id: 'timeline-1',
            label: 'Load in',
            summary: null,
            detail: null,
            start_at: '2026-07-01T09:00:00.000Z',
            end_at: '2026-07-01T11:00:00.000Z',
            sort_order: 0,
          },
        ],
      }),
    ).toBe(true)
  })
})

describe('resolveModuleCustomerPrice', () => {
  it('uses computed_cost from pricing splits when available', () => {
    expect(
      resolveModuleCustomerPrice({
        show_price: true,
        display_price: 9000,
        computed_cost: 12500,
      }),
    ).toBe(12500)
  })

  it('falls back to display_price when computed_cost is missing', () => {
    expect(
      resolveModuleCustomerPrice({
        show_price: true,
        display_price: 9000,
        computed_cost: 0,
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
