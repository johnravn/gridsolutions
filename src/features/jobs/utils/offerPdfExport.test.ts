import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { makeOfferDetail } from '@test/fixtures/offers'
import { exportOfferAsPDF } from './offerPdfExport'
import type { OfferDetail } from '../types'

vi.mock('jspdf', () => {
  const MockPdf = vi.fn(function (this: Record<string, unknown>) {
    this.internal = { pageSize: { getWidth: () => 210, getHeight: () => 297 } }
    this.setFont = vi.fn()
    this.setFontSize = vi.fn()
    this.setTextColor = vi.fn()
    this.setFillColor = vi.fn()
    this.text = vi.fn()
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

describe('exportOfferAsPDF', () => {
  beforeEach(() => {
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
    const base = makeOfferDetail()
    const offer = makeOfferDetail({
      crew_items: [
        {
          id: 'c1',
          offer_id: base.id,
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
          offer_id: base.id,
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
      company_expansion: {
        rental_factor_config: JSON.stringify({
          tiers: [{ maxDays: 7, factor: 1 }],
        }),
      },
    } as Partial<OfferDetail>)

    await expect(exportOfferAsPDF(offer)).resolves.toBeUndefined()
  })

  it('generates PDF when rental factor config is invalid JSON', async () => {
    const offer = makeOfferDetail({
      company_expansion: {
        rental_factor_config: '{not-json',
      },
    } as Partial<OfferDetail>)

    await expect(exportOfferAsPDF(offer)).resolves.toBeUndefined()
  })
})
