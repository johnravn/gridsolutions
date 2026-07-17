import * as React from 'react'
import type { ShortcutId } from './shortcutRegistry'

type ActionHandler = () => void

type ShortcutActionsContextValue = {
  registerAction: (id: ShortcutId, handler: ActionHandler) => () => void
  runAction: (id: ShortcutId) => boolean
  hasAction: (id: ShortcutId) => boolean
}

const ShortcutActionsContext =
  React.createContext<ShortcutActionsContextValue | null>(null)

export function ShortcutActionsProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const handlersRef = React.useRef(new Map<ShortcutId, ActionHandler>())

  const registerAction = React.useCallback(
    (id: ShortcutId, handler: ActionHandler) => {
      handlersRef.current.set(id, handler)
      return () => {
        if (handlersRef.current.get(id) === handler) {
          handlersRef.current.delete(id)
        }
      }
    },
    [],
  )

  const runAction = React.useCallback((id: ShortcutId) => {
    const handler = handlersRef.current.get(id)
    if (!handler) return false
    handler()
    return true
  }, [])

  const hasAction = React.useCallback(
    (id: ShortcutId) => handlersRef.current.has(id),
    [],
  )

  const value = React.useMemo(
    (): ShortcutActionsContextValue => ({
      registerAction,
      runAction,
      hasAction,
    }),
    [registerAction, runAction, hasAction],
  )

  return (
    <ShortcutActionsContext.Provider value={value}>
      {children}
    </ShortcutActionsContext.Provider>
  )
}

export function useShortcutActions(): ShortcutActionsContextValue {
  const ctx = React.useContext(ShortcutActionsContext)
  if (!ctx) {
    throw new Error(
      'useShortcutActions must be used within ShortcutActionsProvider',
    )
  }
  return ctx
}

/** Register a create/page action for the lifetime of the calling component. */
export function useRegisterShortcutAction(
  id: ShortcutId,
  handler: ActionHandler,
  enabled = true,
) {
  const { registerAction } = useShortcutActions()
  const handlerRef = React.useRef(handler)
  handlerRef.current = handler

  React.useEffect(() => {
    if (!enabled) return
    return registerAction(id, () => handlerRef.current())
  }, [enabled, id, registerAction])
}
