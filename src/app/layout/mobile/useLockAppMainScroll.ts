import * as React from 'react'

const LOCK_CLASS = 'app-main-scroll--inspector-locked'

/** Locks AppShell main scroll without competing with the nav drawer's lock class. */
export function useLockAppMainScroll(locked: boolean) {
  React.useEffect(() => {
    const el = document.querySelector('.app-main-scroll')
    if (!(el instanceof HTMLElement)) return

    if (locked) el.classList.add(LOCK_CLASS)
    else el.classList.remove(LOCK_CLASS)

    return () => {
      el.classList.remove(LOCK_CLASS)
    }
  }, [locked])
}
