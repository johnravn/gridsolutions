// src/shared/ui/toast/ToastProvider.tsx
import * as React from 'react'
import { createPortal } from 'react-dom'
import * as Toast from '@radix-ui/react-toast'
import { Button, IconButton, Spinner, Text, Theme } from '@radix-ui/themes'
import {
  CheckCircleSolid,
  InfoCircle,
  Undo,
  WarningTriangle,
  Xmark,
} from 'iconoir-react'
import { useMediaQuery } from '@app/hooks/useMediaQuery'
import { wasDemoBlockRecently } from '@features/demo/lib/demoModeState'

type ToastKind = 'success' | 'error' | 'info' | 'progress'
type ToastItem = {
  id: string
  title: string
  description?: string
  kind: ToastKind
  duration?: number
  onUndo?: () => void
  undoLabel?: string
  progressCurrent?: number
  progressTotal?: number
  closing?: boolean
}

export type ProgressToastHandle = {
  update: (next: {
    title?: string
    description?: string
    current?: number
    total?: number
  }) => void
  success: (title: string, description?: string, duration?: number) => void
  error: (title: string, description?: string, duration?: number) => void
  dismiss: () => void
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
  progress: (
    title: string,
    description?: string,
    opts?: { current?: number; total?: number },
  ) => ProgressToastHandle
}

const ToastCtx = React.createContext<ToastContextValue | null>(null)

const DEFAULT_DURATION: Record<ToastKind, number> = {
  success: 2800,
  info: 3200,
  error: 5000,
  progress: 0,
}
const UNDO_DURATION = 5000
/** Keep in sync with `--app-toast-exit-ms` in styles.css */
const TOAST_EXIT_MS = 120

export function useToast() {
  const ctx = React.useContext(ToastCtx)
  if (!ctx) throw new Error('useToast must be used within <AppToastProvider>')
  return ctx
}

function resolveDuration(t: ToastItem): number {
  if (t.kind === 'progress') return Infinity
  if (t.duration === 0) return Infinity
  if (t.duration != null) return t.duration
  if (t.onUndo) return UNDO_DURATION
  return DEFAULT_DURATION[t.kind]
}

function progressPercent(t: ToastItem): number | null {
  const total = t.progressTotal
  if (total == null || total <= 0) return null
  const current = t.progressCurrent ?? 0
  return Math.max(0, Math.min(100, Math.round((current / total) * 100)))
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
  const percent = t.kind === 'progress' ? progressPercent(t) : null

  const finish = React.useCallback(() => {
    if (removedRef.current) return
    removedRef.current = true
    onRemove(t.id)
  }, [onRemove, t.id])

  const dismiss = () => setOpen(false)

  React.useEffect(() => {
    if (t.closing) setOpen(false)
  }, [t.closing])

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
      <div className="app-toast-row">
        <div className="app-toast-icon" aria-hidden>
          {t.kind === 'success' ? (
            <CheckCircleSolid width={18} height={18} />
          ) : t.kind === 'error' ? (
            <WarningTriangle width={18} height={18} />
          ) : t.kind === 'progress' ? (
            <Spinner size="2" />
          ) : (
            <InfoCircle width={18} height={18} />
          )}
        </div>

        <div className="app-toast-body">
          <Toast.Title asChild>
            <Text size="3" weight="medium" className="app-toast-title">
              {t.title}
            </Text>
          </Toast.Title>
          {t.description && (
            <Toast.Description asChild>
              <Text size="2" color="gray" className="app-toast-desc">
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
            <Undo width={14} height={14} />
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
            <Xmark width={14} height={14} strokeWidth={2} />
          </IconButton>
        </Toast.Close>
      </div>
      {t.kind === 'progress' && (
        <div
          className="app-toast-progress"
          role="progressbar"
          aria-label={t.title}
          aria-valuemin={0}
          aria-valuemax={percent == null ? undefined : 100}
          aria-valuenow={percent ?? undefined}
        >
          <div
            className="app-toast-progress-bar"
            data-indeterminate={percent == null ? 'true' : undefined}
            style={percent == null ? undefined : { width: `${percent}%` }}
          />
        </div>
      )}
    </Toast.Root>
  )
}

const TOAST_HOST_ID = 'app-toast-host'

/** Sit on `document.body` so dialog overlays cannot trap toasts in a lower stacking context. */
function toastPortalHost(): HTMLElement {
  const existing = document.getElementById(TOAST_HOST_ID)
  if (existing) return existing
  const el = document.createElement('div')
  el.id = TOAST_HOST_ID
  document.body.appendChild(el)
  return el
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

  const updateById = React.useCallback(
    (id: string, patch: Partial<ToastItem>) => {
      setToasts((prev) =>
        prev.map((t) => (t.id === id ? { ...t, ...patch } : t)),
      )
    },
    [],
  )

  const push = React.useCallback((t: Omit<ToastItem, 'id'>) => {
    const id = crypto.randomUUID()
    setToasts((prev) => [...prev, { ...t, id }])
    return id
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
    progress: (title, description, opts) => {
      const id = push({
        kind: 'progress',
        title,
        description,
        progressCurrent: opts?.current,
        progressTotal: opts?.total,
      })
      return {
        update: (next) =>
          updateById(id, {
            ...(next.title != null ? { title: next.title } : null),
            ...(next.description != null
              ? { description: next.description }
              : null),
            ...(next.current != null
              ? { progressCurrent: next.current }
              : null),
            ...(next.total != null ? { progressTotal: next.total } : null),
          }),
        success: (nextTitle, nextDescription, duration) =>
          updateById(id, {
            kind: 'success',
            title: nextTitle,
            description: nextDescription,
            duration,
            progressCurrent: undefined,
            progressTotal: undefined,
          }),
        error: (nextTitle, nextDescription, duration) => {
          if (wasDemoBlockRecently()) {
            updateById(id, { closing: true })
            return
          }
          console.error('[Toast Error]', {
            title: nextTitle,
            description: nextDescription,
            duration,
            timestamp: new Date().toISOString(),
            stack: new Error().stack,
          })
          updateById(id, {
            kind: 'error',
            title: nextTitle,
            description: nextDescription,
            duration,
            progressCurrent: undefined,
            progressTotal: undefined,
          })
        },
        dismiss: () => updateById(id, { closing: true }),
      }
    },
  }

  const viewport = (
    <Toast.Viewport
      className="app-toast-viewport"
      data-placement={isPhone ? 'top' : 'bottom'}
    />
  )

  const toastLayer = (
    <Theme hasBackground={false} className="app-toast-layer">
      {viewport}
      {toasts.map((t) => (
        <ToastItemView key={t.id} toast={t} onRemove={remove} />
      ))}
    </Theme>
  )

  return (
    <ToastCtx.Provider value={api}>
      <Toast.Provider
        swipeDirection={isPhone ? 'up' : 'right'}
        duration={DEFAULT_DURATION.info}
      >
        {children}
        {host ? createPortal(toastLayer, host) : toastLayer}
      </Toast.Provider>
    </ToastCtx.Provider>
  )
}
