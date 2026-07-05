import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildContaJobProjectName,
  ensureContaProjectId,
  findContaProjectId,
} from './contaProjects'

const getMock = vi.fn()
const postForResponseMock = vi.fn()

vi.mock('@shared/api/conta/client', () => ({
  contaClient: {
    get: (...args: unknown[]) => getMock(...args),
  },
  contaPostForResponse: (...args: unknown[]) => postForResponseMock(...args),
  formatContaApiError: (
    status: number,
    statusText: string,
    _parsed: unknown,
    rawText: string,
  ) => `${status} ${statusText}: ${rawText}`,
}))

const baseInput = {
  jobTitle: 'Summer Festival',
  jobnr: 42,
  jobId: 'job-uuid-1234',
  customerId: 99,
}

describe('buildContaJobProjectName', () => {
  it('formats project name with padded job number', () => {
    expect(buildContaJobProjectName(baseInput)).toBe(
      'Job #000042 - Summer Festival',
    )
  })

  it('falls back to job id when jobnr is missing', () => {
    expect(
      buildContaJobProjectName({
        jobTitle: 'Untitled',
        jobnr: null,
        jobId: 'abc-123',
      }),
    ).toBe('Job #abc-123 - Untitled')
  })

  it('uses unknown label when both jobnr and jobId are missing', () => {
    expect(
      buildContaJobProjectName({
        jobTitle: 'Untitled',
        jobnr: null,
        jobId: '',
      }),
    ).toBe('Job #unknown - Untitled')
  })
})

describe('findContaProjectId', () => {
  beforeEach(() => {
    getMock.mockReset()
  })

  it('returns matching project id from search hits', async () => {
    getMock.mockResolvedValue({
      hits: [{ id: 501, name: 'Job #000042 - Summer Festival' }],
    })

    const id = await findContaProjectId('org-1', baseInput)
    expect(id).toBe(501)
    expect(getMock).toHaveBeenCalled()
  })

  it('returns null when no hits match', async () => {
    getMock.mockResolvedValue({ hits: [] })
    expect(await findContaProjectId('org-1', baseInput)).toBeNull()
  })

  it('ignores failed search terms and continues', async () => {
    getMock
      .mockRejectedValueOnce(new Error('search failed'))
      .mockResolvedValueOnce({
        hits: [{ id: 777, description: 'subb job job-uuid-1234' }],
      })

    const id = await findContaProjectId('org-1', baseInput)
    expect(id).toBe(777)
  })
})

describe('ensureContaProjectId', () => {
  beforeEach(() => {
    getMock.mockReset()
    postForResponseMock.mockReset()
  })

  it('returns existing id without creating a project', async () => {
    getMock.mockResolvedValue({
      hits: [{ id: 900, name: buildContaJobProjectName(baseInput) }],
    })

    const id = await ensureContaProjectId('org-1', baseInput)
    expect(id).toBe(900)
    expect(postForResponseMock).not.toHaveBeenCalled()
  })

  it('creates project when search finds nothing', async () => {
    getMock.mockResolvedValue({ hits: [] })
    postForResponseMock.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async () => JSON.stringify({ id: 1001 }),
    })

    const id = await ensureContaProjectId('org-1', baseInput)
    expect(id).toBe(1001)
    expect(postForResponseMock).toHaveBeenCalledWith(
      '/invoice/organizations/org-1/projects',
      expect.objectContaining({
        name: buildContaJobProjectName(baseInput),
        customerId: 99,
      }),
    )
  })

  it('recovers project id from 409 conflict response body', async () => {
    getMock.mockResolvedValue({ hits: [] })
    postForResponseMock.mockResolvedValue({
      ok: false,
      status: 409,
      statusText: 'Conflict',
      text: async () =>
        JSON.stringify({
          properties: { projectId: 2002 },
        }),
    })

    const id = await ensureContaProjectId('org-1', baseInput)
    expect(id).toBe(2002)
  })
})
