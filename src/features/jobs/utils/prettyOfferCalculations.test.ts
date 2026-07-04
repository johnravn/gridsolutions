import { describe, expect, it } from 'vitest'
import {
  applyComputedCostsToModules,
  calculatePrettyOfferTotals,
  calculateSplitAmount,
  calculateTechnicalSplitAmount,
  suggestTechnicalSplitsForModule,
  validatePricingBases,
} from './prettyOfferCalculations'
import type {
  JobSubcontractorQuote,
  OfferDetail,
  PrettyOfferModule,
  PrettyOfferPricingBasis,
} from '../types'

describe('prettyOfferCalculations', () => {
  it('calculates technical split amount with proportional equipment discount', () => {
    const technicalOffer = {
      days_of_use: 1,
      discount_percent: 10,
      vat_percent: 25,
      groups: [
        {
          id: 'g1',
          offer_id: 't1',
          group_name: 'Audio',
          sort_order: 0,
          created_at: '',
          items: [
            {
              id: 'i1',
              offer_group_id: 'g1',
              item_id: null,
              group_id: null,
              quantity: 1,
              unit_price: 1000,
              total_price: 1000,
              is_internal: true,
              sort_order: 0,
            },
          ],
        },
      ],
      crew_items: [],
      transport_items: [],
      transport_groups: [],
    } as unknown as OfferDetail

    const amount = calculateTechnicalSplitAmount(
      {
        category_type: 'equipment_group',
        category_key: 'Audio',
        amount: 0,
      },
      technicalOffer,
    )

    expect(amount).toBe(900)
  })

  it('sums module cost from multiple splits across basises', () => {
    const modules: Array<PrettyOfferModule> = [
      {
        id: 'm1',
        offer_id: 'o1',
        title: 'Audio',
        subtitle: null,
        sort_order: 0,
        display_price: null,
        show_price: false,
        computed_cost: 0,
      },
    ]

    const pricingBases: Array<PrettyOfferPricingBasis> = [
      {
        id: 'b1',
        offer_id: 'o1',
        basis_type: 'custom',
        title: 'Custom A',
        sort_order: 0,
        source_technical_offer_id: null,
        job_subcontractor_quote_id: null,
        splits: [
          {
            id: 's1',
            basis_id: 'b1',
            module_id: 'm1',
            title: 'Line 1',
            amount: 1000,
            sort_order: 0,
            category_type: null,
            category_key: null,
          },
        ],
      },
      {
        id: 'b2',
        offer_id: 'o1',
        basis_type: 'custom',
        title: 'Custom B',
        sort_order: 1,
        source_technical_offer_id: null,
        job_subcontractor_quote_id: null,
        splits: [
          {
            id: 's2',
            basis_id: 'b2',
            module_id: 'm1',
            title: 'Line 2',
            amount: 500,
            sort_order: 0,
            category_type: null,
            category_key: null,
          },
        ],
      },
    ]

    const withCost = applyComputedCostsToModules(modules, pricingBases)
    expect(withCost[0]?.computed_cost).toBe(1500)
  })

  it('validates subcontractor basis split totals', () => {
    const quote: JobSubcontractorQuote = {
      id: 'q1',
      job_id: 'j1',
      job_subcontractor_id: 'js1',
      version_number: 1,
      total_amount: 1000,
      note: null,
      pdf_path: null,
      pdf_filename: null,
      mime_type: null,
      size_bytes: null,
      created_at: '',
    }

    const bases: Array<PrettyOfferPricingBasis> = [
      {
        id: 'b1',
        offer_id: 'o1',
        basis_type: 'subcontractor',
        title: 'Vendor',
        sort_order: 0,
        source_technical_offer_id: null,
        job_subcontractor_quote_id: 'q1',
        splits: [
          {
            id: 's1',
            basis_id: 'b1',
            module_id: 'm1',
            title: 'Rigging',
            amount: 400,
            sort_order: 0,
            category_type: null,
            category_key: null,
          },
        ],
      },
    ]

    const issues = validatePricingBases(
      bases,
      [{ id: 'm1' }],
      new Map([['q1', quote]]),
    )
    expect(issues).toHaveLength(1)
    expect(issues[0]?.message).toContain('must sum to quote total')
  })

  it('suggests technical splits from module title', () => {
    const technicalOffer = {
      groups: [{ id: 'g1', group_name: 'Audio' }],
      crew_items: [{ id: 'c1', role_category: 'audio' }],
      transport_groups: [],
    } as unknown as OfferDetail

    const suggestions = suggestTechnicalSplitsForModule(
      'Audio',
      technicalOffer,
      'm1',
    )
    expect(suggestions.some((s) => s.category_type === 'equipment_group')).toBe(
      true,
    )
    expect(suggestions.some((s) => s.category_type === 'crew_category')).toBe(
      true,
    )
  })

  it('calculates pretty offer totals with VAT', () => {
    const modules: Array<PrettyOfferModule> = [
      {
        id: 'm1',
        offer_id: 'o1',
        title: 'A',
        subtitle: null,
        sort_order: 0,
        display_price: null,
        show_price: false,
        computed_cost: 1000,
      },
      {
        id: 'm2',
        offer_id: 'o1',
        title: 'B',
        subtitle: null,
        sort_order: 1,
        display_price: null,
        show_price: false,
        computed_cost: 500,
      },
    ]

    const totals = calculatePrettyOfferTotals(modules, 25)
    expect(totals.totalBeforeDiscount).toBe(1500)
    expect(totals.totalWithVat).toBe(1875)
  })

  it('uses stored amount for custom splits', () => {
    const basis: PrettyOfferPricingBasis = {
      id: 'b1',
      offer_id: 'o1',
      basis_type: 'custom',
      title: 'Custom',
      sort_order: 0,
      source_technical_offer_id: null,
      job_subcontractor_quote_id: null,
      splits: [],
    }
    const split = {
      id: 's1',
      basis_id: 'b1',
      module_id: 'm1',
      title: 'Line',
      amount: 2500,
      sort_order: 0,
      category_type: null,
      category_key: null,
    }
    expect(calculateSplitAmount(split, basis)).toBe(2500)
  })
})
