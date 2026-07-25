import { describe, expect, it } from 'vitest'
import {
  findSidebarNavIndex,
  resolvePageNavDirection,
  setPendingPageNavDirection,
  takePendingPageNavDirection,
} from './pageNavDirection'

describe('resolvePageNavDirection', () => {
  const routes = ['/dashboard', '/jobs', '/customers', '/profile']

  it('returns 1 when navigating down the sidebar', () => {
    expect(resolvePageNavDirection(routes, '/dashboard', '/jobs')).toBe(1)
    expect(resolvePageNavDirection(routes, '/jobs', '/profile')).toBe(1)
  })

  it('returns -1 when navigating up the sidebar', () => {
    expect(resolvePageNavDirection(routes, '/jobs', '/dashboard')).toBe(-1)
    expect(resolvePageNavDirection(routes, '/profile', '/customers')).toBe(-1)
  })

  it('falls back when paths are unknown or unchanged', () => {
    expect(resolvePageNavDirection(routes, '/unknown', '/jobs')).toBe(1)
    expect(resolvePageNavDirection(routes, '/jobs', '/jobs/1')).toBe(1)
    expect(
      resolvePageNavDirection(routes, '/unknown', '/also-unknown', -1),
    ).toBe(-1)
  })

  it('matches nested paths via sidebar index', () => {
    expect(findSidebarNavIndex(routes, '/jobs/abc')).toBe(1)
    expect(resolvePageNavDirection(routes, '/jobs/abc', '/customers')).toBe(1)
  })
})

describe('pending page nav direction', () => {
  it('stores and consumes a keyboard direction once', () => {
    setPendingPageNavDirection(-1)
    expect(takePendingPageNavDirection()).toBe(-1)
    expect(takePendingPageNavDirection()).toBeNull()
  })
})
