import { Outlet } from '@tanstack/react-router'
import { Box } from '@radix-ui/themes'
import { SplitLayoutProvider } from './SplitLayoutContext'
import { SplitChrome } from './SplitChrome'
import './splitLayout.css'

/**
 * Pathless layout for master-detail pages.
 * Owns persistent split chrome; child routes register panel content via SplitPage.
 */
export default function MasterDetailLayout() {
  return (
    <SplitLayoutProvider>
      <Box
        className="split-layout-root"
        style={{
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <SplitChrome />
        <Outlet />
      </Box>
    </SplitLayoutProvider>
  )
}
