import * as React from 'react'

/** Locks html/body scroll while a full-viewport legal surface is mounted. */
export function useLockDocumentScroll() {
  React.useEffect(() => {
    const originalBody = {
      overflow: document.body.style.overflow,
      padding: document.body.style.padding,
      margin: document.body.style.margin,
    }
    const originalHtml = {
      overflow: document.documentElement.style.overflow,
      padding: document.documentElement.style.padding,
      margin: document.documentElement.style.margin,
    }

    document.body.style.overflow = 'hidden'
    document.body.style.padding = '0'
    document.body.style.margin = '0'
    document.documentElement.style.overflow = 'hidden'
    document.documentElement.style.padding = '0'
    document.documentElement.style.margin = '0'

    return () => {
      document.body.style.overflow = originalBody.overflow
      document.body.style.padding = originalBody.padding
      document.body.style.margin = originalBody.margin
      document.documentElement.style.overflow = originalHtml.overflow
      document.documentElement.style.padding = originalHtml.padding
      document.documentElement.style.margin = originalHtml.margin
    }
  }, [])
}
