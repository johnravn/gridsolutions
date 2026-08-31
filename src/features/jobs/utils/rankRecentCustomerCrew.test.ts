import { describe, expect, it } from 'vitest'
import {
  rankRecentCustomerCrew,
  splitCrewPickerPeople,
} from './rankRecentCustomerCrew'

describe('rankRecentCustomerCrew', () => {
  it('prefers people with a confirmed booking over planned-only', () => {
    const result = rankRecentCustomerCrew([
      {
        user_id: 'planned',
        display_name: 'Pat Planned',
        email: 'pat@example.com',
        status: 'planned',
        start_at: '2026-08-20T10:00:00Z',
      },
      {
        user_id: 'confirmed',
        display_name: 'Casey Confirmed',
        email: 'casey@example.com',
        status: 'confirmed',
        start_at: '2026-01-01T10:00:00Z',
      },
    ])

    expect(result.map((p) => p.user_id)).toEqual(['confirmed', 'planned'])
  })

  it('keeps the most recent start when a person has mixed statuses', () => {
    const result = rankRecentCustomerCrew([
      {
        user_id: 'alex',
        display_name: 'Alex',
        email: 'alex@example.com',
        status: 'planned',
        start_at: '2026-08-01T10:00:00Z',
      },
      {
        user_id: 'alex',
        display_name: 'Alex',
        email: 'alex@example.com',
        status: 'confirmed',
        start_at: '2025-01-01T10:00:00Z',
      },
      {
        user_id: 'blair',
        display_name: 'Blair',
        email: 'blair@example.com',
        status: 'confirmed',
        start_at: '2026-07-01T10:00:00Z',
      },
    ])

    expect(result.map((p) => p.user_id)).toEqual(['alex', 'blair'])
  })

  it('sorts by most recent start among confirmed (or among planned)', () => {
    const result = rankRecentCustomerCrew([
      {
        user_id: 'old',
        display_name: 'Old',
        email: 'old@example.com',
        status: 'confirmed',
        start_at: '2024-01-01T10:00:00Z',
      },
      {
        user_id: 'new',
        display_name: 'New',
        email: 'new@example.com',
        status: 'confirmed',
        start_at: '2026-06-01T10:00:00Z',
      },
    ])

    expect(result.map((p) => p.user_id)).toEqual(['new', 'old'])
  })

  it('skips canceled bookings and rows without a user', () => {
    const result = rankRecentCustomerCrew([
      {
        user_id: null,
        display_name: 'Placeholder',
        email: null,
        status: 'confirmed',
        start_at: '2026-08-01T10:00:00Z',
      },
      {
        user_id: 'gone',
        display_name: 'Gone',
        email: 'gone@example.com',
        status: 'canceled',
        start_at: '2026-08-01T10:00:00Z',
      },
      {
        user_id: 'keep',
        display_name: 'Keep',
        email: 'keep@example.com',
        status: 'planned',
        start_at: '2026-07-01T10:00:00Z',
      },
    ])

    expect(result).toEqual([
      {
        user_id: 'keep',
        display_name: 'Keep',
        email: 'keep@example.com',
      },
    ])
  })

  it('limits the list to the usual team size', () => {
    const bookings = Array.from({ length: 12 }, (_, i) => ({
      user_id: `u${i}`,
      display_name: `Person ${i}`,
      email: `p${i}@example.com`,
      status: 'confirmed',
      start_at: `2026-01-${String(i + 1).padStart(2, '0')}T10:00:00Z`,
    }))

    expect(rankRecentCustomerCrew(bookings)).toHaveLength(8)
  })
})

describe('splitCrewPickerPeople', () => {
  const alice = {
    user_id: 'alice',
    display_name: 'Alice',
    email: 'alice@example.com',
  }
  const bob = { user_id: 'bob', display_name: 'Bob', email: 'bob@example.com' }

  it('pins suggested people above the rest when search is empty', () => {
    expect(splitCrewPickerPeople([bob, alice], [alice], '')).toEqual({
      suggested: [alice],
      rest: [bob],
    })
  })

  it('hides the suggested section while searching', () => {
    expect(splitCrewPickerPeople([alice, bob], [alice], 'al')).toEqual({
      suggested: [],
      rest: [alice, bob],
    })
  })
})
