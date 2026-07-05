import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '@test/render'
import { calculateOfferTotals } from '../../../utils/offerCalculations'
import { TotalsSection } from './TotalsSection'
import type {
  OfferCrewItem,
  OfferEquipmentItem,
  OfferTransportItem,
} from '../../../types'

const equipment: Array<OfferEquipmentItem> = [
  {
    id: '1',
    offer_group_id: 'g1',
    item_id: null,
    group_id: null,
    quantity: 2,
    unit_price: 100,
    total_price: 200,
    is_internal: true,
    sort_order: 0,
  },
]

const crew: Array<OfferCrewItem> = [
  {
    id: 'c1',
    offer_basis_id: 'b1',
    role_title: 'Technician',
    crew_count: 1,
    start_date: '2026-06-01',
    end_date: '2026-06-03',
    daily_rate: 500,
    total_price: 1500,
    sort_order: 0,
  },
]

const transport: Array<OfferTransportItem> = []

describe('TotalsSection', () => {
  it('renders calculated totals with formatted NOK amounts', () => {
    const totals = calculateOfferTotals(equipment, crew, transport, 3, 10, 25)

    renderWithProviders(<TotalsSection totals={totals} />)

    expect(screen.getByRole('heading', { name: 'Totals' })).toBeInTheDocument()
    expect(screen.getByText('Equipment Subtotal')).toBeInTheDocument()
    expect(screen.getByText('Crew Subtotal')).toBeInTheDocument()
    expect(screen.getByText('Transport Subtotal')).toBeInTheDocument()
    expect(screen.getByText('Total Before Discount')).toBeInTheDocument()
    expect(screen.getByText('Total After Discount')).toBeInTheDocument()
    expect(screen.getByText('Total With VAT')).toBeInTheDocument()
    expect(screen.getByText('1 700,00 kr')).toBeInTheDocument()
  })
})
