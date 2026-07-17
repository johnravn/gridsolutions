// src/app/layout/Sidebar.tsx
import * as React from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import {
  Avatar,
  Badge,
  Box,
  Button,
  Flex,
  IconButton,
  Select,
  Separator,
  Text,
  Tooltip,
} from '@radix-ui/themes'
import {
  BoxIso,
  Building,
  Calendar,
  Car,
  Clock,
  GoogleDocs,
  Group,
  HomeAlt,
  Menu,
  Message,
  Potion,
  RssFeed,
  StatsUpSquare,
  User,
  UserLove,
} from 'iconoir-react'
import { useAuthz } from '@shared/auth/useAuthz'
import { canVisit } from '@shared/auth/permissions'
import { useCompany } from '@shared/companies/CompanyProvider'
import { supabase } from '@shared/api/supabase'
import { getInitials } from '@shared/lib/generalFunctions'
import { companyExpansionQuery } from '@features/company/api/queries'
import { unreadMattersCountQueryAll } from '@features/matters/api/queries'
import { jobsReadyToInvoiceQuery } from '@features/home/api/jobsReadyToInvoiceQuery'
import logoBlack from '@shared/assets/gridLogo/grid_logo_black.svg'
import logoWhite from '@shared/assets/gridLogo/grid_logo_white.svg'
import { useDemoMode } from '@features/demo/hooks/useDemoMode'
import { useSidebarNavKeyboardShortcut } from '@shared/lib/keyboardShortcuts'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { useTheme } from '../hooks/useTheme'
import { APP_VERSION } from '../config/releaseNotes'
import { useSidebarNavIndicators } from './useSidebarNavIndicators'

const SIDEBAR_WIDTH = 200

type NavItem = { to: string; label: string; icon: React.ReactNode }

export const NAV: Array<Array<NavItem>> = [
  [
    { to: '/dashboard', label: 'Home', icon: <HomeAlt /> },
    { to: '/latest', label: 'Latest', icon: <RssFeed strokeWidth={2} /> },
    { to: '/inventory', label: 'Inventory', icon: <BoxIso /> },
    { to: '/vehicles', label: 'Vehicles', icon: <Car /> },
    { to: '/crew', label: 'Crew', icon: <Group /> },
    { to: '/jobs', label: 'Jobs', icon: <GoogleDocs /> },
    { to: '/customers', label: 'Customers', icon: <UserLove /> },
    { to: '/logging', label: 'Logging', icon: <Clock /> },
    { to: '/calendar', label: 'Calendar', icon: <Calendar /> },
  ],
  [
    { to: '/matters', label: 'Matters', icon: <Message /> },
    { to: '/company', label: 'Company', icon: <Building /> },
    { to: '/reporting', label: 'Reporting', icon: <StatsUpSquare /> },
    { to: '/profile', label: 'Profile', icon: <User /> },
  ],
  [{ to: '/super', label: 'Super', icon: <Potion /> }],
]

const PUBLIC_LABELS = new Set(['Home', 'Calendar', 'Matters', 'Profile'])

const LABEL_TO_CAP: Record<string, string> = {
  Home: 'visit:home',
  Inventory: 'visit:inventory',
  Vehicles: 'visit:vehicles',
  Crew: 'visit:crew',
  Jobs: 'visit:jobs',
  Calendar: 'visit:calendar',
  Logging: 'visit:logging',
  Customers: 'visit:customers',
  Latest: 'visit:latest',
  Matters: 'visit:matters',
  Company: 'visit:company',
  Reporting: 'visit:company',
  Profile: 'visit:profile',
  Super: 'visit:super',
}

