// src/app/router/routes.tsx
import {
  Outlet,
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
} from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import CalendarPage from '@features/calendar/pages/CalendarPage'
import VehiclesPage from '@features/vehicles/pages/VehiclesPage'
import JobsPage from '@features/jobs/pages/JobsPage'
import CrewPage from '@features/crew/pages/CrewPage'
import InventoryPage from '@features/inventory/pages/InventoryPage'
import HomePage from '@features/home/pages/HomePage'
import LandingPage from '@features/home/pages/LandingPage'
import LoginPage from '@features/login/pages/LoginPage'
import SignupPage from '@features/login/pages/SignupPage'
import AuthCallback from '@features/login/pages/AuthCallback'
import TermsPrivacyPage from '@features/legal/pages/TermsPrivacyPage'
import { supabase } from '@shared/api/supabase'
import CompanyPage from '@features/company/pages/CompanyPage'
import SuperPage from '@features/super/pages/SuperPage'
import ProfilePage from '@features/profile/pages/ProfilePage'
import MattersPage from '@features/matters/pages/MattersPage'
import CustomerPage from '@features/customers/pages/CostumerPage'
import LatestPage from '@features/latest/pages/LatestPage'
import PublicOfferPage from '@features/jobs/pages/PublicOfferPage'
import LoggingPage from '@features/logging/pages/LoggingPage'
import NotificationsPage from '@features/notifications/pages/NotificationsPage'
import ReportingPage from '@features/reporting/pages/ReportingPage'
import AppShell from '../layout/AppShell'
import RequireCap from './guards/RequireCap'
import type { Capability } from '@shared/auth/permissions'
// import { Outlet } from '@tanstack/react-router'

// Root keeps your shell & devtools as-is
const rootRoute = createRootRoute({
  component: () => (
    <>
      <AppShell />
      {/* <TanStackRouterDevtools /> */}
    </>
  ),
})
const guarded = (need: Capability, Page: React.ComponentType) => () => (
  <RequireCap need={need}>
    <Page />
  </RequireCap>
)

// --- PUBLIC: Landing page route ----------------------------------------------
const landingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession()
    if (data.session?.user) {
      throw redirect({ to: '/dashboard' })
    }
  },
  component: LandingPage,
})

// --- PUBLIC: Login route -----------------------------------------------------
const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'login',
  component: LoginPage,
})

const signupRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'signup',
  component: SignupPage,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession()
    if (data.session) throw redirect({ to: '/dashboard' })
  },
})

const authCallbackRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/auth/callback',
  component: AuthCallback,
})

const legalRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/legal',
  component: TermsPrivacyPage,
})

// --- PUBLIC: Offer viewing route (no auth required) --------------------------
const publicOfferRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/offer/$accessToken',
  component: PublicOfferPage,
})

// --- AUTH GUARD: Parent route that protects children -------------------------
const authedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'authed',
  // Runs before any child route loads. Redirects to /login if no session.
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getSession()
    const session = data.session
    if (!session?.user) {
      throw redirect({
        to: '/login',
        // After login, send the user back here:
        search: { redirect: location.href },
      })
    }
  },
  component: () => <Outlet />,
})

// --- Your existing pages, now nested under authedRoute -----------------------
const homeRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: '/dashboard',
  component: guarded('visit:home', HomePage),
})

const inventoryRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: 'inventory',
  component: guarded('visit:inventory', InventoryPage),
})

const calendarRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: 'calendar',
  component: guarded('visit:calendar', CalendarPage),
})

const loggingRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: 'logging',
  component: guarded('visit:logging', LoggingPage),
})

const vehiclesRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: 'vehicles',
  component: guarded('visit:vehicles', VehiclesPage),
})

const jobsRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: 'jobs',
  validateSearch: (search: Record<string, unknown>) => ({
    jobId: (search.jobId as string | undefined) || undefined,
    tab: (search.tab as string | undefined) || undefined,
  }),
  component: guarded('visit:jobs', JobsPage),
})

const crewRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: 'crew',
  component: guarded('visit:crew', CrewPage),
})

const mattersRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: 'matters',
  validateSearch: (search: Record<string, unknown>) => ({
    matterId: (search.matterId as string | undefined) || undefined,
  }),
  component: guarded('visit:matters', MattersPage),
})

const companyRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: 'company',
  validateSearch: (search: Record<string, unknown>) => ({
    tab: (search.tab as string | undefined) || undefined,
  }),
  component: guarded('visit:company', CompanyPage),
})

const customersRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: 'customers',
  component: guarded('visit:customers', CustomerPage),
})

const latestRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: 'latest',
  validateSearch: (search: Record<string, unknown>) => ({
    activityId: (search.activityId as string | undefined) || undefined,
  }),
  component: guarded('visit:latest', LatestPage),
})

const profileRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: 'profile',
  component: guarded('visit:profile', ProfilePage),
})

const notificationsRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: 'notifications',
  component: guarded('visit:profile', NotificationsPage),
})

const reportingRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: 'reporting',
  component: guarded('visit:company', ReportingPage),
})

const superRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: 'super',
  component: guarded('visit:super', SuperPage),
})

// --- Not Found stays under root (public) -------------------------------------
const notFoundRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '*',
  component: () => <div>Not found</div>,
})

const routeTree = rootRoute.addChildren([
  landingRoute,
  loginRoute,
  signupRoute,
  authCallbackRoute,
  legalRoute,
  publicOfferRoute,
  authedRoute.addChildren([
    // protected
    homeRoute,
    inventoryRoute,
    calendarRoute,
    loggingRoute,
    vehiclesRoute,
    jobsRoute,
    crewRoute,
    mattersRoute,
    companyRoute,
    customersRoute,
    latestRoute,
    profileRoute,
    notificationsRoute,
    reportingRoute,
    superRoute,
  ]),
  notFoundRoute,
])

export const router = createRouter({
  routeTree,
  context: {},
  defaultPreload: 'intent',
  scrollRestoration: true,
  defaultStructuralSharing: true,
  defaultPreloadStaleTime: 0,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
