import { describe, expect, it } from 'vitest'
import { buildContaJobProjectName } from './contaProjects'

describe('buildContaJobProjectName', () => {
  it('formats project name with padded job number', () => {
    expect(
      buildContaJobProjectName({
        jobTitle: 'Summer Festival',
        jobnr: 42,
        jobId: 'job-uuid',
      }),
    ).toBe('Job #000042 - Summer Festival')
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
})
