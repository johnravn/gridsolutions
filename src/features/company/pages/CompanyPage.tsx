// src/features/company/pages/CompanyPage.tsx
import * as React from 'react'
import { Box, Tabs } from '@radix-ui/themes'
import { useLocation, useNavigate } from '@tanstack/react-router'
import { useAuthz } from '@shared/auth/useAuthz'
import { useCompany } from '@shared/companies/CompanyProvider'
import { AnimatedTabsList } from '@shared/ui/components/AnimatedTabsList'
import PageSkeleton from '@shared/ui/components/PageSkeleton'
import {
  useTabKeyboardScopeProps,
  useTabKeyboardShortcuts,
} from '@shared/lib/keyboardShortcuts'
import CompanyOverviewTab from '../components/CompanyOverviewTab'
import CompanyUsersTab from '../components/CompanyUsersTab'
import CompanyExpansionsTab from '../components/CompanyExpansionsTab'
import CompanyPersonalizationTab from '../components/CompanyPersonalizationTab'
import CompanySetupTab from '../components/CompanySetupTab'
import CompanyRatesTab from '../components/CompanyRatesTab'
import CompanyLoggingTab from '../components/CompanyLoggingTab'
import CompanyLogsTab from '../components/CompanyLogsTab'

const COMPANY_MANAGE_TABS = [
  'overview',
  'users',
  'logs',
  'logging',
  'expansions',
  'personalization',
  'rates',
  'setup',
] as const

const LOGS_ONLY_TABS = ['logs'] as const

export default function CompanyPage() {
  const { companyId } = useCompany()
  const { caps } = useAuthz()
  const location = useLocation()
  const navigate = useNavigate()
  const search = location.search as { tab?: string; activityId?: string }
  const tabFromUrl = search.tab
  const activityId = search.activityId

  const canManageCompany = caps.has('visit:company')
  const canViewLogs = caps.has('visit:latest')
  const tabs = canManageCompany ? COMPANY_MANAGE_TABS : LOGS_ONLY_TABS
  const defaultTab = canManageCompany ? 'overview' : 'logs'

  const resolveTab = React.useCallback(
    (candidate: string | undefined) => {
      if (candidate && (tabs as ReadonlyArray<string>).includes(candidate)) {
        return candidate
      }
      // Deep-link to logs even when tab omitted (e.g. /latest redirect)
      if (activityId && canViewLogs) return 'logs'
      return defaultTab
    },
    [tabs, defaultTab, activityId, canViewLogs],
  )

  const [activeTab, setActiveTab] = React.useState<string>(() =>
    resolveTab(tabFromUrl),
  )

  React.useEffect(() => {
    setActiveTab(resolveTab(tabFromUrl))
  }, [tabFromUrl, resolveTab])

  const handleTabChange = (tab: string) => {
    if (!(tabs as ReadonlyArray<string>).includes(tab)) return
    setActiveTab(tab)
    navigate({
      to: '/company',
      search: {
        tab,
        activityId: tab === 'logs' ? activityId : undefined,
      },
    })
  }

  const { scopeRef, scopeProps } = useTabKeyboardScopeProps()
  useTabKeyboardShortcuts({
    scopeRef,
    tabs: [...tabs],
    activeTab,
    onTabChange: handleTabChange,
    enabled: !!companyId,
  })

  const [isLarge, setIsLarge] = React.useState<boolean>(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(min-width: 1024px)').matches
      : false,
  )
  React.useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const onChange = (e: MediaQueryListEvent) => setIsLarge(e.matches)
    try {
      mq.addEventListener('change', onChange)
      return () => mq.removeEventListener('change', onChange)
    } catch {
      mq.addListener(onChange)
      return () => mq.removeListener(onChange)
    }
  }, [])

  if (!companyId) return <PageSkeleton columns="1fr" showInspector={false} />

  // visit:latest-only users may open company for Logs; block other tabs by UI.
  if (!canManageCompany && !canViewLogs) {
    return <PageSkeleton columns="1fr" showInspector={false} />
  }

  return (
    <section
      {...scopeProps}
      style={{
        height: isLarge ? '100%' : undefined,
        minHeight: 0,
      }}
    >
      <Tabs.Root
        defaultValue={defaultTab}
        value={activeTab}
        onValueChange={handleTabChange}
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: isLarge ? '100%' : undefined,
          minHeight: 0,
        }}
      >
        <AnimatedTabsList>
          {canManageCompany && (
            <Tabs.Trigger value="overview">Overview</Tabs.Trigger>
          )}
          {canManageCompany && <Tabs.Trigger value="users">Users</Tabs.Trigger>}
          {canViewLogs && <Tabs.Trigger value="logs">Logs</Tabs.Trigger>}
          {canManageCompany && (
            <Tabs.Trigger value="logging">Logging</Tabs.Trigger>
          )}
          {canManageCompany && (
            <Tabs.Trigger value="expansions">Expansions</Tabs.Trigger>
          )}
          {canManageCompany && (
            <Tabs.Trigger value="personalization">Personalization</Tabs.Trigger>
          )}
          {canManageCompany && <Tabs.Trigger value="rates">Rates</Tabs.Trigger>}
          {canManageCompany && <Tabs.Trigger value="setup">Setup</Tabs.Trigger>}
        </AnimatedTabsList>

        <Box
          pt="4"
          style={{
            flex: isLarge ? 1 : undefined,
            minHeight: isLarge ? 0 : undefined,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {canManageCompany && (
            <Tabs.Content
              value="overview"
              style={{
                flex: 1,
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <CompanyOverviewTab />
            </Tabs.Content>
          )}

          {canManageCompany && (
            <Tabs.Content
              value="users"
              style={{
                flex: 1,
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <CompanyUsersTab />
            </Tabs.Content>
          )}

          {canViewLogs && (
            <Tabs.Content
              value="logs"
              style={{
                flex: 1,
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <CompanyLogsTab initialActivityId={activityId} />
            </Tabs.Content>
          )}

          {canManageCompany && (
            <Tabs.Content
              value="logging"
              style={{
                flex: 1,
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <CompanyLoggingTab />
            </Tabs.Content>
          )}

          {canManageCompany && (
            <Tabs.Content
              value="expansions"
              style={{
                flex: 1,
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <CompanyExpansionsTab />
            </Tabs.Content>
          )}

          {canManageCompany && (
            <Tabs.Content
              value="personalization"
              style={{
                flex: 1,
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <CompanyPersonalizationTab />
            </Tabs.Content>
          )}

          {canManageCompany && (
            <Tabs.Content
              value="rates"
              style={{
                flex: 1,
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <CompanyRatesTab />
            </Tabs.Content>
          )}

          {canManageCompany && (
            <Tabs.Content
              value="setup"
              style={{
                flex: 1,
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <CompanySetupTab />
            </Tabs.Content>
          )}
        </Box>
      </Tabs.Root>
    </section>
  )
}
