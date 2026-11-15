import { useAuthz } from '@shared/auth/useAuthz'
import { resolveCompanyWriteAccess } from '../lib/companyWriteAccess'
import { useDemoMode } from './useDemoMode'

/**
 * Role-based write affordances for company UI.
 *
 * Demo mode intentionally does **not** flip `canWrite`/`isReadOnly`: write
 * buttons stay visible so explorers can click around; mutations are blocked by
 * `wrapSupabaseClientForDemo` (see `demoModeState`) and toasted via
 * `DemoModeBadge`. Use `isDemoReadOnly` when a surface must treat demo as
 * read-only in the UI itself.
 */
export function useCompanyWriteAccess() {
  const { companyRole } = useAuthz()
  const { isDemoMode } = useDemoMode()
  return resolveCompanyWriteAccess({ companyRole, isDemoMode })
}