function useAllowedSidebarRoutes() {
  const { caps, loading: authzLoading, isGlobalSuperuser } = useAuthz()
  const { data: user } = useQuery({
    queryKey: ['auth', 'user'],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser()
      return data.user ?? null
    },
  })
  const hasUser = !!user

  const allowed = React.useCallback(
    (label: string) => {
      const cap = LABEL_TO_CAP[label]

      if (label === 'Super') {
        if (!authzLoading) {
          return caps.has('visit:super')
        }
        if (isGlobalSuperuser) {
          return true
        }
        return hasUser
      }

      if (authzLoading) {
        return cap ? PUBLIC_LABELS.has(label) : true
      }

      return cap ? canVisit(caps, cap as any) : true
    },
    [authzLoading, caps, hasUser, isGlobalSuperuser],
  )

  const allowedRoutes = React.useMemo(
    () =>
      NAV.flat()
        .filter((n) => allowed(n.label))
        .map((n) => n.to),
    [allowed],
  )

  return { allowed, allowedRoutes, user }
}

export function Sidebar({
  open,
  onToggle,
  currentPath,
  // NEW:
  userDisplayName,
  userEmail,
  userAvatarUrl,
  onLogout,
}: {
  open: boolean
  onToggle: (next?: boolean) => void
  currentPath: string
  userDisplayName?: string
  userEmail?: string
  userAvatarUrl?: string | null
  onLogout?: () => void
}) {
  const isMobile = useMediaQuery('(max-width: 768px)')
  const staticWidth = isMobile ? 0 : SIDEBAR_WIDTH
  const navigate = useNavigate()
  const { allowedRoutes } = useAllowedSidebarRoutes()

  // Keep this on the outer Sidebar so shortcuts work while the drawer is closed.
  useSidebarNavKeyboardShortcut({
    routes: allowedRoutes,
    currentPath,
    onNavigate: (to) => {
      void navigate({ to })
      if (isMobile) onToggle(false)
    },
  })

  React.useEffect(() => {
    if (!isMobile || !open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onToggle(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isMobile, open, onToggle])

  return (
    <>
      {/* Static slot (desktop width reservation) */}
      <Box
        asChild
        style={{
          width: staticWidth,
        }}
      >
        <aside aria-label="Sidebar navigation" />
      </Box>

      {/* Actual sidebar content */}
      {isMobile ? (
        <>
          {/*
            Non-modal drawer: avoid Radix Dialog's body scroll-lock.
            That lock applies margin-right for scrollbar gap and fights iOS
            visualViewport — the page card behind the glass jumped vertically
            and grew wider once scrolling forced a reflow.
          */}
          <div
            className="app-sidebar-backdrop"
            data-open={open ? 'true' : undefined}
            aria-hidden={!open}
            onClick={() => onToggle(false)}
          />
          <aside
            className="app-sidebar-glass app-sidebar-drawer"
            data-open={open ? 'true' : undefined}
            aria-hidden={!open}
            aria-label="Navigation"
            inert={!open ? true : undefined}
            style={{
              position: 'fixed',
              left: 0,
              top: 0,
              height: '100svh',
              width: 'var(--app-sidebar-drawer-width)',
              maxWidth: '85vw',
              margin: 0,
              borderRadius: 0,
              borderRight: '1px solid var(--gray-a5)',
              boxShadow: 'var(--shadow-4)',
              padding: 0,
              paddingTop: 'var(--app-safe-top)',
              paddingBottom: 'var(--app-safe-bottom)',
              overflowX: 'visible',
              overflowY: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              zIndex: 101,
            }}
          >
            <SidebarContent
              open
              onToggle={onToggle}
              currentPath={currentPath}
              isMobile={isMobile}
              userDisplayName={userDisplayName}
              userEmail={userEmail}
              userAvatarUrl={userAvatarUrl}
              onLogout={onLogout}
            />
          </aside>
        </>
      ) : (
        <Box
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: staticWidth,
            pointerEvents: 'none',
          }}
        >
          <Box
            style={{
              height: '100svh',
              width: staticWidth,
              pointerEvents: 'auto',
            }}
          >
            <SidebarContent
              open
              onToggle={onToggle}
              currentPath={currentPath}
              isMobile={isMobile}
            />
          </Box>
        </Box>
      )}
    </>
  )
}

