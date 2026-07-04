import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  crewConflictsQuery,
  equipmentConflictsQuery,
  jobBookingConflictsQuery,
  vehicleConflictsQuery,
} from './queries'

const rpcMock = vi.fn()

vi.mock('@shared/api/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpcMock(...args),
  },
}))

describe('conflicts query factories', () => {
  beforeEach(() => {
    rpcMock.mockReset()
  })

  it('crewConflictsQuery calls get_conflicts_crew RPC', async () => {
    rpcMock.mockResolvedValue({ data: [], error: null })
    const opts = crewConflictsQuery({
      companyId: 'co-1',
      from: '2026-01-01',
      to: '2026-02-01',
    })

    expect(opts.queryKey).toEqual([
      'conflicts',
      'crew',
      'co-1',
      '2026-01-01',
      '2026-02-01',
    ])
    expect(opts.enabled).toBe(true)

    const rows = await opts.queryFn!({} as never)
    expect(rows).toEqual([])
    expect(rpcMock).toHaveBeenCalledWith('get_conflicts_crew', {
      p_company_id: 'co-1',
      p_from: '2026-01-01',
      p_to: '2026-02-01',
    })
  })

  it('vehicleConflictsQuery is disabled without companyId', () => {
    const opts = vehicleConflictsQuery({ companyId: '' })
    expect(opts.enabled).toBe(false)
  })

  it('equipmentConflictsQuery merges equipment rows from RPC', async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          item_id: 'item-1',
          item_name: 'Mic',
          capacity: 2,
          total_reserved: 3,
          start_at: '2026-07-01T08:00:00Z',
          end_at: '2026-07-01T18:00:00Z',
          job_ids: ['j1', 'j2'],
          job_titles: ['Job A', 'Job B'],
          has_forced: false,
        },
      ],
      error: null,
    })

    const opts = equipmentConflictsQuery({ companyId: 'co-1' })
    const rows = await opts.queryFn!({} as never)

    expect(rows).toHaveLength(1)
    expect(rows[0]?.total_reserved).toBe(3)
    expect(rpcMock).toHaveBeenCalledWith('get_conflicts_equipment', {
      p_company_id: 'co-1',
      p_from: undefined,
      p_to: undefined,
    })
  })

  it('jobBookingConflictsQuery merges equipment and defaults missing arrays', async () => {
    rpcMock.mockResolvedValue({
      data: { crew: [], vehicles: [] },
      error: null,
    })

    const opts = jobBookingConflictsQuery({ jobId: 'job-1' })
    const result = await opts.queryFn!({} as never)

    expect(result).toEqual({ crew: [], vehicles: [], equipment: [] })
    expect(rpcMock).toHaveBeenCalledWith('get_job_booking_conflicts', {
      p_job_id: 'job-1',
      p_from: undefined,
      p_to: undefined,
    })
  })

  it('propagates RPC errors', async () => {
    const err = new Error('rpc failed')
    rpcMock.mockResolvedValue({ data: null, error: err })
    const opts = crewConflictsQuery({ companyId: 'co-1' })
    await expect(opts.queryFn!({} as never)).rejects.toThrow('rpc failed')
  })
})
