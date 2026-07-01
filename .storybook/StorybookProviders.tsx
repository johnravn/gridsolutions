import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Theme } from '@radix-ui/themes'
import { ThemeProvider as NextThemesProvider } from 'next-themes'
import { AppToastProvider } from '../src/shared/ui/toast/ToastProvider'
import type { ReactNode } from 'react'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
})

export function StorybookProviders({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem>
      <QueryClientProvider client={queryClient}>
        <Theme accentColor="indigo" radius="small">
          <AppToastProvider>{children}</AppToastProvider>
        </Theme>
      </QueryClientProvider>
    </NextThemesProvider>
  )
}
