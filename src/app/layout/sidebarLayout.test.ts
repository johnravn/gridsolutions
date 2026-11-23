import { describe, expect, it } from 'vitest'
import {
  SIDEBAR_COLLAPSED,
  SIDEBAR_EXPANDED,
  getDesktopSidebarWidth,
} from './sidebarLayout'

describe('getDesktopSidebarWidth', () => {
  it('uses the expanded rail when open', () => {
    expect(getDesktopSidebarWidth(true)).toBe(SIDEBAR_EXPANDED)
    expect(SIDEBAR_EXPANDED).toBe(200)
  })

  it('uses the collapsed icon rail when closed', () => {
    expect(getDesktopSidebarWidth(false)).toBe(SIDEBAR_COLLAPSED)
    expect(SIDEBAR_COLLAPSED).toBe(64)
  })
})
