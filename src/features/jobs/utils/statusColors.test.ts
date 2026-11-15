import { describe, expect, it } from 'vitest'
import {
  getJobStatusColor,
  getStatusTimelineColors,
  JOB_STATUS_COLORS,
  maskJobStatusForRole,
} from './statusColors'
import type { JobStatus } from '../types'

const ALL_STATUSES: Array<JobStatus> = [
  'draft',
  'planned',
  'requested',
  'confirmed',
  'in_progress',
  'completed',
  'canceled',
  'invoiced',
  'paid',
]

describe('getJobStatusColor', () => {
  it('maps every job status to a badge color', () => {
    for (const status of ALL_STATUSES) {
      expect(getJobStatusColor(status)).toBe(JOB_STATUS_COLORS[status])
    }
  })
})

describe('JOB_STATUS_COLORS', () => {
  it('covers all statuses with semantic colors', () => {
    expect(JOB_STATUS_COLORS.draft).toBe('gray')
    expect(JOB_STATUS_COLORS.paid).toBe('green')
    expect(JOB_STATUS_COLORS.canceled).toBe('red')
  })
})

describe('getStatusTimelineColors', () => {
  it('returns CSS variables for each status', () => {
    for (const status of ALL_STATUSES) {
      const colors = getStatusTimelineColors(status)
      expect(colors.bg).toMatch(/^var\(--/)
      expect(colors.border).toMatch(/^var\(--/)
      expect(colors.text).toMatch(/^var\(--/)
      expect(colors.dotBg).toMatch(/^var\(--/)
    }
  })
})

describe('maskJobStatusForRole', () => {
  it('masks invoiced and paid as completed for freelancers', () => {
    expect(maskJobStatusForRole('invoiced', 'freelancer')).toBe('completed')
    expect(maskJobStatusForRole('paid', 'freelancer')).toBe('completed')
    expect(maskJobStatusForRole('confirmed', 'freelancer')).toBe('confirmed')
  })

  it('leaves billing statuses visible for other roles', () => {
    expect(maskJobStatusForRole('invoiced', 'employee')).toBe('invoiced')
    expect(maskJobStatusForRole('paid', 'owner')).toBe('paid')
    expect(maskJobStatusForRole('paid', null)).toBe('paid')
  })
})
