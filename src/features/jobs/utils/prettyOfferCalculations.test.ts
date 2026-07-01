import { describe, expect, it } from 'vitest'
import {
  allocationAmountForModule,
  calculateManualModuleCost,
  calculatePrettyOfferTotals,
  calculateTechnicalModuleCost,
  parseManualFieldNumericValue,
  validateSubcontractorAllocations,
} from './prettyOfferCalculations'
import type {
  OfferDetail,
  PrettyOfferModule,
  PrettyOfferSubcontractorQuote,
} from '../types'

describe('prettyOfferCalculations', () => {
  it('parses manual field numeric values', () => {
    expect(parseManualFieldNumericValue('1 234,50')).toBe(1234.5)
    expect(parseManualFieldNumericValue('not-a-number')).toBe(0)
  })

  it('sums manual fields', () => {
    const module: PrettyOfferModule = {
      id: 'm1',
      offer_id: 'o1',
      title: 'Audio',
      subtitle: null,
      sort_order: 0,
      basis_type: 'manual',
      display_price: null,
      show_price: false,
      computed_cost: 0,
      manual_fields: [
        {
          id: 'f1',
          module_id: 'm1',
          label: 'Rig',
          value: '10000',
          sort_order: 0,
        },
        {
          id: 'f2',
          module_id: 'm1',
          label: 'Ops',
          value: '2500',
          sort_order: 1,
        },
      ],
    }
    expect(calculateManualModuleCost(module)).toBe(12500)
  })

  it('allocates subcontractor quote by percent and amount', () => {
    const quote: PrettyOfferSubcontractorQuote = {
      id: 'q1',
      offer_id: 'o1',
      vendor_name: 'Vendor',
      note: null,
      total_amount: 10000,
      customer_id: null,
      pdf_path: null,
      pdf_filename: null,
      mime_type: null,
      size_bytes: null,
      sort_order: 0,
      allocations: [
        {
          id: 'a1',
          quote_id: 'q1',
          module_id: 'm1',
          allocation_mode: 'percent',
          allocation_value: 60,
        },
        {
          id: 'a2',
          quote_id: 'q1',
          module_id: 'm2',
          allocation_mode: 'amount',
          allocation_value: 4000,
        },
      ],
    }

    expect(allocationAmountForModule(quote, 'm1')).toBe(6000)
    expect(allocationAmountForModule(quote, 'm2')).toBe(4000)
  })

  it('validates subcontractor allocations', () => {
    const quotes: Array<PrettyOfferSubcontractorQuote> = [
      {
        id: 'q1',
        offer_id: 'o1',
        vendor_name: 'Vendor',
        note: null,
        total_amount: 1000,
        customer_id: null,
        pdf_path: null,
        pdf_filename: null,
        mime_type: null,
        size_bytes: null,
        sort_order: 0,
        allocations: [
          {
            id: 'a1',
            quote_id: 'q1',
            module_id: 'm1',
            allocation_mode: 'percent',
            allocation_value: 50,
          },
        ],
      },
    ]

    expect(validateSubcontractorAllocations(quotes)).toHaveLength(1)
  })

  it('calculates technical module cost with proportional equipment discount', () => {
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
        {
          id: 'g2',
          offer_id: 't1',
          group_name: 'Lights',
          sort_order: 1,
          created_at: '',
          items: [
            {
              id: 'i2',
              offer_group_id: 'g2',
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
      crew_items: [
        {
          id: 'c1',
          offer_id: 't1',
          role_title: 'FOH',
          role_category: 'audio',
          crew_count: 1,
          start_date: '2026-01-01T08:00:00Z',
          end_date: '2026-01-02T08:00:00Z',
          daily_rate: 500,
          total_price: 500,
          sort_order: 0,
        },
      ],
      transport_items: [],
      transport_groups: [],
    } as unknown as OfferDetail

    const cost = calculateTechnicalModuleCost({
      technicalOffer,
      mappings: [
        {
          id: 'map1',
          module_id: 'm1',
          category_type: 'equipment_group',
          category_key: 'Audio',
        },
        {
          id: 'map2',
          module_id: 'm1',
          category_type: 'crew_category',
          category_key: 'audio',
        },
      ],
    })

    // Audio equipment 1000 - 50% of 200 total equipment discount (100) + crew 500
    expect(cost).toBe(1400)
  })

  it('calculates pretty offer totals with VAT', () => {
    const modules: Array<PrettyOfferModule> = [
      {
        id: 'm1',
        offer_id: 'o1',
        title: 'A',
        subtitle: null,
        sort_order: 0,
        basis_type: 'manual',
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
        basis_type: 'manual',
        display_price: null,
        show_price: false,
        computed_cost: 500,
      },
    ]

    const totals = calculatePrettyOfferTotals(modules, 25)
    expect(totals.totalBeforeDiscount).toBe(1500)
    expect(totals.totalWithVat).toBe(1875)
  })
})
