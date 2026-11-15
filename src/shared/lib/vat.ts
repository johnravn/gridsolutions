export function fmtVAT(str: string | null | undefined): string {
  if (!str || str.trim() === '') return '—'
  // Remove any existing spaces/dashes for formatting
  const cleaned = str.replace(/[\s-]/g, '')
  // Format as "xxx xxx xxx" if we have 9 digits
  if (cleaned.length === 9) {
    return (
      cleaned.slice(0, 3) + ' ' + cleaned.slice(3, 6) + ' ' + cleaned.slice(6)
    )
  }
  // For other lengths, just return the cleaned string
  return cleaned
}

/**
 * Formats VAT number input as user types: "xxx xxx xxx"
 * Removes non-digits and formats with spaces
 */
export function formatVATInput(value: string): string {
  // Remove all non-digit characters
  const digits = value.replace(/\D/g, '')

  // Limit to 9 digits
  const limited = digits.slice(0, 9)

  // Format as "xxx xxx xxx"
  if (limited.length <= 3) {
    return limited
  } else if (limited.length <= 6) {
    return `${limited.slice(0, 3)} ${limited.slice(3)}`
  } else {
    return `${limited.slice(0, 3)} ${limited.slice(3, 6)} ${limited.slice(6)}`
  }
}
