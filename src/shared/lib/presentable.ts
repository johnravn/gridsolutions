export function makeWordPresentable(str: string): string {
  if (!str) return str
  const cleaned = str.replace(/[_-]+/g, ' ')
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
}