function SidebarContent({
  open,
  onToggle,
  currentPath,
  isMobile,
  showCollapseButton,
  // NEW:
  userDisplayName,
  userEmail,
  userAvatarUrl,
  onLogout,
}: {
  open: boolean
  onToggle: (next?: boolean) => void
  currentPath: string
  isMobile: boolean
  showCollapseButton?: boolean
  userDisplayName?: string
  userEmail?: string
  userAvatarUrl?: string | null
  onLogout?: () => void
}) {
  const { companies, companyId, setCompanyId, loading, company } = useCompany()
  const { isDemoMode } = useDemoMode()
  const { isDark } = useTheme()
  const { allowed, user } = useAllowedSidebarRoutes()
  const { userId } = useAuthz()

  const { data: unreadMatters = 0 } = useQuery({
    ...unreadMattersCountQueryAll(),
    enabled: !!user?.id,
  })

  const { data: jobsReadyToInvoice = [] } = useQuery({
    ...jobsReadyToInvoiceQuery({
      companyId: companyId ?? '',
      userId: userId ?? '',
    }),
    enabled: !!companyId && !!userId,
  })
  const readyToInvoiceCount = jobsReadyToInvoice.length
  const navCountBadgeStyle = isMobile
    ? {
        minWidth: 24,
        height: 24,
        padding: '0 7px',
        fontSize: 'var(--font-size-2)',
      }
    : {
        minWidth: 18,
        height: 18,
        padding: '0 5px',
        fontSize: 'var(--font-size-1)',
      }
  const { data: companyExpansion } = useQuery({
    ...(companyId
      ? companyExpansionQuery({ companyId })
      : {
          queryKey: ['company', 'none', 'expansion'] as const,
          queryFn: () => Promise.resolve(null),
        }),
    enabled: !!companyId,
  })
  const companiesSorted = React.useMemo(
    () => [...companies].sort((a, b) => a.name.localeCompare(b.name)),
    [companies],
  )
  const logo = isDark ? logoWhite : logoBlack

  const isSandboxMode =
    !!companyExpansion &&
    companyExpansion.accounting_software === 'conta' &&
    companyExpansion.accounting_api_environment === 'sandbox'

  const navListProps = useSidebarNavIndicators(currentPath)

  return (
    <aside
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        flex: 1,
        /* Let hover nudge paint into the main area; nav stretches so no clip needed */
        overflow: 'visible',
      }}
    >
      {/* Mobile user panel */}
      {isMobile && (
        <>
          <Flex
            align="center"
            justify="between"
            pl="5"
            pr="3"
            py="3"
            gap="3"
            style={{ flexShrink: 0 }}
          >
            <Flex align="center" gap="3" style={{ minWidth: 0, flex: 1 }}>
              <Button
                variant="ghost"
                size="3"
                asChild
                style={{ padding: 0 }}
                onClick={() => onToggle(false)}
                aria-label="Go to profile"
              >
                <Link to="/profile" style={{ textDecoration: 'none' }}>
                  <Flex align="center" gap="2">
                    <Avatar
                      size="3"
                      radius="full"
                      src={userAvatarUrl ?? undefined}
                      fallback={getInitials(
                        userDisplayName || userEmail || '?',
                      )}
                      style={{ border: '1px solid var(--gray-5)' }}
                    />
                    <Flex direction="column" style={{ lineHeight: 1.1 }}>
                      <Text size="3" weight="medium" truncate>
                        {userDisplayName || userEmail || 'Profile'}
                      </Text>
                      {userEmail && (
                        <Text size="1" color="gray" truncate>
                          {userEmail}
                        </Text>
                      )}
                    </Flex>
                  </Flex>
                </Link>
              </Button>
            </Flex>

            {onLogout && (
              <Button size="2" variant="soft" onClick={onLogout}>
                Logout
              </Button>
            )}
          </Flex>

          <Separator size="4" />
        </>
      )}

      {/* Header / Company selector */}
      <Flex
        align="center"
        justify="between"
        px="3"
        py="3"
        gap="3"
        style={{ flexShrink: 0 }}
      >
        <Flex align="center" gap="2" style={{ minWidth: 0, flex: 1 }}>
          {open && (
            <div style={{ width: '100%', minWidth: 0, overflow: 'hidden' }}>
              <Text as="div" size="1" color="gray" style={{ marginBottom: 4 }}>
                Company
              </Text>
              {!loading && isDemoMode && company && (
                <Text size="3" weight="medium" truncate>
                  {company.name}
                </Text>
              )}
              {!loading && !isDemoMode && (
                <Select.Root
                  value={companyId ?? undefined}
                  onValueChange={(next) => {
                    if (next && next !== companyId) setCompanyId(next)
                  }}
                  disabled={companiesSorted.length === 0}
                >
                  <Select.Trigger
                    placeholder="Select company"
                    variant="ghost"
                    style={{ maxWidth: '100%' }}
                  />
                  <Select.Content style={{ zIndex: 10000 }}>
                    {companiesSorted.map((c) => (
                      <Select.Item key={c.id} value={c.id}>
                        {c.name}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select.Root>
              )}
              {isSandboxMode && (
                <Badge
                  color="orange"
                  variant="soft"
                  size="1"
                  style={{ marginTop: 6 }}
                >
                  Accounting in Sandbox Mode
                </Badge>
              )}
            </div>
          )}
        </Flex>

        {!isMobile && showCollapseButton && (
          <Tooltip content={open ? 'Collapse' : 'Expand'} delayDuration={300}>
            <IconButton
              size="2"
              variant="ghost"
              onClick={() => onToggle(!open)}
              aria-label={open ? 'Collapse sidebar' : 'Expand sidebar'}
            >
              <Menu />
            </IconButton>
          </Tooltip>
        )}
      </Flex>

      <Separator size="4" />

      {/* Main nav area — fixed-height items; scroll when needed */}
      <Box
        flexGrow="1"
        style={{
          position: 'relative',
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          /* Keep overflow visible so hover/radius aren't clipped horizontally */
          overflow: 'visible',
        }}
      >
        <Box
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            overscrollBehavior: 'contain',
            paddingTop: 'var(--space-2)',
            paddingRight: 'var(--space-2)',
            paddingBottom: 'var(--space-2)',
            paddingLeft: 0,
            /* Soft bottom fade into the logo — same mask as home
               horizontal scrollers into column separators. */
            ...(isMobile
              ? {
                  maskImage:
                    'linear-gradient(to bottom, #000 0%, #000 calc(100% - 28px), transparent 100%)',
                  WebkitMaskImage:
                    'linear-gradient(to bottom, #000 0%, #000 calc(100% - 28px), transparent 100%)',
                }
              : undefined),
          }}
        >
          <Flex direction="column" gap="1" {...navListProps}>
          {NAV[0]
            .filter((n) => allowed(n.label))
            .map((n) => (
              <NavItem
                key={n.to}
                to={n.to}
                icon={n.icon}
                label={n.label}
                open={open}
                currentPath={currentPath}
                isMobile={isMobile}
                onCloseMobile={() => onToggle(false)}
                badge={
                  n.label === 'Jobs' && readyToInvoiceCount > 0 ? (
                    <Badge
                      size={isMobile ? '2' : '1'}
                      radius="full"
                      style={navCountBadgeStyle}
                    >
                      {readyToInvoiceCount > 99
                        ? '99+'
                        : readyToInvoiceCount}
                    </Badge>
                  ) : undefined
                }
              />
            ))}
          {(() => {
            const items = NAV[1].filter((n) => allowed(n.label))
            if (items.length === 0) return null
            return (
              <>
                <Separator size="4" />
                {items.map((n) => (
                  <NavItem
                    key={n.to}
                    to={n.to}
                    icon={n.icon}
                    label={n.label}
                    open={open}
                    currentPath={currentPath}
                    isMobile={isMobile}
                    onCloseMobile={() => onToggle(false)}
                    badge={
                      n.label === 'Matters' && unreadMatters > 0 ? (
                        <Badge
                          size={isMobile ? '2' : '1'}
                          radius="full"
                          style={navCountBadgeStyle}
                        >
                          {unreadMatters > 99 ? '99+' : unreadMatters}
                        </Badge>
                      ) : undefined
                    }
                  />
                ))}
              </>
            )
          })()}
          {(() => {
            const items = NAV[2].filter((n) => allowed(n.label))
            if (items.length === 0) return null
            return (
              <>
                <Separator size="4" />
                {items.map((n) => (
                  <NavItem
                    key={n.to}
                    to={n.to}
                    icon={n.icon}
                    label={n.label}
                    open={open}
                    currentPath={currentPath}
                    isMobile={isMobile}
                    onCloseMobile={() => onToggle(false)}
                  />
                ))}
              </>
            )
          })()}
        </Flex>
        </Box>
      </Box>

      {/* Footer logo (only when open) */}
      {open && (
        <Box
          px="3"
          py="3"
          style={{
            position: 'relative',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            ...(isMobile
              ? {
                  /* Match FAB height so logo + close sit on one row */
                  minHeight: 'var(--app-menu-fab-size)',
                  paddingRight:
                    'calc(var(--space-3) + var(--app-menu-fab-size) + var(--space-2))',
                }
              : undefined),
          }}
        >
          <Flex direction="column" align="center" justify="center" gap="2">
            <img
              src={logo}
              alt="Grid Logo"
              style={{
                maxWidth: isMobile ? '100%' : '70%',
                width: isMobile ? 'min(200px, 100%)' : undefined,
                height: 'auto',
                borderRadius: 6,
              }}
            />
            <Text
              size="1"
              color="gray"
              style={{ fontSize: 'var(--font-size-1)', letterSpacing: '0.5px' }}
            >
              v{APP_VERSION}
            </Text>
          </Flex>
        </Box>
      )}
    </aside>
  )
}

