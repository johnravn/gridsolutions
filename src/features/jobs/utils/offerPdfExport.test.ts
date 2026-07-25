import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { makeOfferDetail } from '@test/fixtures/offers'
import { exportOfferAsPDF } from './offerPdfExport'
import type { OfferDetail } from '../types'

const textCalls: string[] = []

vi.mock('jspdf', () => {
  const MockPdf = vi.fn(function (this: Record<string, unknown>) {
    this.internal = { pageSize: { getWidth: () => 210, getHeight: () => 297 } }
    this.setFont = vi.fn()
    this.setFontSize = vi.fn()
    this.setTextColor = vi.fn()
    this.setFillColor = vi.fn()
    this.text = vi.fn((value: string | string[]) => {
      if (typeof value === 'string') textCalls.push(value)
      else textCalls.push(...value)
    })
    this.line = vi.fn()
    this.addPage = vi.fn()
    this.save = vi.fn()
    this.splitTextToSize = vi.fn((text: string) => [text])
    this.getTextWidth = vi.fn(() => 10)
    this.setDrawColor = vi.fn()
    this.setLineWidth = vi.fn()
    this.rect = vi.fn()
  })
  return { default: MockPdf }
})

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('nb-NO', {
    style: 'currency',
    currency: 'NOK',
    minimumFractionDigits: 2,
  }).format(amount)

describe('exportOfferAsPDF', () => {
  beforeEach(() => {
    textCalls.length = 0
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:test'),
      revokeObjectURL: vi.fn(),
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('generates PDF without throwing for a valid offer', async () => {
    await expect(exportOfferAsPDF(makeOfferDetail())).resolves.toBeUndefined()
  })

  it('generates PDF with crew and transport sections', async () => {
    const offer = makeOfferDetail({
      crew_items: [
        {
          id: 'c1',
          offer_basis_id: 'b1',
          role_title: 'FOH Engineer',
          role_category: 'audio',
          crew_count: 1,
          start_date: '2026-01-01T08:00:00.000Z',
          end_date: '2026-01-02T08:00:00.000Z',
          daily_rate: 500,
          total_price: 500,
          sort_order: 0,
        },
      ],
      transport_items: [
        {
          id: 't1',
          offer_basis_id: 'b1',
          vehicle_category: 'van_medium',
          quantity: 1,
          start_date: '2026-01-01T08:00:00.000Z',
          end_date: '2026-01-02T08:00:00.000Z',
          daily_rate: 300,
          total_price: 300,
          sort_order: 0,
        },
      ],
      company: {
        name: 'Grid Test Company',
        accent_color: '#0066cc',
      },
    } as Partial<OfferDetail>)

    await expect(exportOfferAsPDF(offer)).resolves.toBeUndefined()
  })

  it('uses stored offer totals for technical offers (equipment-only discount)', async () => {
    // Fixture: equipment 1000, crew 500, transport 200, 10% equipment discount →
    // after discount 1600, with VAT 2000. Recalculating discount on the full
    // subtotal would wrongly yield 1912.50.
    const offer = makeOfferDetail({
      status: 'sent',
      days_of_use: 3,
      discount_percent: 10,
      vat_percent: 25,
      equipment_subtotal: 1000,
      crew_subtotal: 500,
      transport_subtotal: 200,
      total_before_discount: 1700,
      total_after_discount: 1600,
      total_with_vat: 2000,
      groups: [
        {
          id: 'g1',
          offer_basis_id: 'b1',
          group_name: 'Audio',
          sort_order: 0,
          created_at: '2026-01-01T00:00:00.000Z',
          items: [
            {
              id: 'i1',
              offer_group_id: 'g1',
              item_id: null,
              group_id: null,
              quantity: 2,
              unit_price: 250,
              // Stored line total already includes rental factor for days_of_use
              total_price: 1000,
              is_internal: true,
              sort_order: 0,
              item: { id: 'item1', name: 'Speaker', brand: null, model: null },
            },
          ],
        },
      ],
    } as Partial<OfferDetail>)

    await exportOfferAsPDF(offer)

    expect(textCalls).toContain(formatCurrency(1000)) // line + group + equipment subtotal
    expect(textCalls).toContain(formatCurrency(1700))
    expect(textCalls).toContain(`-${formatCurrency(100)}`)
    expect(textCalls).toContain(formatCurrency(1600))
    expect(textCalls).toContain(formatCurrency(2000))
    expect(textCalls).not.toContain(formatCurrency(1912.5))
  })
})
