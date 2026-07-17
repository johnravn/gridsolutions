import { describe, expect, it } from 'vitest'
import {
  applyComputedCostsToModules,
  basisMarkupAmount,
  basisSubtotal,
  basisSubtotalBeforeMarkup,
  buildLineItemCategoryOptions,
  buildModuleTitlesFromLineItemSource,
  calculatePrettyOfferTotals,
  calculateModuleCostFromSplits,
  calculateModuleMarkupFromSplits,
  calculateSplitAmount,
  calculateTechnicalSplitAmount,
  filterNewModuleTitles,
  getBasisAllocationStatus,
  rebuildTechnicalSplitsForCopy,
  resolveSubcontractorMarkupPercent,
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

  it('rejects splits assigned to timeline modules', () => {
    const issues = validatePricingBases(
      [
        {
          id: 'b1',
          offer_id: 'o1',
          basis_type: 'custom',
          title: 'Custom',
          sort_order: 0,
          source_technical_offer_id: null,
          source_offer_basis_id: null,
          job_subcontractor_quote_id: null,
          splits: [
            {
              id: 's1',
              basis_id: 'b1',
              module_id: 'timeline-1',
              title: 'Share',
              amount: 1000,
              sort_order: 0,
              category_type: null,
              category_key: null,
            },
          ],
        },
      ],
      [
        {
          id: 'timeline-1',
          module_type: 'timeline',
          title: 'Program timeline',
        },
      ],
      new Map(),
    )

    expect(issues).toHaveLength(1)
    expect(issues[0]?.message).toContain(
      'cannot be assigned to timeline module',
    )
  })

  it('reports subcontractor allocation status', () => {
    const quote = {
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
    } satisfies JobSubcontractorQuote

    const basis: PrettyOfferPricingBasis = {
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
    }

    const status = getBasisAllocationStatus(basis, {
      jobQuotesById: new Map([['q1', quote]]),
    })

    expect(status).toEqual({
      sourceTotal: 1000,
      assignedTotal: 400,
      remaining: 600,
      isFullyAllocated: false,
      sourceTotalLabel: 'Quote total',
      amountsExcludeVat: false,
      vatPercent: 0,
      sourceTotalWithVat: 1000,
      assignedTotalWithVat: 400,
      discountPercent: 0,
    })
  })

  it('fully allocates technical basis when auto-split covers all categories', () => {
    const source = {
      groups: [
        {
          group_name: 'Audio',
          sort_order: 0,
          items: [
            {
              unit_price: 1000,
              quantity: 1,
              total_price: 1000,
            },
          ],
        },
        {
          group_name: 'Lights',
          sort_order: 1,
          items: [
            {
              unit_price: 500,
              quantity: 1,
              total_price: 500,
            },
          ],
        },
      ],
      crew_items: [
        {
          role_title: 'FOH',
          role_category: 'Audio',
          total_price: 800,
        },
      ],
      transport_groups: [
        {
          group_name: 'Transport',
          sort_order: 0,
          items: [{ total_price: 200 }],
        },
      ],
      transport_items: [{ total_price: 200 }],
      days_of_use: 1,
      discount_percent: 10,
      vat_percent: 25,
    }

    const options = buildLineItemCategoryOptions(source as any)
    const basis = {
      id: 'b1',
      offer_id: 'o1',
      basis_type: 'technical' as const,
      title: 'Main basis',
      sort_order: 0,
      source_technical_offer_id: null,
      job_subcontractor_quote_id: null,
      splits: options.map((opt, index) => ({
        id: `s${index}`,
        basis_id: 'b1',
        module_id: 'm1',
        title: opt.label,
        amount: 0,
        sort_order: index,
        category_type: opt.category_type,
        category_key: opt.category_key,
      })),
    }

    const status = getBasisAllocationStatus(basis, {
      offerBasesById: new Map([
        [
          'basis1',
          {
            ...source,
            id: 'basis1',
            job_id: 'j1',
            company_id: 'c1',
            title: 'Main basis',
            bookings_synced_at: null,
            created_at: '',
            updated_at: '',
          },
        ],
      ]),
    })

    expect(status).toBeNull()

    const linkedBasis = {
      ...basis,
      source_offer_basis_id: 'basis1',
    }
    const linkedStatus = getBasisAllocationStatus(linkedBasis, {
      offerBasesById: new Map([
        [
          'basis1',
          {
            ...source,
            id: 'basis1',
            job_id: 'j1',
            company_id: 'c1',
            title: 'Main basis',
            bookings_synced_at: null,
            created_at: '',
            updated_at: '',
          },
        ],
      ]),
    })

    expect(linkedStatus?.sourceTotal).toBe(2350)
    expect(linkedStatus?.assignedTotal).toBe(2350)
    expect(linkedStatus?.isFullyAllocated).toBe(true)
    expect(linkedStatus?.amountsExcludeVat).toBe(true)
    expect(linkedStatus?.vatPercent).toBe(25)
    expect(linkedStatus?.sourceTotalWithVat).toBe(2937.5)
    expect(linkedStatus?.discountPercent).toBe(10)
  })

  it('builds module titles from line item categories', () => {
    const titles = buildModuleTitlesFromLineItemSource({
      groups: [
        { group_name: 'Lights', sort_order: 1 },
        { group_name: 'Audio', sort_order: 0 },
      ],
      crew_items: [
        { role_title: 'FOH Engineer', sort_order: 1 },
        { role_title: 'Stage Manager', sort_order: 0 },
      ],
      transport_groups: [{ group_name: 'Transport', sort_order: 0 }],
      transport_items: [],
      days_of_use: 1,
      discount_percent: 0,
      vat_percent: 25,
    } as any)

    expect(titles).toEqual([
      'Audio',
      'Lights',
      'Stage Manager',
      'FOH Engineer',
      'Transport',
    ])
  })

  it('skips module titles that already exist', () => {
    const titles = filterNewModuleTitles(
      ['Audio', 'Lights'],
      [{ title: 'audio' }],
    )
    expect(titles).toEqual(['Lights'])
  })

  it('suggests technical splits from module title', () => {
    const technicalOffer = {
      groups: [{ id: 'g1', group_name: 'Audio' }],
      crew_items: [
        { id: 'c1', role_title: 'Audio Engineer', role_category: 'audio' },
      ],
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
      false,
    )

    const crewSuggestions = suggestTechnicalSplitsForModule(
      'Audio Engineer',
      technicalOffer,
      'm1',
    )
    expect(
      crewSuggestions.some((s) => s.category_type === 'crew_category'),
    ).toBe(true)
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

  it('applies subcontractor markup on top when enabled', () => {
    const basis: PrettyOfferPricingBasis = {
      id: 'b1',
      offer_id: 'o1',
      basis_type: 'subcontractor',
      title: 'Sub',
      sort_order: 0,
      source_technical_offer_id: null,
      source_offer_basis_id: null,
      job_subcontractor_quote_id: 'q1',
      apply_subcontractor_markup: true,
      splits: [],
    }
    const split = {
      id: 's1',
      basis_id: 'b1',
      module_id: 'm1',
      title: 'Share',
      amount: 10000,
      sort_order: 0,
      category_type: null,
      category_key: null,
    }

    expect(
      calculateSplitAmount(split, basis, { subcontractorMarkupPercent: 15 }),
    ).toBe(11500)
    expect(
      calculateSplitAmount(
        split,
        { ...basis, apply_subcontractor_markup: false },
        { subcontractorMarkupPercent: 15 },
      ),
    ).toBe(10000)
  })

  it('defaults subcontractor markup to on when unset', () => {
    const basis: PrettyOfferPricingBasis = {
      id: 'b1',
      offer_id: 'o1',
      basis_type: 'custom',
      title: 'Custom',
      sort_order: 0,
      source_technical_offer_id: null,
      source_offer_basis_id: null,
      job_subcontractor_quote_id: null,
      splits: [],
    }
    const split = {
      id: 's1',
      basis_id: 'b1',
      module_id: 'm1',
      title: 'Line',
      amount: 2000,
      sort_order: 0,
      category_type: null,
      category_key: null,
    }

    expect(
      calculateSplitAmount(split, basis, { subcontractorMarkupPercent: 10 }),
    ).toBe(2200)
  })

  it('resolves offer override before company default markup', () => {
    expect(resolveSubcontractorMarkupPercent(20, 15)).toBe(20)
    expect(resolveSubcontractorMarkupPercent(null, 15)).toBe(15)
    expect(resolveSubcontractorMarkupPercent(null, null)).toBe(0)
  })

  it('calculates basis markup amount from pre-markup subtotal', () => {
    const basis: PrettyOfferPricingBasis = {
      id: 'b1',
      offer_id: 'o1',
      basis_type: 'custom',
      title: 'Custom',
      sort_order: 0,
      source_technical_offer_id: null,
      source_offer_basis_id: null,
      job_subcontractor_quote_id: null,
      apply_subcontractor_markup: true,
      splits: [
        {
          id: 's1',
          basis_id: 'b1',
          module_id: 'm1',
          title: 'Line',
          amount: 8000,
          sort_order: 0,
          category_type: null,
          category_key: null,
        },
        {
          id: 's2',
          basis_id: 'b1',
          module_id: 'm2',
          title: 'Line 2',
          amount: 2000,
          sort_order: 1,
          category_type: null,
          category_key: null,
        },
      ],
    }

    expect(basisSubtotalBeforeMarkup(basis)).toBe(10000)
    expect(basisMarkupAmount(basis, { subcontractorMarkupPercent: 15 })).toBe(
      1500,
    )
    expect(basisSubtotal(basis, { subcontractorMarkupPercent: 15 })).toBe(11500)
    expect(
      basisMarkupAmount(
        { ...basis, apply_subcontractor_markup: false },
        { subcontractorMarkupPercent: 15 },
      ),
    ).toBe(0)
  })

  it('calculates module markup only for splits assigned to that module', () => {
    const pricingBases: Array<PrettyOfferPricingBasis> = [
      {
        id: 'b1',
        offer_id: 'o1',
        basis_type: 'custom',
        title: 'Custom',
        sort_order: 0,
        source_technical_offer_id: null,
        source_offer_basis_id: null,
        job_subcontractor_quote_id: null,
        apply_subcontractor_markup: true,
        splits: [
          {
            id: 's1',
            basis_id: 'b1',
            module_id: 'm1',
            title: 'Line',
            amount: 8000,
            sort_order: 0,
            category_type: null,
            category_key: null,
          },
          {
            id: 's2',
            basis_id: 'b1',
            module_id: 'm2',
            title: 'Line 2',
            amount: 2000,
            sort_order: 1,
            category_type: null,
            category_key: null,
          },
        ],
      },
    ]
    const options = { subcontractorMarkupPercent: 15 }

    expect(calculateModuleMarkupFromSplits('m1', pricingBases, options)).toBe(
      1200,
    )
    expect(calculateModuleCostFromSplits('m1', pricingBases, options)).toBe(
      9200,
    )
  })

  it('rebuilds technical splits from categories with module title matching', () => {
    const splits = rebuildTechnicalSplitsForCopy({
      lineItemSource: {
        groups: [
          {
            group_name: 'Audio',
            sort_order: 0,
            items: [],
          },
          {
            group_name: 'Lights',
            sort_order: 1,
            items: [],
          },
        ],
        crew_items: [],
        transport_items: [],
        transport_groups: [],
        days_of_use: 1,
        discount_percent: 0,
        vat_percent: 25,
      },
      modules: [
        { id: 'm-audio', title: 'Audio' },
        { id: 'm-other', title: 'Other' },
      ],
    })

    expect(splits).toHaveLength(2)
    expect(splits[0]?.category_key).toBe('Audio')
    expect(splits[0]?.module_id).toBe('m-audio')
    expect(splits[1]?.category_key).toBe('Lights')
    expect(splits[1]?.module_id).toBe('m-audio')
  })
})
