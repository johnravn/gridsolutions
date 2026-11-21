import { beforeEach, describe, expect, it, vi } from 'vitest'
import { linkContaInvoiceByNumber } from './linkContaInvoice'

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

function chain(result: { data: unknown; error: unknown }) {
  const api: Record<string, unknown> = {}
  const self = () => api
  api.select = vi.fn(self)
  api.insert = vi.fn(self)
  api.update = vi.fn(self)
  api.eq = vi.fn(self)
  api.in = vi.fn(self)
  api.maybeSingle = vi.fn(async () => result)
  api.single = vi.fn(async () => result)
  // terminal thenable for bare await of filtered queries
  api.then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve(result).then(resolve)
  return api
}

describe('linkContaInvoiceByNumber', () => {
  beforeEach(() => {
    mockGet.mockReset()
    mockFrom.mockReset()
  })

  it('rejects empty / non-numeric invoice numbers', async () => {
    await expect(
      linkContaInvoiceByNumber({
        jobId: 'job-1',
        organizationId: 'org-1',
        invoiceNumber: '  ',
        jobMeta: { id: 'job-1', title: 'A', jobnr: 1 },
      }),
    ).rejects.toThrow(/Enter a Conta invoice number/)

    await expect(
      linkContaInvoiceByNumber({
        jobId: 'job-1',
        organizationId: 'org-1',
        invoiceNumber: 'AB-12',
        jobMeta: { id: 'job-1', title: 'A', jobnr: 1 },
      }),
    ).rejects.toThrow(/digits only/)
  })

  it('throws when Conta has no matching invoice', async () => {
    mockGet.mockResolvedValueOnce({ hits: [] })
    await expect(
      linkContaInvoiceByNumber({
        jobId: 'job-1',
        organizationId: 'org-1',
        invoiceNumber: '10042',
        jobMeta: { id: 'job-1', title: 'A', jobnr: 1 },
      }),
    ).rejects.toThrow(/No Conta invoice found/)
  })

  it('creates a linked job_invoices row when Conta invoice is new', async () => {
    mockGet
      .mockResolvedValueOnce({ hits: [{ id: 55 }] })
      .mockResolvedValueOnce({
        id: 55,
        invoiceNo: 10042,
        status: 'INVOICE_CREATED',
        customerId: 9,
        invoiceLines: [{ description: 'Line', quantity: 1, price: 100 }],
      })

    const findExisting = chain({ data: [], error: null })
    const insertInvoice = chain({ data: { id: 'inv-new' }, error: null })
    const insertJunction = chain({ data: null, error: null })
    const jobsSelect = chain({
      data: [{ id: 'job-1', status: 'completed' }],
      error: null,
    })
    const jobsUpdate = chain({ data: null, error: null })

    mockFrom.mockImplementation((table: string) => {
      if (table === 'job_invoices') {
        // first call: findExisting (select), second: insert
        if (
          mockFrom.mock.calls.filter((c) => c[0] === 'job_invoices').length <= 1
        ) {
          return findExisting
        }
        return insertInvoice
      }
      if (table === 'job_invoice_jobs') return insertJunction
      if (table === 'jobs') {
        // markJobsInvoiced: select then update
        if (mockFrom.mock.calls.filter((c) => c[0] === 'jobs').length <= 1) {
          return jobsSelect
        }
        return jobsUpdate
      }
      return chain({ data: null, error: null })
    })

    const result = await linkContaInvoiceByNumber({
      jobId: 'job-1',
      organizationId: 'org-1',
      invoiceNumber: '#10042',
      jobMeta: { id: 'job-1', title: 'Festival', jobnr: 42 },
      createdByUserId: 'user-1',
    })

    expect(result).toEqual({
      kind: 'linked',
      invoiceId: 'inv-new',
      contaInvoiceId: '10042',
      alreadyOnOtherJobs: [],
    })
    expect(insertInvoice.insert).toHaveBeenCalled()
    const insertArg = (insertInvoice.insert as ReturnType<typeof vi.fn>).mock
      .calls[0]?.[0]
    expect(insertArg).toMatchObject({
      job_id: 'job-1',
      invoice_basis: 'linked',
      conta_invoice_id: '10042',
      status: 'created',
    })
  })

  it('reports already_linked when this job owns the Conta invoice', async () => {
    mockGet
      .mockResolvedValueOnce({ hits: [{ id: 55 }] })
      .mockResolvedValueOnce({
        id: 55,
        invoiceNo: 10042,
        status: 'INVOICE_CREATED',
      })

    const findExisting = chain({
      data: [{ id: 'inv-1', job_id: 'job-1' }],
      error: null,
    })
    mockFrom.mockImplementation((table: string) => {
      if (table === 'job_invoices') return findExisting
      return chain({ data: null, error: null })
    })

    const result = await linkContaInvoiceByNumber({
      jobId: 'job-1',
      organizationId: 'org-1',
      invoiceNumber: '10042',
      jobMeta: { id: 'job-1', title: 'Festival', jobnr: 42 },
    })

    expect(result).toEqual({
      kind: 'already_linked',
      invoiceId: 'inv-1',
      contaInvoiceId: '10042',
    })
  })

  it('adds this job via junction when Conta invoice is on another job', async () => {
    mockGet
      .mockResolvedValueOnce({ hits: [{ id: 55 }] })
      .mockResolvedValueOnce({
        id: 55,
        invoiceNo: 10042,
        status: 'INVOICE_CREATED',
      })

    let jobInvoicesCalls = 0
    const findExisting = chain({
      data: [{ id: 'inv-1', job_id: 'job-other' }],
      error: null,
    })
    const junctionLookup = chain({ data: null, error: null })
    const junctionInsert = chain({ data: null, error: null })
    const invoiceDataSelect = chain({
      data: {
        invoice_data: { linkedJobIds: ['job-other'], linkedJobMeta: [] },
      },
      error: null,
    })
    const invoiceUpdate = chain({ data: null, error: null })
    const primaryJobMeta = chain({
      data: { id: 'job-other', title: 'Other', jobnr: 7 },
      error: null,
    })
    const jobsSelect = chain({
      data: [{ id: 'job-1', status: 'completed' }],
      error: null,
    })
    const jobsUpdate = chain({ data: null, error: null })

    mockFrom.mockImplementation((table: string) => {
      if (table === 'job_invoices') {
        jobInvoicesCalls += 1
        if (jobInvoicesCalls === 1) return findExisting
        if (jobInvoicesCalls === 2) return invoiceDataSelect
        return invoiceUpdate
      }
      if (table === 'job_invoice_jobs') {
        // first: maybeSingle lookup, second: insert
        const calls = mockFrom.mock.calls.filter(
          (c) => c[0] === 'job_invoice_jobs',
        ).length
        return calls <= 1 ? junctionLookup : junctionInsert
      }
      if (table === 'jobs') {
        // markJobsInvoiced select → optional update → loadJobMeta
        const calls = mockFrom.mock.calls.filter((c) => c[0] === 'jobs').length
        if (calls === 1) return jobsSelect
        if (calls === 2) return jobsUpdate
        return primaryJobMeta
      }
      return chain({ data: null, error: null })
    })

    const result = await linkContaInvoiceByNumber({
      jobId: 'job-1',
      organizationId: 'org-1',
      invoiceNumber: '10042',
      jobMeta: { id: 'job-1', title: 'Festival', jobnr: 42 },
    })

    expect(result.kind).toBe('added_to_existing')
    if (result.kind === 'added_to_existing') {
      expect(result.primaryJob).toEqual({
        id: 'job-other',
        title: 'Other',
        jobnr: 7,
      })
      expect(result.contaInvoiceId).toBe('10042')
    }
  })
})
