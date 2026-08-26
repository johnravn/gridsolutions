import * as React from 'react'

type MobileNavContextValue = {
  navOpen: boolean
  setNavOpen: React.Dispatch<React.SetStateAction<boolean>>
}

const MobileNavContext = React.createContext<MobileNavContextValue | null>(null)

const noopSetNavOpen: React.Dispatch<React.SetStateAction<boolean>> = () => {}

export function MobileNavProvider({
  navOpen,
  setNavOpen,
  children,
}: {
  navOpen: boolean
  setNavOpen: React.Dispatch<React.SetStateAction<boolean>>
  children: React.ReactNode
}) {
  const value = React.useMemo(
    () => ({ navOpen, setNavOpen }),
    [navOpen, setNavOpen],
  )
  return (
    <MobileNavContext.Provider value={value}>
      {children}
    </MobileNavContext.Provider>
  )
}

export function useMobileNav() {
  const ctx = React.useContext(MobileNavContext)
  return ctx ?? { navOpen: false, setNavOpen: noopSetNavOpen }
}
