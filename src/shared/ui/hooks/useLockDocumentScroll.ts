import * as React from 'react'

type LockOptions = {
  /** Also lock `document.documentElement` (login/signup full-viewport pages). */
  includeHtml?: boolean
}

/**
 * Locks document scroll while a full-viewport auth page is mounted.
 * Restores prior overflow/padding/margin on unmount.
 */
export function useLockDocumentScroll(options: LockOptions = {}): void {
  const includeHtml = options.includeHtml ?? true

  React.useEffect(() => {
    const bodyOriginal = {
      overflow: document.body.style.overflow,
      padding: document.body.style.padding,
      margin: document.body.style.margin,
    }
    const htmlOriginal = includeHtml
      ? {
          overflow: document.documentElement.style.overflow,
          padding: document.documentElement.style.padding,
          margin: document.documentElement.style.margin,
        }
      : null

    document.body.style.overflow = 'hidden'
    document.body.style.padding = '0'
    document.body.style.margin = '0'
    if (includeHtml) {
      document.documentElement.style.overflow = 'hidden'
      document.documentElement.style.padding = '0'
      document.documentElement.style.margin = '0'
    }

    return () => {
      document.body.style.overflow = bodyOriginal.overflow
      document.body.style.padding = bodyOriginal.padding
      document.body.style.margin = bodyOriginal.margin
      if (htmlOriginal) {
        document.documentElement.style.overflow = htmlOriginal.overflow
        document.documentElement.style.padding = htmlOriginal.padding
        document.documentElement.style.margin = htmlOriginal.margin
      }
    }
  }, [includeHtml])
}
