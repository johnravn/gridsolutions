import * as React from 'react'
import { getFuzzyMatchRanges } from '@shared/lib/generalFunctions'

/** Bolds fuzzy-matched characters in `text` for the given query. */
export function HighlightedText({
  text,
  query,
}: {
  text: string
  query: string
}) {
  const ranges = getFuzzyMatchRanges(query, text)
  if (ranges.length === 0 || !query.trim()) return <>{text}</>

  const parts: Array<React.ReactNode> = []
  let cursor = 0
  ranges.forEach((range, i) => {
    if (range.start > cursor) {
      parts.push(text.slice(cursor, range.start))
    }
    parts.push(<strong key={i}>{text.slice(range.start, range.end)}</strong>)
    cursor = range.end
  })
  if (cursor < text.length) {
    parts.push(text.slice(cursor))
  }
  return <>{parts}</>
}
