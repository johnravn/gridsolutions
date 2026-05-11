import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@shared/types/database.types'

export type SubscribeRealtimeOptions = {
  maxAttempts?: number
  baseDelayMs?: number
  /** Only the first subscribe is delayed (e.g. local Supabase after `db reset`). Retries are not. */
  initialDelayMs?: number
  /**
   * After `removeChannel`, wait this long before opening the next socket.
   * Reduces noisy "WebSocket closed before connection" when Strict Mode or retries
   * tear down a channel that is still handshaking.
   */
  reconnectSettleMs?: number
}

/**
 * Subscribes to a Realtime channel with retries when the socket is not ready yet
 * (common right after `supabase db reset` / Docker restarts while HTTP already works).
 */
export function subscribeRealtimeChannelWithRetry(
  client: SupabaseClient<Database>,
  channelName: string,
  configure: (channel: RealtimeChannel) => RealtimeChannel,
  options?: SubscribeRealtimeOptions,
): () => void {
  const maxAttempts = options?.maxAttempts ?? 14
  const baseDelayMs = options?.baseDelayMs ?? 600
  const initialDelayMs = options?.initialDelayMs ?? 0
  const reconnectSettleMs = options?.reconnectSettleMs ?? 0
  let cancelled = false
  let retryTimer: ReturnType<typeof setTimeout> | null = null
  let settleTimer: ReturnType<typeof setTimeout> | null = null
  let activeChannel: RealtimeChannel | null = null
  let attempt = 0
  let consumedInitialDelay = false

  const clearRetry = () => {
    if (retryTimer) {
      clearTimeout(retryTimer)
      retryTimer = null
    }
  }

  const clearSettle = () => {
    if (settleTimer) {
      clearTimeout(settleTimer)
      settleTimer = null
    }
  }

  const detach = () => {
    clearRetry()
    clearSettle()
    if (activeChannel) {
      const ch = activeChannel
      activeChannel = null
      void client.removeChannel(ch)
    }
  }

  const innerAttach = () => {
    if (cancelled) return
    detach()

    const openSocket = () => {
      if (cancelled) return
      const channel = configure(client.channel(channelName))
      activeChannel = channel
      channel.subscribe((status) => {
        if (cancelled) return
        if (status === 'SUBSCRIBED') {
          attempt = 0
          return
        }
        if (status === 'CLOSED') return
        if (status !== 'CHANNEL_ERROR' && status !== 'TIMED_OUT') return

        detach()
        attempt += 1
        if (attempt > maxAttempts || cancelled) {
          if (
            import.meta.env.DEV &&
            attempt > maxAttempts &&
            typeof console !== 'undefined' &&
            typeof console.info === 'function'
          ) {
            console.info(
              `[realtime] stopped reconnecting to "${channelName}" after ${maxAttempts} failures — check local Supabase (supabase start) or set VITE_DISABLE_APP_REALTIME=true`,
            )
          }
          return
        }
        const exp = Math.min(8, Math.max(0, attempt - 1))
        const delay = Math.min(30_000, baseDelayMs * 2 ** exp)
        retryTimer = setTimeout(attach, delay)
      })
    }

    if (reconnectSettleMs > 0) {
      settleTimer = setTimeout(openSocket, reconnectSettleMs)
    } else {
      openSocket()
    }
  }

  const attach = () => {
    if (cancelled) return
    if (!consumedInitialDelay && initialDelayMs > 0) {
      consumedInitialDelay = true
      retryTimer = setTimeout(() => {
        if (cancelled) return
        innerAttach()
      }, initialDelayMs)
      return
    }
    innerAttach()
  }

  attach()

  return () => {
    cancelled = true
    clearSettle()
    detach()
  }
}
