import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { bumpAppVersionSource } from './bump-app-version.mjs'

const releaseNotesPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../src/app/config/releaseNotes.ts',
)

describe('bumpAppVersionSource', () => {
  it('bumps patch by default', () => {
    const source = "export const APP_VERSION = '1.14.22'\n"
    expect(bumpAppVersionSource(source).next).toBe('1.14.23')
    expect(bumpAppVersionSource(source, 'patch').source).toContain(
      "export const APP_VERSION = '1.14.23'",
    )
  })

  it('bumps minor and resets patch', () => {
    const source = "export const APP_VERSION = '1.14.22'\n"
    expect(bumpAppVersionSource(source, 'minor').next).toBe('1.15.0')
  })

  it('bumps major and resets minor/patch', () => {
    const source = "export const APP_VERSION = '1.14.22'\n"
    expect(bumpAppVersionSource(source, 'major').next).toBe('2.0.0')
  })

  it('matches the real releaseNotes.ts APP_VERSION line', () => {
    const source = readFileSync(releaseNotesPath, 'utf8')
    const { next, source: bumped } = bumpAppVersionSource(source, 'patch')
    expect(next).toMatch(/^\d+\.\d+\.\d+$/)
    expect(bumped).toContain(`export const APP_VERSION = '${next}'`)
    expect(bumped).not.toBe(source)
  })
})
