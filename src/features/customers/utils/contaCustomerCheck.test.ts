import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  checkContaCustomerExists,
  contaCustomerTypeLabel,
  contaMatchReasonLabel,
} from './contaCustomerCheck'

const mockGet = vi.fn()
const mockFrom = vi.fn()

vi.mock('@shared/api/conta/client', () => ({
  contaClient: {
    get: (...args: Array<unknown>) => mockGet(...args),
  },
}))

vi.mock('@shared/api/supabase', () => ({
  supabase: {
    from: (...args: Array<unknown>) => mockFrom(...args),
  },
}))

function linkedQuery(
  rows: Array<{ id: string; name: string; conta_customer_id: number }>,
) {
  return {
    select: () => ({
      eq: () => ({
        in: () => ({
          or: async () => ({ data: rows, error: null }),
        }),
      }),
    }),
  }
}

describe('checkContaCustomerExists', () => {
  beforeEach(() => {
    mockGet.mockReset()
    mockFrom.mockReset()
    mockFrom.mockReturnValue(linkedQuery([]))
  })

  it('returns error when there is nothing to search by', async () => {
    const result = await checkContaCustomerExists('org-1', {
      name: '',
      vat_number: null,
    })
    expect(result.exists).toBe(false)
    expect(result.error).toMatch(/name, email, or organization number/)
    expect(mockGet).not.toHaveBeenCalled()
  })

  it('searches by name when org number is missing', async () => {
    mockGet.mockResolvedValue({
      hits: [
        {
          id: 7,
          customerName: 'Ada Lovelace',
          emailAddress: 'ada@example.com',
          customerType: 'INDIVIDUAL',
        },
      ],
    })

    const result = await checkContaCustomerExists('org-1', {
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      vat_number: null,
    })

    expect(result.exists).toBe(true)
    expect(result.matches).toHaveLength(1)
    expect(result.matches[0]?.id).toBe(7)
    expect(result.searchedBy).toEqual(expect.arrayContaining(['name', 'email']))
    expect(mockGet).toHaveBeenCalled()
  })

  it('returns match when org number found in Conta', async () => {
    mockGet.mockResolvedValue({
      hits: [{ id: 42, name: 'Acme AS', orgNo: '123456789' }],
    })

    const result = await checkContaCustomerExists('org-1', {
      vat_number: '123 456 789',
    })

    expect(result.exists).toBe(true)
    expect(result.contaCustomerId).toBe(42)
    expect(result.contaCustomerName).toBe('Acme AS')
  })

  it('returns multiple ranked matches and marks already-linked Grid customers', async () => {
    mockGet.mockImplementation(async (path: string) => {
      if (String(path).includes('Ada')) {
        return {
          hits: [
            {
              id: 1,
              customerName: 'Ada Lovelace',
              emailAddress: 'ada@example.com',
              customerType: 'INDIVIDUAL',
            },
            {
              id: 2,
              customerName: 'Ada Lovelace',
              emailAddress: 'ada.other@example.com',
              customerType: 'INDIVIDUAL',
            },
          ],
        }
      }
      return { hits: [] }
    })
    mockFrom.mockReturnValue(
      linkedQuery([{ id: 'grid-9', name: 'Ada Other', conta_customer_id: 2 }]),
    )

    const result = await checkContaCustomerExists(
      'org-1',
      { name: 'Ada Lovelace', vat_number: null },
      { companyId: 'company-1' },
    )

    expect(result.matches).toHaveLength(2)
    expect(result.matches[1]?.linkedGridCustomer).toEqual({
      id: 'grid-9',
      name: 'Ada Other',
    })
    expect(result.matches[0]?.linkedGridCustomer).toBeNull()
  })

  it('returns not found when no matching org number', async () => {
    mockGet.mockResolvedValue({
      hits: [{ id: 99, name: 'Other', orgNo: '999999999' }],
    })

    const result = await checkContaCustomerExists('org-1', {
      vat_number: '123456789',
    })

    expect(result.exists).toBe(false)
    expect(result.matches).toEqual([])
  })

  it('returns error when Conta API fails', async () => {
    mockGet.mockRejectedValue(new Error('Network error'))

    const result = await checkContaCustomerExists('org-1', {
      vat_number: '123456789',
    })

    expect(result.exists).toBe(false)
    expect(result.error).toBe('Network error')
  })
})

describe('Conta match labels', () => {
  it('labels match reasons and customer types', () => {
    expect(contaMatchReasonLabel('orgNo')).toBe('organisation number')
    expect(contaMatchReasonLabel('email')).toBe('email')
    expect(contaMatchReasonLabel('name')).toBe('name')
    expect(contaCustomerTypeLabel('INDIVIDUAL')).toBe('Private')
    expect(contaCustomerTypeLabel('ORGANIZATION')).toBe('Organisation')
  })
})
