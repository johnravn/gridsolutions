const DEMO_WRITE_OPS = new Set(['insert', 'update', 'delete', 'upsert'])
const STORAGE_WRITE_OPS = new Set([
  'upload',
  'update',
  'move',
  'copy',
  'remove',
])
const ALLOWED_RPC = new Set(['enter_demo'])

let demoModeActive = false
let onWriteBlocked: (() => void) | null = null
let lastBlockedToastAt = 0

export const DEMO_BLOCKED_ERROR = {
  message: 'This action is not allowed in demo mode.',
  code: 'DEMO_READ_ONLY',
  details: '',
  hint: '',
} as const

export function setDemoModeActive(active: boolean) {
  demoModeActive = active
}

export function isDemoModeActive() {
  return demoModeActive
}

export function registerDemoWriteBlockedHandler(handler: (() => void) | null) {
  onWriteBlocked = handler
}

export function wasDemoBlockRecently(withinMs = 3000) {
  return Date.now() - lastBlockedToastAt < withinMs
}

export function blockDemoWrite(): boolean {
  if (!demoModeActive) return false
  const now = Date.now()
  if (now - lastBlockedToastAt > 1500) {
    lastBlockedToastAt = now
    onWriteBlocked?.()
  }
  return true
}

export function isDemoBlockedError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const e = error as { code?: string; message?: string }
  return (
    e.code === DEMO_BLOCKED_ERROR.code ||
    e.message === DEMO_BLOCKED_ERROR.message
  )
}

export function createBlockedPostgrestBuilder() {
  const response = { data: null, error: { ...DEMO_BLOCKED_ERROR } }
  const promise = Promise.resolve(response)

  const handler: ProxyHandler<object> = {
    get(_target, prop) {
      if (prop === 'then') return promise.then.bind(promise)
      if (prop === 'catch') return promise.catch.bind(promise)
      if (prop === 'finally') return promise.finally.bind(promise)
      return () => createBlockedPostgrestBuilder()
    },
  }

  return new Proxy({}, handler)
}

function proxyWriteMethods<T extends object>(
  target: T,
  blockedMethods: Set<string>,
  blockedReturn: () => unknown,
): T {
  return new Proxy(target, {
    get(obj, prop, receiver) {
      if (typeof prop === 'string' && blockedMethods.has(prop)) {
        const method = Reflect.get(obj, prop, receiver)
        if (typeof method === 'function') {
          return (...args: Array<unknown>) => {
            if (blockDemoWrite()) return blockedReturn()
            return method.apply(obj, args)
          }
        }
      }

      const value = Reflect.get(obj, prop, receiver)
      return typeof value === 'function' ? value.bind(obj) : value
    },
  })
}

function proxyPostgrestBuilder(builder: object): object {
  return new Proxy(builder, {
    get(builderTarget, builderProp, builderReceiver) {
      if (typeof builderProp === 'string' && DEMO_WRITE_OPS.has(builderProp)) {
        const method = Reflect.get(builderTarget, builderProp, builderReceiver)
        if (typeof method === 'function') {
          return (...args: Array<unknown>) => {
            if (blockDemoWrite()) return createBlockedPostgrestBuilder()
            return method.apply(builderTarget, args)
          }
        }
      }

      const value = Reflect.get(builderTarget, builderProp, builderReceiver)
      return typeof value === 'function' ? value.bind(builderTarget) : value
    },
  })
}

function proxyStorageClient(storage: { from: (bucket: string) => object }) {
  return new Proxy(storage, {
    get(storageTarget, storageProp, storageReceiver) {
      if (storageProp === 'from') {
        const originalFrom = Reflect.get(
          storageTarget,
          storageProp,
          storageReceiver,
        ) as (bucket: string) => object
        return (bucket: string) =>
          proxyWriteMethods(
            originalFrom.call(storageTarget, bucket),
            STORAGE_WRITE_OPS,
            () => ({ data: null, error: { ...DEMO_BLOCKED_ERROR } }),
          )
      }

      const value = Reflect.get(storageTarget, storageProp, storageReceiver)
      return typeof value === 'function' ? value.bind(storageTarget) : value
    },
  })
}

export function wrapSupabaseClientForDemo<T extends object>(client: T): T {
  return new Proxy(client, {
    get(target, prop, receiver) {
      if (prop === 'from') {
        const originalFrom = Reflect.get(target, prop, receiver) as (
          table: string,
        ) => object
        return (table: string) =>
          proxyPostgrestBuilder(originalFrom.call(target, table))
      }

      if (prop === 'rpc') {
        const originalRpc = Reflect.get(target, prop, receiver) as (
          fn: string,
          params?: object,
          options?: object,
        ) => object
        return (fn: string, params?: object, options?: object) => {
          if (blockDemoWrite() && !ALLOWED_RPC.has(fn)) {
            return createBlockedPostgrestBuilder()
          }
          return proxyPostgrestBuilder(
            originalRpc.call(target, fn, params, options),
          )
        }
      }

      if (prop === 'storage') {
        const storage = Reflect.get(target, prop, receiver) as {
          from: (bucket: string) => object
        }
        return proxyStorageClient(storage)
      }

      if (prop === 'functions') {
        const functions = Reflect.get(target, prop, receiver) as {
          invoke: (...args: Array<unknown>) => Promise<unknown>
        }
        return proxyWriteMethods(functions, new Set(['invoke']), () => ({
          data: null,
          error: { ...DEMO_BLOCKED_ERROR },
        }))
      }

      const value = Reflect.get(target, prop, receiver)
      return typeof value === 'function' ? value.bind(target) : value
    },
  })
}
