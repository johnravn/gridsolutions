import { describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '@test/render'
import CustomerTable from './CustomerTable'
import type { CustomerRow } from '../api/queries'

vi.mock('@app/hooks/useMediaQuery', () => ({
  useMediaQuery: vi.fn(() => false),
}))

vi.mock('@shared/companies/CompanyProvider', () => ({
  useCompany: () => ({ companyId: 'company-1' }),
}))

vi.mock('@features/demo/hooks/useCompanyWriteAccess', () => ({
  useCompanyWriteAccess: () => ({ canWrite: false }),
}))

vi.mock('./dialogs/AddCustomerDialog', () => ({
  default: () => null,
}))

const rows: Array<CustomerRow> = [
  {
    id: 'cust-linked',
    company_id: 'company-1',
    name: 'Linked Customer',
    email: null,
    phone: null,
    address: null,
    vat_number: null,
    is_partner: false,
    logo_path: null,
    crew_pricing_level_id: null,
    discount_percent: null,
    created_at: '2026-01-01T00:00:00.000Z',
    conta_customer_id: 42,
  },
  {
    id: 'cust-unlinked',
    company_id: 'company-1',
    name: 'Unlinked Customer',
    email: null,
    phone: null,
    address: null,
    vat_number: null,
    is_partner: true,
    logo_path: null,
    crew_pricing_level_id: null,
    discount_percent: null,
    created_at: '2026-01-01T00:00:00.000Z',
    conta_customer_id: null,
  },
]

vi.mock('../api/queries', () => ({
  customersIndexQuery: () => ({
    queryKey: ['customers-index'],
    queryFn: async () => rows,
  }),
}))

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({
    count,
    estimateSize,
  }: {
    count: number
    estimateSize: () => number
  }) => {
    const size = estimateSize()
    return {
      getVirtualItems: () =>
        Array.from({ length: count }, (_, index) => ({
          index,
          start: index * size,
          size,
          key: String(index),
        })),
      getTotalSize: () => count * size,
      scrollToIndex: vi.fn(),
    }
  },
}))

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.stubGlobal('ResizeObserver', ResizeObserverStub)

function renderTable(contaEnabled: boolean) {
  return renderWithProviders(
    <CustomerTable
      selectedId={null}
      onSelect={vi.fn()}
      showRegular
      showPartner
      contaEnabled={contaEnabled}
    />,
  )
}

describe('CustomerTable Conta column', () => {
  it('hides the Conta column when the integration is off', async () => {
    renderTable(false)
    await waitFor(() => {
      expect(screen.getByText('Linked Customer')).toBeInTheDocument()
    })
    expect(screen.queryByText('Conta')).toBeNull()
    expect(screen.queryByText('Linked')).toBeNull()
    expect(screen.queryByText('Not linked')).toBeNull()
    expect(screen.queryByText('Crew rate')).toBeNull()
  })

  it('shows the inspector Linked / Not linked badges when Conta is enabled', async () => {
    renderTable(true)
    await waitFor(() => {
      expect(screen.getByText('Linked Customer')).toBeInTheDocument()
    })
    expect(screen.getByText('Conta')).toBeInTheDocument()
    expect(screen.getByText('Linked')).toBeInTheDocument()
    expect(screen.getByText('Not linked')).toBeInTheDocument()
    expect(screen.queryByText('Crew rate')).toBeNull()
  })
})
