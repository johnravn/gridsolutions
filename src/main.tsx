// main.tsx
import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import '@radix-ui/themes/styles.css'
import { ThemeProvider as NextThemesProvider } from 'next-themes'
import { RouterProvider } from '@tanstack/react-router'
import { HotkeysProvider } from '@tanstack/react-hotkeys'

import './app/styles.css'
import { router } from '@app/router/routes.tsx'
import { QueryProvider } from '@app/providers/QueryProvider.tsx'
import { AuthProvider } from '@app/providers/AuthProvider.tsx'
import { CompanyProvider } from '@shared/companies/CompanyProvider.tsx'
import { AppToastProvider } from '@shared/ui/toast/ToastProvider.tsx'
import { ThemeWrapper } from '@shared/theme/ThemeWrapper.tsx'
import { PwaUpdateHandler } from '@app/pwa/PwaUpdateHandler.tsx'
import {
  ShortcutActionsProvider,
  ShortcutPreferencesProvider,
} from '@shared/hotkeys'
import { IconContext } from 'react-icons/lib'
import reportWebVitals from './reportWebVitals.ts'
import 'react-phone-number-input/style.css'

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

const rootElement = document.getElementById('root')
if (rootElement && !rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement)
  root.render(
    <StrictMode>
      <NextThemesProvider attribute="class" defaultTheme="system" enableSystem>
        <QueryProvider>
          <AuthProvider>
            <CompanyProvider>
              <ThemeWrapper>
                <AppToastProvider>
                  <HotkeysProvider
                    defaultOptions={{
                      hotkey: { preventDefault: true },
                    }}
                  >
                    <ShortcutPreferencesProvider>
                      <ShortcutActionsProvider>
                        <PwaUpdateHandler />
                        <IconContext.Provider value={{ size: '1.5em' }}>
                          <RouterProvider router={router} />
                        </IconContext.Provider>
                      </ShortcutActionsProvider>
                    </ShortcutPreferencesProvider>
                  </HotkeysProvider>
                </AppToastProvider>
              </ThemeWrapper>
            </CompanyProvider>
          </AuthProvider>
        </QueryProvider>
      </NextThemesProvider>
    </StrictMode>,
  )
}

reportWebVitals()
