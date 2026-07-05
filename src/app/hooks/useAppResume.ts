import * as React from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@shared/api/supabase'

const RESUME_DEBOUNCE_MS = 500
/** Only refresh session / invalidate caches after the tab was hidden this long. */
const RESUME_MIN_HIDDEN_MS = 3 * 60_000

export function useAppResume(_companyId: string | null): void {
  const queryClient = useQueryClient()
  const lastResumeRef = React.useRef(0)
  const hiddenAtRef = React.useRef<number | null>(null)

  React.useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAtRef.current = Date.now()
        return
      }

      if (document.visibilityState !== 'visible') return

      const now = Date.now()
      if (now - lastResumeRef.current < RESUME_DEBOUNCE_MS) return
      lastResumeRef.current = now

      const hiddenAt = hiddenAtRef.current
      hiddenAtRef.current = null
      const hiddenMs = hiddenAt != null ? now - hiddenAt : 0
      if (hiddenMs < RESUME_MIN_HIDDEN_MS) return

      void supabase.auth.getSession()
      void queryClient.invalidateQueries({ queryKey: ['auth', 'user'] })
      void queryClient.invalidateQueries({
        queryKey: ['matters', 'unread-count', 'all'],
      })
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    return () =>
      document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [queryClient])
}
