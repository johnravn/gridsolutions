import * as React from 'react'

/**
 * Returns true only during the first fetch for a mounted page (ref-based).
 * Avoids full-page skeleton on filter/search refetches when query keys change.
 */
export function useInitialPageLoad(isLoading: boolean): boolean {
  const hasLoadedOnceRef = React.useRef(false)

  if (!isLoading) {
    hasLoadedOnceRef.current = true
  }

  return isLoading && !hasLoadedOnceRef.current
}
