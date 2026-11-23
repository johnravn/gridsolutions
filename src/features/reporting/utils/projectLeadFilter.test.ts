import { describe, expect, it } from 'vitest'
import { projectLeadUserIdFromFilter } from './projectLeadFilter'

describe('projectLeadUserIdFromFilter', () => {
  it('treats All sentinel as no filter', () => {
    expect(projectLeadUserIdFromFilter('all')).toBeNull()
    expect(projectLeadUserIdFromFilter('')).toBeNull()
  })

  it('passes through a selected user id', () => {
    expect(projectLeadUserIdFromFilter('user-123')).toBe('user-123')
  })
})
