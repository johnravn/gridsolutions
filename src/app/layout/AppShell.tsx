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
import { AnimatedBackground } from '@shared/ui/components/AnimatedBackground'
import { getInitials } from '@shared/lib/generalFunctions'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { NAV, Sidebar } from './Sidebar'

export default function AppShell() {
  const [open, setOpen] = React.useState(true)
  const routerState = useRouterState()
  const currentPath = routerState.location.pathname
  const isMobile = useMediaQuery('(max-width: 768px)')
  const navigate = useNavigate()
  const { companies, loading: companyLoading } = useCompany()
  const isLocal =
    import.meta.env.DEV ||
    ['localhost', '127.0.0.1', '0.0.0.0'].includes(window.location.hostname)

  // Get user from shared query (already fetched by CompanyProvider)
  const { data: authUser } = useQuery({
    queryKey: ['auth', 'user'],
    queryFn: async () => {
      const { data, error } = await supabase.auth.getUser()
      if (error) throw error
      return data.user
    },
  })

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
    staleTime: 0, // Always refetch when invalidated
    refetchOnWindowFocus: true, // Refetch when window gains focus
  })

  const backgroundEnabled = backgroundPrefs?.enabled ?? false
  const backgroundIntensity = backgroundPrefs?.intensity ?? 1.0
  const backgroundShapeType = backgroundPrefs?.shapeType ?? 'circles'
  const backgroundSpeed = backgroundPrefs?.speed ?? 1.0

  React.useEffect(() => {
    if (isMobile) setOpen(false)
  }, [isMobile])

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate({ to: '/login' })
  }

  const title = getPageTitle(currentPath)
  const isPublic =
    currentPath === '/login' ||
    currentPath === '/signup' ||
    currentPath === '/legal' ||
    currentPath === '/' ||
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
      {!isPublic && backgroundEnabled === true && (
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
          <Flex align="center" justify="between" px="4" py="3">
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
            style={{
              flex: 1, // <-- grow to fill
              minHeight: 0, // <-- allow scrolling area to shrink
              overflow: isPublic ? 'visible' : 'auto', // <-- scroll here
            }}
          >
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
                  If this is wrong, contact support.
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
      {isLocal && (
        <Box style={{ position: 'fixed', left: 12, bottom: 12, zIndex: 50 }}>
          <Badge
            role="status"
            aria-live="polite"
            color="yellow"
            variant="surface"
            size="3"
          >
            Dev environment
          </Badge>
        </Box>
      )}
    </Flex>
  )
}

/* ------- helpers ------- */
function getPageTitle(path: string) {
  const NAVinfo = NAV

  for (const section of NAVinfo) {
    for (const navItem of section) {
      if (path === navItem.to) return navItem.label
    }
  }
}
