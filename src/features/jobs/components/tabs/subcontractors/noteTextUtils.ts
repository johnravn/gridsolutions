export const SUBCONTRACTOR_NOTE_PREVIEW_MAX = 120
export const QUOTE_NOTE_PREVIEW_MAX = 60

export function truncateNotePreview(
  note: string,
  maxLength: number,
): { preview: string; hasMore: boolean } {
  const trimmed = note.trim()
  if (!trimmed) return { preview: '', hasMore: false }
  if (trimmed.length <= maxLength) {
    return { preview: trimmed, hasMore: false }
  }
  return {
    preview: trimmed.slice(0, maxLength).trimEnd(),
    hasMore: true,
  }
}
