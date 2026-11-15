import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DEMO_BLOCKED_ERROR,
  blockDemoWrite,
  createBlockedPostgrestBuilder,
  isDemoBlockedError,
  isDemoModeActive,
  registerDemoWriteBlockedHandler,
  setDemoModeActive,
  wasDemoBlockRecently,
  wrapSupabaseClientForDemo,
} from './demoModeState'

describe('demoModeState', () => {
  let clockMs = Date.parse('2026-06-15T12:00:00.000Z')

  beforeEach(() => {
    setDemoModeActive(false)
    registerDemoWriteBlockedHandler(null)
    vi.useFakeTimers()
    // Bump absolute clock each test so module-level lastBlockedToastAt is stale
    clockMs += 60_000
    vi.setSystemTime(new Date(clockMs))
  })

  afterEach(() => {
    setDemoModeActive(false)
    registerDemoWriteBlockedHandler(null)
    vi.useRealTimers()
  })

  it('tracks demo mode active flag', () => {
    expect(isDemoModeActive()).toBe(false)
    setDemoModeActive(true)
    expect(isDemoModeActive()).toBe(true)
  })

  it('does not block writes when demo mode is off', () => {
    const handler = vi.fn()
    registerDemoWriteBlockedHandler(handler)
    expect(blockDemoWrite()).toBe(false)
    expect(handler).not.toHaveBeenCalled()
  })

  it('blocks writes, notifies once, then throttles until the window passes', () => {
    const handler = vi.fn()
    registerDemoWriteBlockedHandler(handler)
    setDemoModeActive(true)
    expect(blockDemoWrite()).toBe(true)
    expect(blockDemoWrite()).toBe(true)
    expect(handler).toHaveBeenCalledTimes(1)
    expect(wasDemoBlockRecently()).toBe(true)
    vi.advanceTimersByTime(1600)
    expect(blockDemoWrite()).toBe(true)
    expect(handler).toHaveBeenCalledTimes(2)
  })

  it('recognizes demo blocked errors', () => {
    expect(isDemoBlockedError(DEMO_BLOCKED_ERROR)).toBe(true)
    expect(isDemoBlockedError({ code: DEMO_BLOCKED_ERROR.code })).toBe(true)
    expect(isDemoBlockedError({ message: 'other' })).toBe(false)
    expect(isDemoBlockedError(null)).toBe(false)
  })

  it('createBlockedPostgrestBuilder resolves to the demo error', async () => {
    const builder = createBlockedPostgrestBuilder() as PromiseLike<{
      data: null
      error: typeof DEMO_BLOCKED_ERROR
    }>
    const result = await builder
    expect(result.data).toBeNull()
    expect(result.error.code).toBe(DEMO_BLOCKED_ERROR.code)
  })

  it('wrapSupabaseClientForDemo blocks table inserts in demo mode', async () => {
    const insert = vi.fn()
    const fakeClient = {
      from: () => ({
        insert,
        select: vi.fn(),
      }),
      rpc: vi.fn(),
      storage: { from: vi.fn() },
      functions: { invoke: vi.fn() },
    }
    const wrapped = wrapSupabaseClientForDemo(fakeClient)
    setDemoModeActive(true)

    const result = await (
      wrapped.from('jobs') as { insert: (...args: unknown[]) => unknown }
    ).insert({ title: 'x' })

    expect(insert).not.toHaveBeenCalled()
    expect(result).toMatchObject({
      data: null,
      error: { code: DEMO_BLOCKED_ERROR.code },
    })
  })

  it('wrapSupabaseClientForDemo allows enter_demo rpc while blocking others', async () => {
    const rpc = vi.fn(() => ({ then: undefined }))
    const fakeClient = {
      from: vi.fn(),
      rpc,
      storage: { from: vi.fn() },
      functions: { invoke: vi.fn() },
    }
    const wrapped = wrapSupabaseClientForDemo(fakeClient)
    setDemoModeActive(true)

    wrapped.rpc('enter_demo')
    expect(rpc).toHaveBeenCalledWith('enter_demo', undefined, undefined)

    const blocked = await wrapped.rpc('other_fn')
    expect(blocked).toMatchObject({
      data: null,
      error: { code: DEMO_BLOCKED_ERROR.code },
    })
  })
})