function NavItem({
  to,
  icon,
  label,
  open,
  currentPath,
  isMobile,
  onCloseMobile,
  badge,
}: {
  to: string
  icon: React.ReactNode
  label: string
  open: boolean
  currentPath: string
  isMobile: boolean
  onCloseMobile: () => void
  badge?: React.ReactNode
}) {
  const active =
    to === '/'
      ? currentPath === '/'
      : currentPath === to || currentPath.startsWith(to + '/')

  function handleClick(e: React.MouseEvent) {
    if (!isMobile) return
    const modified =
      e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0
    if (!modified) onCloseMobile()
  }

  const content = (
    <Button variant="ghost" size={isMobile ? '3' : '2'} highContrast asChild>
      <Link
        to={to}
        onClick={handleClick}
        className={
          active
            ? 'sidebar-nav-item sidebar-nav-item--active'
            : 'sidebar-nav-item'
        }
        style={{
          justifyContent: open ? 'flex-start' : 'center',
          alignItems: 'center',
          gap: 10,
          width: '100%',
          maxWidth: '100%',
          minWidth: 0,
          position: 'relative',
        }}
      >
        {open ? (
          <Box style={{ flexShrink: 0, display: 'inline-flex' }}>{icon}</Box>
        ) : (
          <Box style={{ position: 'relative', display: 'inline-flex' }}>
            {icon}
            {badge && (
              <Box
                style={{
                  position: 'absolute',
                  top: -6,
                  right: -6,
                }}
              >
                {badge}
              </Box>
            )}
          </Box>
        )}
        {open && (
          <Flex
            align="center"
            justify="between"
            gap="2"
            style={{ flex: 1, minWidth: 0 }}
          >
            <span
              style={{
                lineHeight: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                minWidth: 0,
              }}
            >
              {label}
            </span>
            {badge}
          </Flex>
        )}
      </Link>
    </Button>
  )

  const slotted = (
    <div className="sidebar-nav-slot">
      {!open ? (
        <Tooltip content={label} delayDuration={300}>
          {content}
        </Tooltip>
      ) : (
        content
      )}
    </div>
  )

  return slotted
}
