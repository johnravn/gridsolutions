import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  applyContaInvoicePaidSync,
  extractContaNumericInvoiceId,
  fetchContaInvoice,
  resolveContaInvoiceIdString,
  syncInvoicePaidStatusForOrganization,
  type JobInvoiceSyncRow,
} from './invoicePaidSyncCore'
import type { ContaFetch } from './customerSyncCore'

function makeInvoice(
  overrides: Partial<JobInvoiceSyncRow> = {},
): JobInvoiceSyncRow {
  return {
    id: 'inv-1',
    job_id: 'job-1',
    organization_id: 'org-1',
    conta_invoice_id: '1001',
    status: 'created',
    conta_response: { id: 55, invoiceNo: 1001 },
    ...overrides,
  }
}

type TableMock = {
  update: ReturnType<typeof vi.fn>
  select: ReturnType<typeof vi.fn>
  eq: ReturnType<typeof vi.fn>
  in: ReturnType<typeof vi.fn>
  not: ReturnType<typeof vi.fn>
  neq: ReturnType<typeof vi.fn>
}

function createSupabaseMock(opts: {
  junctionJobIds?: Array<string>
  updatedJobIds?: Array<string>
  invoices?: Array<JobInvoiceSyncRow>
  updateError?: { message: string } | null
}) {
  const junctionJobIds = opts.junctionJobIds ?? ['job-1', 'job-2']
  const updatedJobIds = opts.updatedJobIds ?? ['job-1', 'job-2']
  const invoices = opts.invoices ?? []

  const jobInvoicesUpdate = vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue({ error: opts.updateError ?? null }),
  })

  const jobsChain: TableMock = {
    update: vi.fn(),
    select: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
    not: vi.fn(),
    neq: vi.fn(),
  }
  jobsChain.update.mockReturnValue(jobsChain)
  jobsChain.in.mockReturnValue(jobsChain)
  jobsChain.eq.mockReturnValue({
    select: vi.fn().mockResolvedValue({
      data: updatedJobIds.map((id) => ({ id })),
      error: null,
    }),
  })

  const junctionSelect = vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue({
      data: junctionJobIds.map((job_id) => ({ job_id })),
      error: null,
    }),
  })

  const invoiceListChain: Record<string, ReturnType<typeof vi.fn>> = {}
  const listResult = Promise.resolve({ data: invoices, error: null })
  invoiceListChain.select = vi.fn().mockReturnValue(invoiceListChain)
  invoiceListChain.eq = vi.fn().mockReturnValue(invoiceListChain)
  invoiceListChain.not = vi.fn().mockReturnValue(invoiceListChain)
  invoiceListChain.neq = vi.fn().mockImplementation(() => {
    // Allow chaining .neq().neq() then await
    const thenable = {
      ...invoiceListChain,
      then: (
        resolve: (v: unknown) => unknown,
        reject?: (e: unknown) => unknown,
      ) => listResult.then(resolve, reject),
    }
    return thenable
  })

  const from = vi.fn((table: string) => {
    if (table === 'job_invoices') {
      return {
        update: jobInvoicesUpdate,
        select: invoiceListChain.select,
      }
    }
    if (table === 'job_invoice_jobs') {
      return { select: junctionSelect }
    }
    if (table === 'jobs') {
      return jobsChain
    }
    throw new Error(`Unexpected table ${table}`)
  })

  return {
    supabase: { from } as any,
    jobInvoicesUpdate,
    jobsChain,
    from,
  }
}

describe('extractContaNumericInvoiceId', () => {
  it('prefers conta_response.id', () => {
    expect(
      extractContaNumericInvoiceId(
        makeInvoice({ conta_response: { id: 42, invoiceId: 99 } }),
      ),
    ).toBe('42')
  })

  it('falls back to invoiceId', () => {
    expect(
      extractContaNumericInvoiceId(
        makeInvoice({ conta_response: { invoiceId: 99 } }),
      ),
    ).toBe('99')
  })

  it('returns null when missing', () => {
    expect(
      extractContaNumericInvoiceId(makeInvoice({ conta_response: null })),
    ).toBeNull()
  })
})

describe('resolveContaInvoiceIdString', () => {
  it('keeps existing conta_invoice_id', () => {
    expect(
      resolveContaInvoiceIdString(makeInvoice(), {
        id: 55,
        invoiceNo: 2000,
      }),
    ).toBe('1001')
  })

  it('uses Conta invoiceNo when local id missing', () => {
    expect(
      resolveContaInvoiceIdString(makeInvoice({ conta_invoice_id: null }), {
        id: 55,
        invoiceNo: 2000,
      }),
    ).toBe('2000')
  })
})

