import { describe, expect, it } from 'vitest'
import { aggregateRecurringJobCrew } from './aggregateRecurringJobCrew'

describe('aggregateRecurringJobCrew', () => {
  it('groups bookings by user', () => {
    const result = aggregateRecurringJobCrew([
      {
        user_id: 'u1',
        display_name: 'Alice',
        email: 'alice@example.com',
        avatar_url: null,
        job_id: 'j1',
        job_title: 'Show 1',
        jobnr: 1,
        role_title: 'FOH',
        start_at: '2026-01-01T10:00:00Z',
        end_at: '2026-01-01T18:00:00Z',
        status: 'confirmed',
      },
      {
        user_id: 'u1',
        display_name: 'Alice',
        email: 'alice@example.com',
        avatar_url: null,
        job_id: 'j2',
        job_title: 'Show 2',
        jobnr: 2,
        role_title: 'FOH',
        start_at: '2026-01-02T10:00:00Z',
        end_at: '2026-01-02T18:00:00Z',
        status: 'planned',
      },
      {
        user_id: 'u2',
        display_name: 'Bob',
        email: 'bob@example.com',
        avatar_url: null,
        job_id: 'j1',
        job_title: 'Show 1',
        jobnr: 1,
        role_title: 'Monitor',
        start_at: '2026-01-01T10:00:00Z',
        end_at: '2026-01-01T18:00:00Z',
        status: 'confirmed',
      },
    ])

    expect(result).toHaveLength(2)
    expect(result[0].user_id).toBe('u1')
    expect(result[0].bookings).toHaveLength(2)
    expect(result[1].user_id).toBe('u2')
    expect(result[1].bookings).toHaveLength(1)
  })

  it('returns empty array for no input', () => {
    expect(aggregateRecurringJobCrew([])).toEqual([])
  })

  it('sorts users alphabetically by display name', () => {
    const result = aggregateRecurringJobCrew([
      {
        user_id: 'u2',
        display_name: 'Zara',
        email: 'z@example.com',
        avatar_url: null,
        job_id: 'j1',
        job_title: 'Show',
        jobnr: 1,
        role_title: 'FOH',
        start_at: null,
        end_at: null,
        status: 'planned',
      },
      {
        user_id: 'u1',
        display_name: 'Alice',
        email: 'alice@example.com',
        avatar_url: null,
        job_id: 'j1',
        job_title: 'Show',
        jobnr: 1,
        role_title: 'Monitor',
        start_at: null,
        end_at: null,
        status: 'planned',
      },
    ])

    expect(result[0].display_name).toBe('Alice')
    expect(result[1].display_name).toBe('Zara')
  })
})
