import * as React from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@shared/api/supabase'

const RESUME_DEBOUNCE_MS = 500

export function useAppResume(companyId: string | null): void {
  const queryClient = useQueryClient()
  const lastResumeRef = React.useRef(0)

  React.useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return

      const now = Date.now()
      if (now - lastResumeRef.current < RESUME_DEBOUNCE_MS) return
      lastResumeRef.current = now

      void supabase.auth.getSession()

      void queryClient.invalidateQueries({ queryKey: ['auth', 'user'] })
      void queryClient.invalidateQueries({
        queryKey: ['matters', 'unread-count', 'all'],
      })

      if (companyId) {
        void queryClient.invalidateQueries({
          queryKey: ['company', companyId, 'jobs-index'],
          exact: false,
        })
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    return () =>
      document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [companyId, queryClient])
}