describe('fetchContaInvoice', () => {
  it('GETs by numeric id when available', async () => {
    const get = vi.fn().mockResolvedValue({
      id: 55,
      status: 'CLOSED_BY_PAYMENT',
    })
    const conta: ContaFetch = { get, post: vi.fn() }
    const result = await fetchContaInvoice(conta, 'org-1', makeInvoice())
    expect(get).toHaveBeenCalledWith('/invoice/organizations/org-1/invoices/55')
    expect(result?.status).toBe('CLOSED_BY_PAYMENT')
  })

  it('searches by invoice number when numeric id missing', async () => {
    const get = vi
      .fn()
      .mockResolvedValueOnce({ hits: [{ id: 77 }] })
      .mockResolvedValueOnce({ id: 77, status: 'INVOICE_CREATED' })
    const conta: ContaFetch = { get, post: vi.fn() }
    const result = await fetchContaInvoice(
      conta,
      'org-1',
      makeInvoice({ conta_response: null }),
    )
    expect(get).toHaveBeenNthCalledWith(
      1,
      '/invoice/organizations/org-1/invoices?invoiceNo=1001',
    )
    expect(get).toHaveBeenNthCalledWith(
      2,
      '/invoice/organizations/org-1/invoices/77',
    )
    expect(result?.id).toBe(77)
  })
})

describe('applyContaInvoicePaidSync', () => {
  it('updates conta_response and marks invoice + linked jobs paid', async () => {
    const { supabase, jobInvoicesUpdate, jobsChain } = createSupabaseMock({})
    const invoice = makeInvoice()
    const contaInvoice = {
      id: 55,
      invoiceNo: 1001,
      status: 'CLOSED_BY_PAYMENT',
      extendedStatus: 'PAID',
    }

    const result = await applyContaInvoicePaidSync(
      supabase,
      invoice,
      contaInvoice,
    )

    expect(jobInvoicesUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'paid',
        conta_response: contaInvoice,
        conta_invoice_id: '1001',
      }),
    )
    expect(jobsChain.update).toHaveBeenCalledWith({ status: 'paid' })
    expect(result).toEqual({
      invoiceMarkedPaid: true,
      jobsMarkedPaid: 2,
    })
  })

  it('does not mark jobs paid for credit notes', async () => {
    const { supabase, jobInvoicesUpdate, jobsChain } = createSupabaseMock({})
    const result = await applyContaInvoicePaidSync(supabase, makeInvoice(), {
      id: 55,
      status: 'CLOSED_BY_CREDIT_NOTE',
      extendedStatus: 'CREDIT_NOTE',
    })

    expect(jobInvoicesUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        conta_response: expect.objectContaining({
          status: 'CLOSED_BY_CREDIT_NOTE',
        }),
      }),
    )
    const updateArg = jobInvoicesUpdate.mock.calls[0][0]
    expect(updateArg.status).toBeUndefined()
    expect(jobsChain.update).not.toHaveBeenCalled()
    expect(result).toEqual({
      invoiceMarkedPaid: false,
      jobsMarkedPaid: 0,
    })
  })
})

describe('syncInvoicePaidStatusForOrganization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetches Conta invoices and marks paid ones', async () => {
    const invoices = [
      makeInvoice({
        id: 'inv-paid',
        conta_response: { id: 1 },
      }),
      makeInvoice({
        id: 'inv-open',
        job_id: 'job-3',
        conta_invoice_id: '1002',
        conta_response: { id: 2 },
      }),
    ]
    const { supabase } = createSupabaseMock({
      invoices,
      junctionJobIds: ['job-1'],
      updatedJobIds: ['job-1'],
    })

    const get = vi.fn().mockImplementation(async (path: string) => {
      if (path.endsWith('/invoices/1')) {
        return { id: 1, status: 'CLOSED_BY_PAYMENT', extendedStatus: 'PAID' }
      }
      if (path.endsWith('/invoices/2')) {
        return {
          id: 2,
          status: 'INVOICE_CREATED',
          extendedStatus: 'NOT_OVERDUE',
        }
      }
      throw new Error(`unexpected path ${path}`)
    })
    const conta: ContaFetch = { get, post: vi.fn() }

    const onProgress = vi.fn()
    const result = await syncInvoicePaidStatusForOrganization(
      'org-1',
      conta,
      supabase,
      { onProgress },
    )

    expect(result.checked).toBe(2)
    expect(result.invoicesMarkedPaid).toBe(1)
    expect(result.jobsMarkedPaid).toBe(1)
    expect(result.errors).toEqual([])
    expect(result.paidInvoices).toHaveLength(1)
    expect(result.paidInvoices[0]?.contaInvoiceId).toBeTruthy()
    expect(onProgress).toHaveBeenCalledWith({ current: 0, total: 2 })
    expect(onProgress).toHaveBeenCalledWith({ current: 2, total: 2 })
  })

  it('uses stored paid response without Conta GET', async () => {
    const invoices = [
      makeInvoice({
        conta_response: {
          id: 9,
          status: 'CLOSED_BY_PAYMENT',
          extendedStatus: 'PAID',
        },
      }),
    ]
    const { supabase } = createSupabaseMock({
      invoices,
      junctionJobIds: ['job-1'],
      updatedJobIds: ['job-1'],
    })
    const get = vi.fn()
    const conta: ContaFetch = { get, post: vi.fn() }

    const result = await syncInvoicePaidStatusForOrganization(
      'org-1',
      conta,
      supabase,
    )

    expect(get).not.toHaveBeenCalled()
    expect(result.invoicesMarkedPaid).toBe(1)
    expect(result.jobsMarkedPaid).toBe(1)
    expect(result.paidInvoices).toEqual([
      expect.objectContaining({
        jobInvoiceId: 'inv-1',
        newlyMarkedPaid: true,
        jobsMarkedPaid: 1,
      }),
    ])
  })
})
