import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getScheduledJobStatusTransition,
  persistJobStatusTransition,
} from './jobStatusAutoTransition'

const updateMock = vi.fn()

vi.mock('@shared/api/supabase', () => ({
  supabase: {
    from: () => ({
      update: () => ({
        eq: async () => {
          await updateMock()
          return { error: null }
        },
      }),
    }),
  },
}))

describe('getScheduledJobStatusTransition', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns null when start or end is missing', () => {
    expect(
      getScheduledJobStatusTransition({
        id: 'job-1',
        status: 'confirmed',
        start_at: null,
        end_at: '2026-06-10T12:00:00.000Z',
      }),
    ).toBeNull()
  })

  it('returns null for terminal statuses', () => {
    vi.setSystemTime(new Date('2026-06-10T12:00:00.000Z'))
    expect(
      getScheduledJobStatusTransition({
        id: 'job-1',
        status: 'completed',
        start_at: '2026-06-10T08:00:00.000Z',
        end_at: '2026-06-10T18:00:00.000Z',
      }),
    ).toBeNull()
  })

  it('moves confirmed to in_progress during the job window', () => {
    vi.setSystemTime(new Date('2026-06-10T12:00:00.000Z'))
    expect(
      getScheduledJobStatusTransition({
        id: 'job-1',
        status: 'confirmed',
        start_at: '2026-06-10T08:00:00.000Z',
        end_at: '2026-06-10T18:00:00.000Z',
      }),
    ).toEqual({ jobId: 'job-1', newStatus: 'in_progress' })
  })

  it('moves in_progress to completed after end time', () => {
    vi.setSystemTime(new Date('2026-06-10T19:00:00.000Z'))
    expect(
      getScheduledJobStatusTransition({
        id: 'job-1',
        status: 'in_progress',
        start_at: '2026-06-10T08:00:00.000Z',
        end_at: '2026-06-10T18:00:00.000Z',
      }),
    ).toEqual({ jobId: 'job-1', newStatus: 'completed' })
  })

  it('returns null when confirmed but before start', () => {
    vi.setSystemTime(new Date('2026-06-10T06:00:00.000Z'))
    expect(
      getScheduledJobStatusTransition({
        id: 'job-1',
        status: 'confirmed',
        start_at: '2026-06-10T08:00:00.000Z',
        end_at: '2026-06-10T18:00:00.000Z',
      }),
    ).toBeNull()
  })

  it('returns null for canceled jobs', () => {
    vi.setSystemTime(new Date('2026-06-10T12:00:00.000Z'))
    expect(
      getScheduledJobStatusTransition({
        id: 'job-1',
        status: 'canceled',
        start_at: '2026-06-10T08:00:00.000Z',
        end_at: '2026-06-10T18:00:00.000Z',
      }),
    ).toBeNull()
  })
})

describe('persistJobStatusTransition', () => {
  beforeEach(() => {
    updateMock.mockReset()
  })

  it('updates job status via supabase', async () => {
    updateMock.mockResolvedValue({ error: null })
    await persistJobStatusTransition('job-1', 'completed')
    expect(updateMock).toHaveBeenCalled()
  })
})
