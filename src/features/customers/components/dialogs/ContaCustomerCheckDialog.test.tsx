import { describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '@test/render'
import { AppToastProvider } from '@shared/ui/toast/ToastProvider'
import ContaCustomerCheckDialog from './ContaCustomerCheckDialog'

const mockCheck = vi.fn()

vi.mock('@app/hooks/useMediaQuery', () => ({
  useMediaQuery: vi.fn(() => false),
}))

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.stubGlobal('ResizeObserver', ResizeObserverStub)

vi.mock('@shared/api/supabase', () => ({
  supabase: {
    from: (table: string) => {
      if (table === 'company_expansions') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  accounting_organization_id: 'org-1',
                  accounting_software: 'conta',
                },
                error: null,
              }),
            }),
          }),
        }
      }
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
      }
    },
  },
}))

vi.mock('../../utils/contaCustomerCheck', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../utils/contaCustomerCheck')>()
  return {
    ...actual,
    checkContaCustomerExists: (...args: Array<unknown>) => mockCheck(...args),
  }
})

vi.mock('../../api/contaCustomerSync', () => ({
  createCustomerInConta: vi.fn(),
  fetchAndSyncContaCustomer: vi.fn(),
}))

function renderDialog() {
  return renderWithProviders(
    <AppToastProvider>
      <ContaCustomerCheckDialog
        open
        onOpenChange={vi.fn()}
        companyId="company-1"
        customer={{
          id: 'grid-1',
          name: 'Ada Lovelace',
          vat_number: null,
          address: 'Slottsplassen 1, 0010 Oslo',
          email: 'ada@example.com',
          phone: null,
        }}
      />
    </AppToastProvider>,
  )
}

describe('ContaCustomerCheckDialog', () => {
  it('lists several Conta matches and marks ones already synced', async () => {
    mockCheck.mockResolvedValue({
      exists: true,
      searchedBy: ['name', 'email'],
      matches: [
        {
          id: 1,
          name: 'Ada Lovelace',
          email: 'ada@example.com',
          customerType: 'INDIVIDUAL',
          score: 140,
          reasons: ['email', 'name'],
          linkedGridCustomer: null,
        },
        {
          id: 2,
          name: 'Ada Lovelace',
          email: 'ada.other@example.com',
          customerType: 'INDIVIDUAL',
          score: 60,
          reasons: ['name'],
          linkedGridCustomer: { id: 'grid-9', name: 'Ada Other' },
        },
      ],
    })

    renderDialog()

    expect(
      await screen.findByRole('heading', { name: 'Sync with Conta' }),
    ).toBeInTheDocument()
    expect(
      await screen.findByText('2 possible matches in Conta'),
    ).toBeInTheDocument()
    expect(screen.getByText('Linked to Ada Other')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Link selected' })).toBeEnabled()
    expect(
      screen.getByRole('button', { name: 'Create private customer in Conta' }),
    ).toBeInTheDocument()
  })

  it('offers to create a private customer when none match', async () => {
    mockCheck.mockResolvedValue({
      exists: false,
      searchedBy: ['name'],
      matches: [],
    })

    renderDialog()

    await waitFor(() => {
      expect(
        screen.getByText('Customer not found in Conta'),
      ).toBeInTheDocument()
    })
    expect(
      screen.getByRole('button', { name: 'Create private customer in Conta' }),
    ).toBeInTheDocument()
  })
})
