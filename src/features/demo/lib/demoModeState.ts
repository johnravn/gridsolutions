/**
 * Re-export — authoritative demo client wrap lives in `@shared/demo/demoModeState`
 * so shared layers (supabase, toast) do not depend on `@features/demo`.
 */
export {
  DEMO_BLOCKED_ERROR,
  blockDemoWrite,
  createBlockedPostgrestBuilder,
  isDemoBlockedError,
  isDemoModeActive,
  registerDemoWriteBlockedHandler,
  setDemoModeActive,
  wasDemoBlockRecently,
  wrapSupabaseClientForDemo,
} from '@shared/demo/demoModeState'
