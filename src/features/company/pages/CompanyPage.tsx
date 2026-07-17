// src/features/company/pages/CompanyPage.tsx
import * as React from 'react'
import { Box, Tabs } from '@radix-ui/themes'
import { useLocation, useNavigate } from '@tanstack/react-router'
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

const COMPANY_TABS = [
  'overview',
  'users',
  'logging',
  'expansions',
  'personalization',
  'rates',
  'setup',
] as const

export default function CompanyPage() {
  const { companyId } = useCompany()
  const location = useLocation()
  const navigate = useNavigate()
  const search = location.search as { tab?: string }
  const tabFromUrl = search.tab

  // Track active tab, initialize from URL or default to 'overview'
  const [activeTab, setActiveTab] = React.useState<string>(
    tabFromUrl || 'overview',
  )

  // Update tab when URL changes
  React.useEffect(() => {
    if (tabFromUrl) {
      setActiveTab(tabFromUrl)
    }
  }, [tabFromUrl])

  const handleTabChange = (tab: string) => {
    setActiveTab(tab)
    navigate({ to: '/company', search: { tab } })
  }

  const { scopeRef, scopeProps } = useTabKeyboardScopeProps()
  useTabKeyboardShortcuts({
    scopeRef,
    tabs: COMPANY_TABS,
    activeTab,
    onTabChange: handleTabChange,
    enabled: !!companyId,
  })

  // match JobsPage behavior for responsive layout
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

  return (
    <section
      {...scopeProps}
      style={{
        height: isLarge ? '100%' : undefined,
        minHeight: 0,
      }}
    >
      <Tabs.Root
        defaultValue="overview"
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
          <Tabs.Trigger value="overview">Overview</Tabs.Trigger>
          <Tabs.Trigger value="users">Users</Tabs.Trigger>
          <Tabs.Trigger value="logging">Logging</Tabs.Trigger>
          <Tabs.Trigger value="expansions">Expansions</Tabs.Trigger>
          <Tabs.Trigger value="personalization">Personalization</Tabs.Trigger>
          <Tabs.Trigger value="rates">Rates</Tabs.Trigger>
          <Tabs.Trigger value="setup">Setup</Tabs.Trigger>
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
        </Box>
      </Tabs.Root>
    </section>
  )
}
