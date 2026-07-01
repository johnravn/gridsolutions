import * as React from 'react'

function detectStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in window.navigator &&
      (window.navigator as Navigator & { standalone?: boolean }).standalone ===
        true)
  )
}

export function useIsStandalone(): boolean {
  const [isStandalone, setIsStandalone] = React.useState(detectStandalone)

  React.useEffect(() => {
    const media = window.matchMedia('(display-mode: standalone)')
    const sync = () => setIsStandalone(detectStandalone())
    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [])

  return isStandalone
}

export function useStandaloneClassEffect(): void {
  const isStandalone = useIsStandalone()

  React.useEffect(() => {
    document.documentElement.classList.toggle('standalone', isStandalone)
    return () => {
      document.documentElement.classList.remove('standalone')
    }
  }, [isStandalone])
}
