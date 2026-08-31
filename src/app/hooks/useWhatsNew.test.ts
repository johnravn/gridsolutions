import { describe, expect, it } from 'vitest'
import { shouldShowWhatsNew } from './useWhatsNew'

describe('shouldShowWhatsNew', () => {
  it('shows when the user has never dismissed this version', () => {
    expect(
      shouldShowWhatsNew({
        userId: 'u1',
        profileLoaded: true,
        lastSeenReleaseVersion: null,
        appVersion: '1.12.2',
      }),
    ).toBe(true)
  })

  it('hides when the user already dismissed the current version', () => {
    expect(
      shouldShowWhatsNew({
        userId: 'u1',
        profileLoaded: true,
        lastSeenReleaseVersion: '1.12.2',
        appVersion: '1.12.2',
      }),
    ).toBe(false)
  })

  it('shows again after a minor version bump', () => {
    expect(
      shouldShowWhatsNew({
        userId: 'u1',
        profileLoaded: true,
        lastSeenReleaseVersion: '1.12.9',
        appVersion: '1.13.0',
      }),
    ).toBe(true)
  })

  it('shows again after a major version bump', () => {
    expect(
      shouldShowWhatsNew({
        userId: 'u1',
        profileLoaded: true,
        lastSeenReleaseVersion: '1.13.11',
        appVersion: '2.0.0',
      }),
    ).toBe(true)
  })

  it('does not show again after a patch bump', () => {
    expect(
      shouldShowWhatsNew({
        userId: 'u1',
        profileLoaded: true,
        lastSeenReleaseVersion: '1.13.10',
        appVersion: '1.13.11',
      }),
    ).toBe(false)
  })

  it('does not treat a missing cache field as unseen', () => {
    expect(
      shouldShowWhatsNew({
        userId: 'u1',
        profileLoaded: true,
        lastSeenReleaseVersion: undefined,
        appVersion: '1.12.2',
      }),
    ).toBe(false)
  })
})
