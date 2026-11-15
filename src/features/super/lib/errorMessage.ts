export function errorMessage(
  error: unknown,
  fallback = 'Please try again.',
): string {
  if (error instanceof Error && error.message) return error.message
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string' && message) return message
  }
  return fallback
}

export function isNotFoundQueryError(error: unknown): boolean {
  const message = errorMessage(error, '')
  return (
    message.includes('Cannot coerce') ||
    message.includes('JSON object') ||
    message.includes('No rows returned') ||
    message.includes('PGRST116')
  )
}
