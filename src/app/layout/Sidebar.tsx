// src/app/layout/Sidebar.tsx
import * as React from 'react'
import { Link } from '@tanstack/react-router'
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
import * as ScrollArea from '@radix-ui/react-scroll-area'
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
  User,
  UserLove,
} from 'iconoir-react'
import { useAuthz } from '@shared/auth/useAuthz'
import { canVisit } from '@shared/auth/permissions'
import { useCompany } from '@shared/companies/CompanyProvider'
import { supabase } from '@shared/api/supabase'
import { getInitials } from '@shared/lib/generalFunctions'
import { unreadMattersCountQueryAll } from '@features/matters/api/queries'
import { companyExpansionQuery } from '@features/company/api/queries'
import logoBlack from '@shared/assets/gridLogo/grid_logo_black.svg'
import logoWhite from '@shared/assets/gridLogo/grid_logo_white.svg'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { useTheme } from '../hooks/useTheme'
import { APP_VERSION } from '../config/version'

const SIDEBAR_EXPANDED = 200
const SIDEBAR_COLLAPSED = 64

type NavItem = { to: string; label: string; icon: React.ReactNode }

export const NAV: Array<Array<NavItem>> = [
  [
    { to: '/dashboard', label: 'Home', icon: <HomeAlt /> },
    { to: '/latest', label: 'Latest', icon: <RssFeed strokeWidth={2} /> },
    { to: '/inventory', label: 'Inventory', icon: <BoxIso /> },
    { to: '/vehicles', label: 'Vehicles', icon: <Car /> },
    { to: '/crew', label: 'Crew', icon: <Group /> },
    { to: '/jobs', label: 'Jobs', icon: <GoogleDocs /> },
    { to: '/calendar', label: 'Calendar', icon: <Calendar /> },
    { to: '/logging', label: 'Logging', icon: <Clock /> },
    { to: '/customers', label: 'Customers', icon: <UserLove /> },
  ],
  [
    { to: '/matters', label: 'Matters', icon: <Message /> },
    { to: '/company', label: 'Company', icon: <Building /> },
    { to: '/profile', label: 'Profile', icon: <User /> },
  ],
  [{ to: '/super', label: 'Super', icon: <Potion /> }],
]

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
  const staticWidth = isMobile ? 0 : open ? SIDEBAR_EXPANDED : SIDEBAR_COLLAPSED

  return (
    <>
      {/* Static slot (desktop width reservation) */}
      <Box
        asChild
        style={{
          width: staticWidth,
          transition: 'width 180ms ease',
        }}
      >
        <aside aria-label="Sidebar navigation" />
      </Box>

      {/* Actual sidebar content */}
      {isMobile ? (
        open && (
          <>
            {/* Backdrop */}
            <Box
              onClick={() => onToggle(false)}
              style={{
                position: 'fixed',
                inset: 0,
                background: 'var(--black-a7)',
                zIndex: 50,
              }}
            />
            {/* Drawer */}
            <Box
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                height: '100dvh',
                width: Math.min(320, Math.floor(window.innerWidth * 0.85)),
                background: 'var(--black-a9)',
                borderRight: '1px solid var(--gray-a6)',
                zIndex: 51,
                boxShadow: '0 10px 40px var(--black-a6)',
              }}
            >
              <SidebarContent
                open={open}
                onToggle={onToggle}
                currentPath={currentPath}
                isMobile={isMobile}
                showCollapseButton
                // NEW:
                userDisplayName={userDisplayName}
                userEmail={userEmail}
                userAvatarUrl={userAvatarUrl}
                onLogout={onLogout}
              />
            </Box>
          </>
        )
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
              height: '100dvh',
              width: staticWidth,
              pointerEvents: 'auto',
            }}
          >
            <SidebarContent
              open={open}
              onToggle={onToggle}
              currentPath={currentPath}
              isMobile={isMobile}
              showCollapseButton
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
  const { companies, companyId, setCompanyId, loading } = useCompany()
  const { caps, loading: authzLoading, isGlobalSuperuser } = useAuthz()
  const { isDark } = useTheme()

  // Get userId to check if user is logged in (for optimistic super tab display)
  const { data: user } = useQuery({
    queryKey: ['auth', 'user'],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser()
      return data.user ?? null
    },
  })
  const { data: companyExpansion } = useQuery({
    ...(companyId
      ? companyExpansionQuery({ companyId })
      : {
          queryKey: ['company', 'none', 'expansion'] as const,
          queryFn: () => Promise.resolve(null),
        }),
    enabled: !!companyId,
  })
  const hasUser = !!user
  const companiesSorted = React.useMemo(
    () => [...companies].sort((a, b) => a.name.localeCompare(b.name)),
    [companies],
  )
  const logo = isDark ? logoWhite : logoBlack

  const PUBLIC_LABELS = new Set(['Home', 'Calendar', 'Matters', 'Profile'])
  const isSandboxMode =
    !!companyExpansion &&
    companyExpansion.accounting_software === 'conta' &&
    companyExpansion.accounting_api_environment === 'sandbox'

  function allowed(label: string) {
    const labelToCap: Record<string, string> = {
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
      Profile: 'visit:profile',
      Super: 'visit:super',
    }
    const cap = labelToCap[label]

    // Super tab: always accessible for superusers, even during loading or without company
    if (label === 'Super') {
      // If we have a user and authz is loaded, check capability
      if (!authzLoading) {
        return caps.has('visit:super')
      }
      // During loading, if user is already determined to be superuser, show it
      if (isGlobalSuperuser) {
        return true
      }
      // During loading and we don't know yet: show optimistically if user is logged in
      // (will be hidden if they turn out not to be a superuser once loading completes)
      return hasUser
    }

    // 👇 Key change: while authz is loading, be conservative.
    // Only show public-safe labels to avoid the "everything flashes" issue.
    if (authzLoading) {
      return cap ? PUBLIC_LABELS.has(label) : true
    }

    // Once loaded, use real capabilities
    // Note: 'visit:latest' is conditionally granted to freelancers in useAuthz
    return cap ? canVisit(caps, cap as any) : true
  }

  return (
    <aside
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100dvh',
      }}
    >
      {/* Mobile user panel */}
      {isMobile && (
        <>
          <Flex align="center" justify="between" px="3" py="3" gap="3">
            <Flex align="center" gap="3" style={{ minWidth: 0, flex: 1 }}>
              <Button
                variant="ghost"
                size="3"
                asChild
                style={{ padding: 0 }}
                onClick={() => onToggle(false)}
                aria-label="Go to profile"
              >
                <Link to="/profile">
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
      <Flex align="center" justify="between" px="3" py="3" gap="3">
        <Flex align="center" gap="2" style={{ minWidth: 0, flex: 1 }}>
          {open && (
            <div style={{ width: '100%' }}>
              <Text as="div" size="1" color="gray" style={{ marginBottom: 4 }}>
                Company
              </Text>
              {!loading && (
                <Select.Root
                  // ✅ keep it undefined until you truly have an id
                  value={companyId ?? undefined}
                  // ✅ avoid redundant state writes (prevents loops)
                  onValueChange={(next) => {
                    if (next && next !== companyId) setCompanyId(next)
                  }}
                  disabled={companiesSorted.length === 0}
                >
                  <Select.Trigger
                    placeholder="Select company"
                    variant="ghost"
                  />
                  <Select.Content>
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

        {showCollapseButton && (
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

      {/* Main nav area */}
      <Box flexGrow="1" style={{ minHeight: 0 }}>
        <ScrollArea.Root style={{ height: '100%' }}>
          <ScrollArea.Viewport style={{ padding: '8px 8px 16px' }}>
            <Flex direction="column" gap="4">
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
                      n.label === 'Matters' ? (
                        <MattersUnreadBadge isCollapsed={!open} />
                      ) : undefined
                    }
                  />
                ))}
              {(() => {
                const items = NAV[1].filter((n) => allowed(n.label))
                if (items.length === 0) return null
                return (
                  <>
                    <Separator />
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
                          n.label === 'Matters' ? (
                            <MattersUnreadBadge isCollapsed={!open} />
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
                    <Separator />
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
          </ScrollArea.Viewport>
          <ScrollArea.Scrollbar orientation="vertical">
            <ScrollArea.Thumb />
          </ScrollArea.Scrollbar>
        </ScrollArea.Root>
      </Box>

      {/* Footer logo (only when open) */}
      {open && (
        <Box px="3" py="3">
          <Flex direction="column" align="center" justify="center" gap="2">
            <img
              src={logo}
              alt="Grid Logo"
              style={{ maxWidth: '70%', height: 'auto', borderRadius: 6 }}
            />
            <Text
              size="1"
              style={{
                color: 'var(--gray-9)',
                opacity: 0.6,
                fontSize: '10px',
                letterSpacing: '0.5px',
              }}
            >
              v{APP_VERSION}
            </Text>
          </Flex>
        </Box>
      )}
    </aside>
  )
}

function MattersUnreadBadge({ isCollapsed }: { isCollapsed?: boolean }) {
  const { data: unreadCount = 0 } = useQuery({
    ...unreadMattersCountQueryAll(),
  })

  if (unreadCount === 0) return null

  return (
    <Badge
      radius="full"
      size="1"
      color="blue"
      highContrast={false}
      style={{
        minWidth: 18,
        height: 18,
        padding: '0 6px',
        ...(isCollapsed
          ? {
              backgroundColor: 'var(--blue-7)',
              color: 'var(--blue-12)',
            }
          : {}),
      }}
    >
      {unreadCount > 99 ? '99+' : unreadCount}
    </Badge>
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
    <Button
      variant={active ? 'outline' : 'ghost'}
      size="2"
      highContrast
      asChild
    >
      <Link
        to={to}
        onClick={handleClick}
        style={{
          justifyContent: open ? 'flex-start' : 'center',
          gap: 10,
          width: '100%',
          position: 'relative',
        }}
      >
        {open ? (
          icon
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
          <Flex align="center" justify="between" style={{ flex: 1 }}>
            <span style={{ lineHeight: 1 }}>{label}</span>
            {badge}
          </Flex>
        )}
      </Link>
    </Button>
  )

  if (!open) {
    return (
      <Tooltip content={label} delayDuration={300}>
        {content}
      </Tooltip>
    )
  }
  return content
}
