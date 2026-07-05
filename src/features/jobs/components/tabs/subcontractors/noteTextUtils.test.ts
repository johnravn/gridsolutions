import { describe, expect, it } from 'vitest'
import {
  QUOTE_NOTE_PREVIEW_MAX,
  SUBCONTRACTOR_NOTE_PREVIEW_MAX,
  truncateNotePreview,
} from './noteTextUtils'

describe('truncateNotePreview', () => {
  it('returns the full note when within the limit', () => {
    expect(truncateNotePreview('short note', 120)).toEqual({
      preview: 'short note',
      hasMore: false,
    })
  })

  it('truncates subcontractor notes at 120 characters', () => {
    const note = 'a'.repeat(SUBCONTRACTOR_NOTE_PREVIEW_MAX + 10)
    const result = truncateNotePreview(note, SUBCONTRACTOR_NOTE_PREVIEW_MAX)
    expect(result.preview).toHaveLength(SUBCONTRACTOR_NOTE_PREVIEW_MAX)
    expect(result.hasMore).toBe(true)
  })

  it('truncates quote notes at 60 characters', () => {
    const note = 'b'.repeat(QUOTE_NOTE_PREVIEW_MAX + 5)
    const result = truncateNotePreview(note, QUOTE_NOTE_PREVIEW_MAX)
    expect(result.preview).toHaveLength(QUOTE_NOTE_PREVIEW_MAX)
    expect(result.hasMore).toBe(true)
  })

  it('detects content beyond the preview when note has multiple lines', () => {
    const note = `${'Line one '.repeat(20)}\nLine two`
    const result = truncateNotePreview(note, SUBCONTRACTOR_NOTE_PREVIEW_MAX)
    expect(result.hasMore).toBe(true)
    expect(result.preview.length).toBeLessThanOrEqual(
      SUBCONTRACTOR_NOTE_PREVIEW_MAX,
    )
  })
})
