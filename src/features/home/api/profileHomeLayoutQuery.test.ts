import { describe, expect, it } from 'vitest'
import {
  defaultHomeDashboardLayoutPreferences,
  parseHomeLayout,
} from './profileHomeLayoutQuery'

describe('home dashboard layout preferences', () => {
  it('defaults to all sections visible', () => {
    expect(defaultHomeDashboardLayoutPreferences()).toEqual({
      showDailyInspiration: true,
      showCompanyJobsWeek: true,
      showMatters: true,
      showConflicts: true,
    })
  })

  it('treats missing prefs as enabled', () => {
    expect(parseHomeLayout(null).showCompanyJobsWeek).toBe(true)
    expect(parseHomeLayout({}).showMatters).toBe(true)
  })

  it('honors new home_show_company_jobs_week key', () => {
    expect(
      parseHomeLayout({ home_show_company_jobs_week: false })
        .showCompanyJobsWeek,
    ).toBe(false)
  })

  it('falls back to legacy home_show_latest when new key absent', () => {
    expect(
      parseHomeLayout({ home_show_latest: false }).showCompanyJobsWeek,
    ).toBe(false)
    expect(
      parseHomeLayout({ home_show_latest: true }).showCompanyJobsWeek,
    ).toBe(true)
  })

  it('prefers new key over legacy when both present', () => {
    expect(
      parseHomeLayout({
        home_show_company_jobs_week: true,
        home_show_latest: false,
      }).showCompanyJobsWeek,
    ).toBe(true)
  })
})
