/** Format TanStack Form field errors (string or Standard Schema issue objects). */
export function formatFieldErrors(errors: ReadonlyArray<unknown>): string {
  return errors
    .map((err) => {
      if (typeof err === 'string') return err
      if (err && typeof err === 'object' && 'message' in err) {
        const message = (err as { message: unknown }).message
        if (typeof message === 'string') return message
      }
      return null
    })
    .filter((msg): msg is string => !!msg)
    .join(', ')
}
