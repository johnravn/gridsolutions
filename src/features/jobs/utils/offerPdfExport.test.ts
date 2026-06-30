import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { makeOfferDetail } from '@test/fixtures/offers'
import { exportOfferAsPDF } from './offerPdfExport'

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
})
