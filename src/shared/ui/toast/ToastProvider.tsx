// src/shared/ui/toast/ToastProvider.tsx
import * as React from 'react'
import { createPortal } from 'react-dom'
import * as Toast from '@radix-ui/react-toast'
import { Button, IconButton, Text } from '@radix-ui/themes'
import {
  CheckCircleSolid,
  InfoCircle,
  Undo,
  WarningTriangle,
  Xmark,
} from 'iconoir-react'
import { useMediaQuery } from '@app/hooks/useMediaQuery'
import { wasDemoBlockRecently } from '@features/demo/lib/demoModeState'

type ToastKind = 'success' | 'error' | 'info'
type ToastItem = {
  id: string
  title: string
  description?: string
  kind: ToastKind
  duration?: number
  onUndo?: () => void
  undoLabel?: string
}

type ToastContextValue = {
  show: (opts: Omit<ToastItem, 'id' | 'kind'> & { kind?: ToastKind }) => void
  success: (
    title: string,
    description?: string,
    duration?: number,
    onUndo?: () => void,
    undoLabel?: string,
  ) => void
  error: (title: string, description?: string, duration?: number) => void
  info: (title: string, description?: string, duration?: number) => void
}

const ToastCtx = React.createContext<ToastContextValue | null>(null)

const DEFAULT_DURATION: Record<ToastKind, number> = {
  success: 1800,
  info: 2200,
  error: 4000,
}
const UNDO_DURATION = 4000
/** Keep in sync with `--app-toast-exit-ms` in styles.css */
const TOAST_EXIT_MS = 120

export function useToast() {
  const ctx = React.useContext(ToastCtx)
  if (!ctx) throw new Error('useToast must be used within <AppToastProvider>')
  return ctx
}

function resolveDuration(t: ToastItem): number {
  if (t.duration === 0) return Infinity
  if (t.duration != null) return t.duration
  if (t.onUndo) return UNDO_DURATION
  return DEFAULT_DURATION[t.kind]
}

function ToastItemView({
  toast: t,
  onRemove,
}: {
  toast: ToastItem
  onRemove: (id: string) => void
}) {
  const [open, setOpen] = React.useState(true)
  const removedRef = React.useRef(false)
  const duration = resolveDuration(t)

  const finish = React.useCallback(() => {
    if (removedRef.current) return
    removedRef.current = true
    onRemove(t.id)
  }, [onRemove, t.id])

  const dismiss = () => setOpen(false)

  const handleUndo = () => {
    t.onUndo?.()
    dismiss()
  }

  return (
    <Toast.Root
      className="app-toast"
      data-kind={t.kind}
      open={open}
      onOpenChange={(next) => {
        if (next) return
        setOpen(false)
        window.setTimeout(finish, TOAST_EXIT_MS)
      }}
      duration={duration}
    >
      <div className="app-toast-icon" aria-hidden>
        {t.kind === 'success' ? (
          <CheckCircleSolid width={14} height={14} />
        ) : t.kind === 'error' ? (
          <WarningTriangle width={14} height={14} />
        ) : (
          <InfoCircle width={14} height={14} />
        )}
      </div>

      <div className="app-toast-body">
        <Toast.Title asChild>
          <Text size="2" weight="medium" className="app-toast-title">
            {t.title}
          </Text>
        </Toast.Title>
        {t.description && (
          <Toast.Description asChild>
            <Text size="1" color="gray" className="app-toast-desc">
              {t.description}
            </Text>
          </Toast.Description>
        )}
      </div>

      {t.onUndo && (
        <Button
          size="1"
          variant="ghost"
          color="gray"
          highContrast
          onClick={handleUndo}
          className="app-toast-action"
        >
          <Undo width={12} height={12} />
          {t.undoLabel || 'Undo'}
        </Button>
      )}

      <Toast.Close asChild>
        <IconButton
          size="1"
          variant="ghost"
          color="gray"
          aria-label="Dismiss notification"
          className="app-toast-close"
        >
          <Xmark width={12} height={12} strokeWidth={2} />
        </IconButton>
      </Toast.Close>
    </Toast.Root>
  )
}

function toastPortalHost(): HTMLElement {
  return document.querySelector<HTMLElement>('.radix-themes') ?? document.body
}

export function AppToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Array<ToastItem>>([])
  const [host, setHost] = React.useState<HTMLElement | null>(null)
  const isPhone = useMediaQuery('(max-width: 768px)')

  React.useEffect(() => {
    setHost(toastPortalHost())
  }, [])

  const remove = React.useCallback(
    (id: string) => setToasts((t) => t.filter((x) => x.id !== id)),
    [],
  )

  const push = React.useCallback((t: Omit<ToastItem, 'id'>) => {
    const id = crypto.randomUUID()
    setToasts((prev) => [...prev, { ...t, id }])
  }, [])

  const api: ToastContextValue = {
    show: ({ kind = 'info', ...rest }) => {
      if (kind === 'error') {
        console.error('[Toast Error]', {
          title: rest.title,
          description: rest.description,
          duration: rest.duration,
          timestamp: new Date().toISOString(),
          stack: new Error().stack,
        })
      }
      push({ kind, ...rest })
    },
    success: (title, description, duration, onUndo, undoLabel) =>
      push({
        kind: 'success',
        title,
        description,
        duration,
        onUndo,
        undoLabel,
      }),
    error: (title, description, duration) => {
      if (wasDemoBlockRecently()) return
      console.error('[Toast Error]', {
        title,
        description,
        duration,
        timestamp: new Date().toISOString(),
        stack: new Error().stack,
      })
      push({ kind: 'error', title, description, duration })
    },
    info: (title, description, duration) =>
      push({ kind: 'info', title, description, duration }),
  }

  const viewport = (
    <Toast.Viewport
      className="app-toast-viewport"
      data-placement={isPhone ? 'top' : 'bottom'}
    />
  )

  return (
    <ToastCtx.Provider value={api}>
      <Toast.Provider
        swipeDirection={isPhone ? 'up' : 'right'}
        duration={DEFAULT_DURATION.info}
      >
        {children}

        {host ? createPortal(viewport, host) : viewport}

        {toasts.map((t) => (
          <ToastItemView key={t.id} toast={t} onRemove={remove} />
        ))}
      </Toast.Provider>
    </ToastCtx.Provider>
  )
}
