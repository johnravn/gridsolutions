// src/app/layout/AppShell.tsx
import * as React from 'react'
import {
  Link,
  Outlet,
  useNavigate,
  useRouterState,
} from '@tanstack/react-router'
import {
  Avatar,
  Badge,
  Box,
  Button,
  Flex,
  IconButton,
  Text,
} from '@radix-ui/themes'
import { Menu } from 'iconoir-react'
import { supabase } from '@shared/api/supabase'
// add
import { useQuery } from '@tanstack/react-query'
import { useCompany } from '@shared/companies/CompanyProvider'
import { companyExpansionQuery } from '@features/company/api/queries'
import { AnimatedBackground } from '@shared/ui/components/AnimatedBackground'
import { getInitials } from '@shared/lib/generalFunctions'
import { useStandaloneClassEffect } from '@shared/lib/useIsStandalone'
import OfflineBanner from '@shared/ui/components/OfflineBanner'
import { DemoModeBadge } from '@features/demo/components/DemoModeBadge'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { useAppResume } from '../hooks/useAppResume'
import { NAV, Sidebar } from './Sidebar'

const prefersReducedMotionQuery = '(prefers-reduced-motion: reduce)'

export default function AppShell() {
  const [open, setOpen] = React.useState(true)
  const routerState = useRouterState()
  const currentPath = routerState.location.pathname
  const isMobile = useMediaQuery('(max-width: 768px)')
  const systemPrefersReducedMotion = useMediaQuery(prefersReducedMotionQuery)
  const navigate = useNavigate()
  const { companies, companyId, loading: companyLoading } = useCompany()
  useStandaloneClassEffect()
  useAppResume(companyId)
  const isLocal =
    import.meta.env.DEV ||
    ['localhost', '127.0.0.1', '0.0.0.0'].includes(window.location.hostname)

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
  const isLocalDb =
    typeof supabaseUrl === 'string' &&
    (supabaseUrl.includes('127.0.0.1') || supabaseUrl.includes('localhost'))
  const dbBadgeLabel = isLocalDb ? 'Local DB' : 'Remote DB'
  const dbBadgeColor = isLocalDb ? 'green' : 'blue'

  // Get user from shared query (already fetched by CompanyProvider)
  const { data: authUser } = useQuery({
    queryKey: ['auth', 'user'],
    queryFn: async () => {
      const { data, error } = await supabase.auth.getUser()
      if (error) throw error
      return data.user
    },
  })

  // Read the active/inactive flag from the same cache as the Expansions tab so
  // toggling activate/deactivate updates the dev badge in real time via the
  // existing query invalidation on ['company', companyId, 'expansion'].
  const { data: expansionForDevBadge } = useQuery({
    ...(companyId
      ? companyExpansionQuery({ companyId })
      : {
          queryKey: ['company', 'none', 'expansion'] as const,
          queryFn: () => Promise.resolve(null),
        }),
    enabled: isLocal && !!authUser?.id && !!companyId,
  })

  const isApiKeyActive = expansionForDevBadge?.accounting_api_key_active ?? true

  // Conta is configured (production or sandbox key present) but currently paused
  const isContaPaused =
    isLocal &&
    expansionForDevBadge?.accounting_software === 'conta' &&
    !isApiKeyActive &&
    !!(
      expansionForDevBadge.accounting_api_key_encrypted ||
      expansionForDevBadge.accounting_api_key_sandbox_encrypted
    )

  const isProductionContaInDev =
    isLocal &&
    isApiKeyActive &&
    expansionForDevBadge?.accounting_software === 'conta' &&
    expansionForDevBadge.accounting_api_environment === 'production'

  // Load my profile row
  const { data: myProfile } = useQuery({
    queryKey: ['my-profile', authUser?.id],
    enabled: !!authUser?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id,email,display_name,avatar_url')
        .eq('user_id', authUser!.id)
        .maybeSingle()
      if (error) throw error
      return data as {
        user_id: string
        email: string
        display_name: string | null
        avatar_url: string | null
      }
    },
  })

  // Build a public avatar URL from storage path (if any)
  const avatarUrl = React.useMemo(() => {
    if (!myProfile?.avatar_url) return null
    const { data } = supabase.storage
      .from('avatars')
      .getPublicUrl(myProfile.avatar_url)
    return data.publicUrl
  }, [myProfile?.avatar_url])

  const displayName = myProfile?.display_name || myProfile?.email || ''

  // Check user preference for animated background (defaults to false)
  const { data: backgroundPrefs } = useQuery({
    queryKey: ['profile', authUser?.id, 'animated-background-preference'],
    enabled: !!authUser?.id,
    queryFn: async () => {
      if (!authUser?.id)
        return {
          enabled: false,
          intensity: 1.0,
          shapeType: 'circles' as const,
          speed: 1.0,
        }
      const { data } = await supabase
        .from('profiles')
        .select('preferences')
        .eq('user_id', authUser.id)
        .maybeSingle()
      const prefs = data?.preferences as any
      // Default to false if not set
      return {
        enabled: prefs?.animated_background_enabled ?? false,
        intensity: prefs?.animated_background_intensity ?? 1.0,
        shapeType: prefs?.animated_background_shape_type ?? 'circles',
        speed: prefs?.animated_background_speed ?? 1.0,
      }
    },
    staleTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  })

  const backgroundEnabled = backgroundPrefs?.enabled ?? false
  const backgroundIntensity = backgroundPrefs?.intensity ?? 1.0
  const backgroundShapeType = backgroundPrefs?.shapeType ?? 'circles'
  const backgroundSpeed = backgroundPrefs?.speed ?? 1.0
  const showAnimatedBackground =
    backgroundEnabled && !systemPrefersReducedMotion

  React.useEffect(() => {
    if (isMobile) setOpen(false)
  }, [isMobile])

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate({ to: '/' })
  }

  const title = getPageTitle(currentPath)
  const isPublic =
    currentPath === '/login' ||
    currentPath === '/signup' ||
    currentPath === '/legal' ||
    currentPath === '/contact' ||
    currentPath === '/' ||
    currentPath === '/demo' ||
    currentPath.startsWith('/offer/')
  const showNoCompanyMessage =
    !isPublic && !companyLoading && !!authUser?.id && companies.length === 0

  return (
    <Flex
      height={isPublic ? 'auto' : '100svh'} // was 100dvh
      width="100%"
      direction="row"
      style={{ position: 'relative', minHeight: 0 }} // allow children to shrink
    >
      {/* Animated background - only on authenticated pages and if enabled */}
      {!isPublic && showAnimatedBackground && (
        <AnimatedBackground
          intensity={backgroundIntensity}
          shapeType={backgroundShapeType}
          speed={backgroundSpeed}
        />
      )}

      {!isPublic && !showNoCompanyMessage && (
        <Sidebar
          open={open}
          onToggle={(next) => setOpen(next ?? !open)}
          currentPath={currentPath}
          // NEW:
          userDisplayName={displayName}
          userEmail={myProfile?.email ?? ''}
          userAvatarUrl={avatarUrl}
          onLogout={handleLogout}
        />
      )}

      <Box
        style={{
          flex: 1,
          minWidth: 0,
          position: 'relative',
          zIndex: 1,
          backgroundColor: isPublic ? undefined : 'transparent',
        }}
      >
        <Flex
          direction="column"
          style={{ height: isPublic ? 'auto' : '100%', minHeight: 0 }}
        >
          {/* Top bar */}
          <Flex
            align="center"
            justify="between"
            px="4"
            py="3"
            style={{
              flexShrink: 0,
              paddingTop: 'calc(var(--space-3) + var(--app-safe-top))',
              ...(!isPublic && isMobile && open
                ? { paddingLeft: 'calc(var(--space-4) + 0.75rem)' }
                : {}),
            }}
          >
            {!isPublic && isMobile && (
              <IconButton
                size="2"
                variant="ghost"
                aria-label={(open ? 'Close' : 'Open') + ' menu'}
                onClick={() => setOpen((o) => !o)}
              >
                <Menu />
              </IconButton>
            )}
            {!isPublic && (
              <Text size="8" weight="light">
                {title}
              </Text>
            )}
            {!isPublic && !isMobile && (
              <Flex align="center" gap="3">
                <Link to="/profile" style={{ textDecoration: 'none' }}>
                  <Flex
                    align="center"
                    gap="2"
                    // make it feel like a button without Radix Button hover styles
                    role="button"
                    tabIndex={0}
                    aria-label="Go to profile"
                    style={{ cursor: 'pointer' }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.currentTarget.click()
                        e.preventDefault()
                      }
                    }}
                  >
                    <Avatar
                      size="2"
                      radius="full"
                      src={avatarUrl ?? undefined}
                      fallback={getInitials(displayName || '?')}
                      style={{ border: '1px solid var(--gray-5)' }}
                    />
                    <Text size="2" style={{ maxWidth: 200 }} truncate>
                      {displayName}
                    </Text>
                  </Flex>
                </Link>

                <Button variant="soft" onClick={handleLogout}>
                  Logout
                </Button>
              </Flex>
            )}
          </Flex>

          {/* Content area should be the ONLY scroller */}
          <Box
            p={isPublic ? undefined : '4'}
            className={isPublic ? undefined : 'app-main-scroll'}
            style={{
              flex: 1, // <-- grow to fill
              minHeight: 0, // <-- allow scrolling area to shrink
              overflow: isPublic ? 'visible' : 'auto', // <-- scroll here
              paddingBottom: isPublic
                ? undefined
                : 'calc(var(--space-4) + var(--app-safe-bottom))',
            }}
          >
            {!isPublic && <OfflineBanner />}
            {/* <AnimatePresence mode="wait">
              <motion.div
                key={currentPath}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                style={{ height: '100%' }}
              > */}
            {showNoCompanyMessage ? (
              <Flex
                direction="column"
                align="center"
                justify="center"
                gap="3"
                style={{ height: '100%' }}
              >
                <Text size="6" weight="medium">
                  You are not part of any company.
                </Text>
                <Text size="3" color="gray">
                  If this is wrong,{' '}
                  <Link
                    to="/contact"
                    style={{
                      color: 'var(--accent-11)',
                      textDecoration: 'underline',
                    }}
                  >
                    contact support
                  </Link>
                  .
                </Text>
              </Flex>
            ) : (
              <Outlet />
            )}
            {/* </motion.div>
            </AnimatePresence> */}
          </Box>
        </Flex>
      </Box>
      {!isPublic && <DemoModeBadge />}
      {isLocal && (
        <Flex
          direction="column"
          gap="2"
          style={{
            position: 'fixed',
            left: 12,
            bottom: 'calc(12px + var(--app-safe-bottom))',
            zIndex: 50,
          }}
        >
          {isProductionContaInDev && (
            <Badge
              role="alert"
              aria-live="assertive"
              color="red"
              variant="solid"
              size="3"
              highContrast
              className="dev-badge"
              style={{
                fontWeight: 700,
                boxShadow: '0 0 0 2px var(--red-9)',
              }}
            >
              <DevBadgeContent marqueeClassName="dev-badge-marquee">
                ⚠️ Production Conta in dev — real invoices possible
              </DevBadgeContent>
            </Badge>
          )}
          {isContaPaused && (
            <Badge
              role="status"
              aria-live="polite"
              color="orange"
              variant="surface"
              size="3"
              className="dev-badge"
            >
              <DevBadgeContent marqueeClassName="dev-badge-marquee">
                Conta paused — API key inactive
              </DevBadgeContent>
            </Badge>
          )}
          <Badge
            role="status"
            aria-live="polite"
            color="yellow"
            variant="surface"
            size="3"
            className="dev-badge"
          >
            <DevBadgeContent marqueeClassName="dev-badge-marquee">
              Dev environment
            </DevBadgeContent>
          </Badge>
          <Badge
            role="status"
            aria-live="polite"
            color={dbBadgeColor}
            variant="surface"
            size="3"
            className="dev-badge"
          >
            <DevBadgeContent marqueeClassName="dev-badge-marquee">
              {dbBadgeLabel}
            </DevBadgeContent>
          </Badge>
        </Flex>
      )}
    </Flex>
  )
}

/* ------- helpers ------- */
function DevBadgeContent({
  children,
  marqueeClassName,
}: {
  children: React.ReactNode
  marqueeClassName?: string
}) {
  const contentRef = React.useRef<HTMLSpanElement>(null)
  const [needsMarquee, setNeedsMarquee] = React.useState(false)
  const prevChildrenRef = React.useRef(children)

  React.useLayoutEffect(() => {
    if (prevChildrenRef.current !== children) {
      prevChildrenRef.current = children
      setNeedsMarquee(false)
      return
    }
    const el = contentRef.current
    if (!el) return
    const parent = el.parentElement
    if (!parent) return
    setNeedsMarquee(el.scrollWidth > parent.clientWidth)
  }, [children])

  if (needsMarquee) {
    return (
      <span className={marqueeClassName}>
        <span>{children}</span>
        <span>{children}</span>
      </span>
    )
  }
  return <span ref={contentRef}>{children}</span>
}

function getPageTitle(path: string) {
  const NAVinfo = NAV

  for (const section of NAVinfo) {
    for (const navItem of section) {
      if (path === navItem.to) return navItem.label
    }
  }
}
