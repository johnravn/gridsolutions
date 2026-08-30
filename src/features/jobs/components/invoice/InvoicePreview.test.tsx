import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '@test/render'
import type { BookingInvoiceLine } from '../../api/invoiceQueries'
import InvoicePreview, {
  reorderInvoiceLinesByActiveOver,
} from './InvoicePreview'

const line: BookingInvoiceLine = {
  id: 'line-1',
  type: 'equipment',
  description: 'Speaker',
  quantity: 16,
  unitPrice: 100,
  totalPrice: 1600,
  vatPercent: 25,
  timePeriodId: 'tp-1',
  timePeriodTitle: 'Period 1',
  startAt: '2026-08-01T00:00:00.000Z',
  endAt: '2026-08-02T00:00:00.000Z',
}

const line2: BookingInvoiceLine = {
  ...line,
  id: 'line-2',
  description: 'Mixer',
  quantity: 1,
  unitPrice: 500,
  totalPrice: 500,
}

const bookingsPreviewProps = {
  basis: 'bookings' as const,
  bookings: {
    equipment: [line],
    crew: [],
    transport: [],
    all: [line],
    totalExVat: 1600,
    totalVat: 400,
    totalWithVat: 2000,
  },
  customerName: 'Acme',
  customerAddress: null,
  companyName: 'Grid',
  companyAddress: null,
  job: {
    title: 'Show',
    jobnr: 1,
    start_at: '2026-08-01T00:00:00.000Z',
    end_at: '2026-08-02T00:00:00.000Z',
    project_lead: null,
    customer_contact: null,
  },
  employees: [],
  contacts: [],
  vatIncluded: true,
  onVatIncludedChange: vi.fn(),
  message: '',
  onMessageChange: vi.fn(),
  ourRef: '',
  onOurRefChange: vi.fn(),
  theirRef: '',
  onTheirRefChange: vi.fn(),
}

describe('InvoicePreview quantity field', () => {
  it('steps quantity by whole numbers from a whole-number min', () => {
    renderWithProviders(
      <InvoicePreview
        {...bookingsPreviewProps}
        editedLines={[line]}
        onLineChange={vi.fn()}
      />,
    )

    const qty = screen.getByRole('spinbutton', { name: 'Quantity' })
    expect(qty).toHaveAttribute('min', '0')
    expect(qty).toHaveAttribute('step', '1')
    expect(qty).toHaveValue(16)

    // Native step base is min; min=0.01 + default step=1 used to land on 16.01.
    ;(qty as HTMLInputElement).stepUp()
    expect(qty).toHaveValue(17)
  })

  it('lets the quantity field go empty while editing', () => {
    const onLineChange = vi.fn()
    renderWithProviders(
      <InvoicePreview
        {...bookingsPreviewProps}
        editedLines={[line]}
        onLineChange={onLineChange}
      />,
    )

    const qty = screen.getByRole('spinbutton', { name: 'Quantity' })
    fireEvent.change(qty, { target: { value: '' } })

    expect(qty).toHaveValue(null)
    expect(onLineChange).toHaveBeenCalledWith('line-1', {
      unitPrice: 100,
      quantity: 0,
    })
  })

  it('commits the new quantity after the field was cleared', () => {
    const onLineChange = vi.fn()
    renderWithProviders(
      <InvoicePreview
        {...bookingsPreviewProps}
        editedLines={[{ ...line, quantity: 0 }]}
        onLineChange={onLineChange}
      />,
    )

    const qty = screen.getByRole('spinbutton', { name: 'Quantity' })
    expect(qty).toHaveValue(null)

    fireEvent.change(qty, { target: { value: '17' } })

    expect(onLineChange).toHaveBeenCalledWith('line-1', {
      unitPrice: 100,
      quantity: 17,
    })
  })
})

describe('InvoicePreview line reorder', () => {
  it('shows drag handles when onReorderLines is provided', () => {
    renderWithProviders(
      <InvoicePreview
        {...bookingsPreviewProps}
        bookings={{
          ...bookingsPreviewProps.bookings,
          equipment: [line, line2],
          all: [line, line2],
        }}
        editedLines={[line, line2]}
        onLineChange={vi.fn()}
        onReorderLines={vi.fn()}
      />,
    )

    expect(
      screen.getAllByRole('button', { name: 'Drag to reorder' }),
    ).toHaveLength(2)
  })

  it('hides drag handles when reordering is not enabled', () => {
    renderWithProviders(
      <InvoicePreview
        {...bookingsPreviewProps}
        editedLines={[line, line2]}
        onLineChange={vi.fn()}
      />,
    )

    expect(
      screen.queryByRole('button', { name: 'Drag to reorder' }),
    ).not.toBeInTheDocument()
  })
})

describe('reorderInvoiceLinesByActiveOver', () => {
  it('moves a line to the drop target index', () => {
    const moved = reorderInvoiceLinesByActiveOver(
      [line, line2],
      'line-1',
      'line-2',
    )
    expect(moved.map((l) => l.id)).toEqual(['line-2', 'line-1'])
  })

  it('returns the same array when the drop target is the same line', () => {
    const items = [line, line2]
    expect(reorderInvoiceLinesByActiveOver(items, 'line-1', 'line-1')).toBe(
      items,
    )
  })
})
