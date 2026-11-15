/**
 * Generates initials from a display name or email.
 * For names with multiple words, uses first letter of first word + first letter of last word.
 * For single words or emails, uses first 2 characters.
 */
export function getInitials(nameOrEmail: string | null | undefined): string {
  const base = (nameOrEmail || '').trim()
  if (!base) return '?'

  const parts = base.split(/\s+/).filter(Boolean)

  // If we have 2+ words, use first letter of first word + first letter of last word
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }

  // For single word or email, use first 2 characters
  return base.slice(0, 2).toUpperCase()
}

/** Initials from a name with email fallback. */
export function getInitialsFromNameOrEmail(
  name: string | null | undefined,
  email: string,
): string {
  return getInitials(name?.trim() ? name : email)
}
