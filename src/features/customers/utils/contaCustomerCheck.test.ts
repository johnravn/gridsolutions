import { beforeEach, describe, expect, it, vi } from 'vitest'
import { checkContaCustomerExists } from './contaCustomerCheck'

const mockGet = vi.fn()

vi.mock('@shared/api/conta/client', () => ({
  contaClient: {
    get: (...args: Array<unknown>) => mockGet(...args),
  },
}))

describe('checkContaCustomerExists', () => {
  beforeEach(() => {
    mockGet.mockReset()
  })

  it('returns error when org number is missing', async () => {
    const result = await checkContaCustomerExists('org-1', {
      name: 'Acme',
      vat_number: null,
    })
    expect(result.exists).toBe(false)
    expect(result.error).toMatch(/Organization number is required/)
    expect(mockGet).not.toHaveBeenCalled()
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

  it('returns not found when no matching org number', async () => {
    mockGet.mockResolvedValue({
      hits: [{ id: 99, name: 'Other', orgNo: '999999999' }],
    })

    const result = await checkContaCustomerExists('org-1', {
      vat_number: '123456789',
    })

    expect(result.exists).toBe(false)
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
