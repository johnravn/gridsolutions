// src/shared/ui/toast/ToastProvider.tsx
import * as React from 'react'
import { createPortal } from 'react-dom'
import * as Toast from '@radix-ui/react-toast'
import { Button, Flex, IconButton, Text } from '@radix-ui/themes'
import {
  CheckCircleSolid,
  InfoCircle,
  Undo,
  WarningTriangle,
  Xmark,
} from 'iconoir-react'
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

export function useToast() {
  const ctx = React.useContext(ToastCtx)
  if (!ctx) throw new Error('useToast must be used within <AppToastProvider>')
  return ctx
}

// Separate component for each toast to manage its own timer state
function ToastItem({
  toast: t,
  onRemove,
}: {
  toast: ToastItem
  onRemove: (id: string) => void
}) {
  const duration = t.duration ?? 3000
  const [timeRemaining, setTimeRemaining] = React.useState(duration)

  // Timer effect
  React.useEffect(() => {
    if (duration <= 0) return

    const startTime = Date.now()
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime
      const remaining = Math.max(0, duration - elapsed)
      setTimeRemaining(remaining)

      if (remaining === 0) {
        clearInterval(interval)
        // Auto-dismiss when countdown reaches 0
        onRemove(t.id)
      }
    }, 100)

    return () => clearInterval(interval)
  }, [duration, t.id, onRemove])

  const handleUndo = () => {
    if (t.onUndo) {
      t.onUndo()
    }
    onRemove(t.id)
  }

  // Get border color based on toast kind
  const borderColor =
    t.kind === 'success'
      ? 'var(--green-9)'
      : t.kind === 'error'
        ? 'var(--red-9)'
        : 'var(--blue-9)'

  // Get icon color - using darker, more readable colors
  const iconColor =
    t.kind === 'success'
      ? 'var(--green-11)'
      : t.kind === 'error'
        ? 'var(--red-11)'
        : 'var(--blue-11)'

  // Get subtle background tint based on toast kind
  const backgroundTint =
    t.kind === 'success'
      ? 'rgba(46, 160, 67, 0.08)'
      : t.kind === 'error'
        ? 'rgba(231, 72, 74, 0.08)'
        : 'rgba(49, 130, 206, 0.08)'

  return (
    <Toast.Root
      open
      onOpenChange={(open) => {
        if (!open) onRemove(t.id)
      }}
      duration={duration}
      style={{
        background: backgroundTint,
        backdropFilter: 'blur(16px) saturate(180%)',
        WebkitBackdropFilter: 'blur(16px) saturate(180%)',
        border: `1.5px solid ${borderColor}`,
        borderRadius: 12,
        padding: 14,
        boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.15)',
        display: 'flex',
        gap: 10,
        alignItems: 'flex-start',
        maxWidth: 420,
        zIndex: 2147483647, // Maximum z-index to appear above dialogs
        position: 'relative',
      }}
    >
      {/* Dismiss (always), optional countdown + undo */}
      <div
        style={{
          position: 'absolute',
          top: 6,
          right: 6,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: 4,
          zIndex: 1,
        }}
      >
        <Toast.Close asChild>
          <IconButton
            size="1"
            variant="ghost"
            color="gray"
            aria-label="Dismiss notification"
          >
            <Xmark width={18} height={18} strokeWidth={1.75} />
          </IconButton>
        </Toast.Close>
        {(t.onUndo || t.kind === 'error') && duration > 0 && (
          <Text size="1" color="gray" style={{ fontWeight: 500 }}>
            {Math.ceil(timeRemaining / 1000)}s
          </Text>
        )}
        {t.onUndo && (
          <Button
            size="2"
            variant="ghost"
            color="gray"
            onClick={handleUndo}
            style={{
              fontWeight: 500,
            }}
          >
            <Undo width={14} height={14} />
            {t.undoLabel || 'Undo'}
          </Button>
        )}
      </div>

      <div
        style={{
          lineHeight: 0,
          marginTop: 2,
          color: iconColor,
          flexShrink: 0,
        }}
      >
        {t.kind === 'success' ? (
          <CheckCircleSolid width={20} height={20} />
        ) : t.kind === 'error' ? (
          <WarningTriangle width={20} height={20} />
        ) : (
          <InfoCircle width={20} height={20} />
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <Flex direction="column" gap="2">
          <div>
            <Toast.Title
              style={{
                fontWeight: 600,
                color: 'var(--gray-12)',
                fontSize: 14,
                lineHeight: '20px',
                marginBottom: t.description ? 4 : 0,
                paddingRight: t.onUndo || t.kind === 'error' ? 100 : 44,
              }}
            >
              {t.title}
            </Toast.Title>
            {t.description && (
              <Toast.Description asChild>
                <Text
                  size="2"
                  style={{
                    color: 'var(--gray-11)',
                    lineHeight: '18px',
                  }}
                >
                  {t.description}
                </Text>
              </Toast.Description>
            )}
          </div>
        </Flex>
      </div>
    </Toast.Root>
  )
}

export function AppToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Array<ToastItem>>([])
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  const remove = (id: string) => setToasts((t) => t.filter((x) => x.id !== id))

  const push = React.useCallback((t: Omit<ToastItem, 'id'>) => {
    const id = crypto.randomUUID()
    setToasts((prev) => [...prev, { ...t, id }])
  }, [])

  const api: ToastContextValue = {
    show: ({ kind = 'info', ...rest }) => {
      // Log error to console for debugging when kind is 'error'
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
      // Log error to console for debugging
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
      // Fixed viewport so toasts appear above dialogs, not inside them
      style={{
        position: 'fixed',
        bottom: 'calc(16px + var(--app-safe-bottom))',
        right: 'calc(16px + var(--app-safe-right))',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        width: 'min(420px, calc(100vw - 32px))',
        zIndex: 2147483647, // Maximum z-index to appear above dialogs
        outline: 'none',
        pointerEvents: 'auto',
      }}
    />
  )

  return (
    <ToastCtx.Provider value={api}>
      <Toast.Provider swipeDirection="right">
        {children}

        {/* Register viewport before toast roots so portals resolve immediately */}
        {mounted && typeof document !== 'undefined'
          ? createPortal(viewport, document.body)
          : viewport}

        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onRemove={remove} />
        ))}
      </Toast.Provider>
    </ToastCtx.Provider>
  )
}
